"use server";

import { randomInt, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";

/**
 * Guardian OTP for gate release.
 *
 * Flow: once an exeat reaches HEADMASTER_APPROVED, a gate officer can request
 * a one-time code be sent to the guardian via SMS (or WhatsApp). The guardian
 * reads the code back to the officer, who enters it at the gate screen. On
 * verify, the exeat is eligible for the DEPART transition.
 *
 * Security: we hash the code (SHA-256 + per-OTP salt) and never store or
 * return the plaintext; only the dispatched message contains it. A per-OTP
 * `maxAttempts` counter prevents brute force, and a rate-limiter caps the
 * number of codes sent per guardian phone per hour to control SMS cost.
 */

// Send at most 3 OTPs per hour per guardian phone.
const otpSendLimiter = rateLimit({ interval: 60 * 60 * 1000, uniqueTokenPerInterval: 1000 });
const OTP_TTL_MS = 10 * 60 * 1000;      // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

function generateCode(): string {
  // 6-digit numeric code — familiar UX, fits one SMS.
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`, "utf8").digest("hex");
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function requestGuardianOtpAction(params: {
  exeatId: string;
  channel?: "SMS" | "WHATSAPP";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_GATE_CHECK);
  if (denied) return denied;

  const exeat = await db.exeat.findUnique({ where: { id: params.exeatId } });
  if (!exeat) return { error: "Exeat not found." };
  if (exeat.schoolId !== ctx.schoolId) return { error: "Exeat not found." };

  // The OTP gates the depart transition, so only send when the exeat has
  // reached the state just before departure.
  if (exeat.status !== "HEADMASTER_APPROVED") {
    return { error: "Exeat must be approved by headmaster before requesting an OTP." };
  }

  if (!exeat.guardianPhone) {
    return { error: "No guardian phone on record for this exeat." };
  }

  try {
    await otpSendLimiter.check(3, `exeat-otp:${exeat.guardianPhone}`);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { error: "Too many OTP requests for this guardian. Try again later." };
    }
    throw err;
  }

  const code = generateCode();
  const salt = randomBytes(16).toString("hex");
  const codeHash = `${salt}:${hashCode(code, salt)}`;

  const otp = await db.exeatOtp.create({
    data: {
      exeatId: exeat.id,
      schoolId: ctx.schoolId,
      codeHash,
      channel: params.channel ?? "SMS",
      sentTo: exeat.guardianPhone,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      maxAttempts: OTP_MAX_ATTEMPTS,
    },
  });

  // Fire-and-forget dispatch. The channel is informational metadata here; the
  // dispatcher still uses SMS regardless of WHATSAPP for now — WhatsApp provider
  // is a Phase-2 stub.
  await dispatch({
    event: NOTIFICATION_EVENTS.EXEAT_APPROVED, // closest existing event
    title: `Gate release code for ${exeat.exeatNumber}`,
    message: `Your ward's exeat release code is ${code}. It expires in 10 minutes. Do not share this code except with the gate officer.`,
    recipients: [{ phone: exeat.guardianPhone, name: exeat.guardianName ?? undefined }],
    schoolId: ctx.schoolId,
    channels: ["sms"],
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "ExeatOtp",
    entityId: otp.id,
    module: "boarding",
    description: `Dispatched gate-release OTP for exeat ${exeat.exeatNumber}`,
    metadata: { channel: otp.channel },
  });

  return {
    data: {
      otpId: otp.id,
      sentTo: maskPhone(exeat.guardianPhone),
      expiresAt: otp.expiresAt,
    },
  };
}

export async function verifyGuardianOtpAction(params: {
  exeatId: string;
  code: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_GATE_CHECK);
  if (denied) return denied;

  if (!/^\d{6}$/.test(params.code)) {
    return { error: "Code must be 6 digits." };
  }

  const otp = await db.exeatOtp.findFirst({
    where: {
      exeatId: params.exeatId,
      schoolId: ctx.schoolId,
      status: "SENT",
    },
    orderBy: { sentAt: "desc" },
  });

  if (!otp) return { error: "No active OTP for this exeat. Request a new one." };

  if (otp.expiresAt.getTime() < Date.now()) {
    await db.exeatOtp.update({
      where: { id: otp.id },
      data: { status: "EXPIRED" },
    });
    return { error: "OTP has expired. Request a new one." };
  }

  if (otp.attempts >= otp.maxAttempts) {
    await db.exeatOtp.update({
      where: { id: otp.id },
      data: { status: "FAILED" },
    });
    return { error: "Too many failed attempts on this OTP. Request a new one." };
  }

  const [salt, storedHash] = otp.codeHash.split(":");
  const candidate = hashCode(params.code, salt);
  const ok = constantTimeEqual(candidate, storedHash);

  if (!ok) {
    const newAttempts = otp.attempts + 1;
    await db.exeatOtp.update({
      where: { id: otp.id },
      data: {
        attempts: newAttempts,
        status: newAttempts >= otp.maxAttempts ? "FAILED" : "SENT",
      },
    });
    return {
      error: "Incorrect code.",
      attemptsRemaining: Math.max(0, otp.maxAttempts - newAttempts),
    };
  }

  await db.exeatOtp.update({
    where: { id: otp.id },
    data: { status: "VERIFIED", verifiedAt: new Date() },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "ExeatOtp",
    entityId: otp.id,
    module: "boarding",
    description: `Verified gate-release OTP for exeat`,
  });

  return { success: true };
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 3)}******${phone.slice(-2)}`;
}
