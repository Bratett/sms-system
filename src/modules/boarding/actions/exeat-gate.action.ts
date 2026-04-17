"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  transitionWorkflowWithAutoStart,
  WorkflowTransitionError,
} from "@/lib/workflow/engine";
import {
  EXEAT_EVENTS,
  EXEAT_STATES,
  EXEAT_WORKFLOW_KEY,
} from "@/lib/workflow/definitions/exeat";

/**
 * Gate-officer actions for the exeat depart/return flow.
 *
 * Guardian OTP verification is a prerequisite for DEPART: an exeat is only
 * eligible to transition to DEPARTED if a VERIFIED ExeatOtp exists for it.
 * The gate officer is not trusted with the code value — the OTP action file
 * handles issuing and verifying, and this file checks the verified marker.
 *
 * Geolocation is optional and captured on a best-effort basis; it's useful
 * for after-the-fact audit on which physical gate the movement happened at
 * when a school has more than one.
 */

interface GateScanInput {
  exeatNumber: string;
}

interface GateMovementInput {
  exeatId: string;
  geoLat?: number;
  geoLng?: number;
  notes?: string;
}

/**
 * Resolve an exeat by its human-readable number (scanned QR code or typed).
 * Returns minimal fields the gate screen needs — student name, photo, status,
 * and whether a verified OTP is available for DEPART.
 */
export async function scanExeatAction(input: GateScanInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_GATE_CHECK);
  if (denied) return denied;

  const exeat = await db.exeat.findUnique({
    where: { exeatNumber: input.exeatNumber.trim() },
  });
  if (!exeat || exeat.schoolId !== ctx.schoolId) {
    return { error: "Exeat not found." };
  }

  const student = await db.student.findUnique({
    where: { id: exeat.studentId },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      boardingStatus: true,
    },
  });

  const verifiedOtp = await db.exeatOtp.findFirst({
    where: {
      exeatId: exeat.id,
      status: "VERIFIED",
    },
    orderBy: { verifiedAt: "desc" },
  });

  return {
    data: {
      id: exeat.id,
      exeatNumber: exeat.exeatNumber,
      status: exeat.status,
      type: exeat.type,
      expectedReturnDate: exeat.expectedReturnDate,
      actualReturnDate: exeat.actualReturnDate,
      guardianPhone: exeat.guardianPhone,
      student: student
        ? {
            id: student.id,
            studentId: student.studentId,
            fullName: `${student.firstName} ${student.lastName}`,
            photoUrl: student.photoUrl,
          }
        : null,
      hasVerifiedOtp: Boolean(verifiedOtp),
      canDepart: exeat.status === "HEADMASTER_APPROVED" && Boolean(verifiedOtp),
      canReturn: exeat.status === "DEPARTED" || exeat.status === "OVERDUE",
    },
  };
}

/**
 * Gate-officer records a departure. Requires a verified OTP, transitions
 * the workflow to DEPARTED, logs an ExeatMovement row.
 */
export async function gateDepartAction(input: GateMovementInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_GATE_CHECK);
  if (denied) return denied;

  const exeat = await db.exeat.findUnique({ where: { id: input.exeatId } });
  if (!exeat || exeat.schoolId !== ctx.schoolId) return { error: "Exeat not found." };

  if (exeat.status !== "HEADMASTER_APPROVED") {
    return { error: "Exeat must be approved by headmaster before departure." };
  }

  const verifiedOtp = await db.exeatOtp.findFirst({
    where: { exeatId: exeat.id, status: "VERIFIED" },
  });
  if (!verifiedOtp) {
    return {
      error: "Guardian OTP must be verified before releasing the student.",
    };
  }

  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: EXEAT_WORKFLOW_KEY,
      entityType: "Exeat",
      event: EXEAT_EVENTS.DEPART,
      entity: exeat,
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id, role: "gate_officer" },
      extraMutations: [
        (tx) =>
          tx.exeat.update({
            where: { id: exeat.id },
            data: { status: EXEAT_STATES.DEPARTED },
          }),
        (tx) =>
          tx.exeatMovement.create({
            data: {
              exeatId: exeat.id,
              schoolId: ctx.schoolId,
              kind: "DEPART",
              officerId: ctx.session.user.id,
              geoLat: input.geoLat,
              geoLng: input.geoLng,
              notes: input.notes,
            },
          }),
      ],
    });
  } catch (err) {
    if (err instanceof WorkflowTransitionError) return { error: err.message };
    throw err;
  }

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Exeat",
    entityId: exeat.id,
    module: "boarding",
    description: `Gate departure recorded for exeat ${exeat.exeatNumber}`,
    previousData: { status: exeat.status },
    newData: { status: EXEAT_STATES.DEPARTED },
    metadata:
      input.geoLat != null && input.geoLng != null
        ? { geoLat: input.geoLat, geoLng: input.geoLng }
        : undefined,
  });

  return { success: true };
}

/**
 * Gate-officer records a return. No OTP needed; just transitions the workflow
 * and logs an ExeatMovement. Safe to call from DEPARTED or OVERDUE.
 */
export async function gateReturnAction(input: GateMovementInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_GATE_CHECK);
  if (denied) return denied;

  const exeat = await db.exeat.findUnique({ where: { id: input.exeatId } });
  if (!exeat || exeat.schoolId !== ctx.schoolId) return { error: "Exeat not found." };

  if (exeat.status !== "DEPARTED" && exeat.status !== "OVERDUE") {
    return { error: "Exeat must be in DEPARTED or OVERDUE status." };
  }

  const now = new Date();
  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: EXEAT_WORKFLOW_KEY,
      entityType: "Exeat",
      event: EXEAT_EVENTS.RETURN,
      entity: exeat,
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id, role: "gate_officer" },
      extraMutations: [
        (tx) =>
          tx.exeat.update({
            where: { id: exeat.id },
            data: {
              status: EXEAT_STATES.RETURNED,
              actualReturnDate: now,
              actualReturnTime: now.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          }),
        (tx) =>
          tx.exeatMovement.create({
            data: {
              exeatId: exeat.id,
              schoolId: ctx.schoolId,
              kind: "RETURN",
              officerId: ctx.session.user.id,
              geoLat: input.geoLat,
              geoLng: input.geoLng,
              notes: input.notes,
            },
          }),
      ],
    });
  } catch (err) {
    if (err instanceof WorkflowTransitionError) return { error: err.message };
    throw err;
  }

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Exeat",
    entityId: exeat.id,
    module: "boarding",
    description: `Gate return recorded for exeat ${exeat.exeatNumber}`,
    previousData: { status: exeat.status },
    newData: { status: EXEAT_STATES.RETURNED, actualReturnDate: now },
  });

  return { success: true };
}
