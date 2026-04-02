"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { sendMessage, sendMultiChannel, broadcastMessage, type ChannelType } from "@/lib/messaging/hub";

/**
 * Send a WhatsApp message to a single recipient.
 */
export async function sendWhatsAppAction(data: {
  phone: string;
  message: string;
  recipientName?: string;
  templateId?: string;
  templateData?: Record<string, string>;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGES_READ);
  if (denied) return denied;

  const result = await sendMessage("whatsapp", {
    to: data.phone,
    body: data.message,
    templateId: data.templateId,
    templateData: data.templateData,
  });

  if (result.success) {
    await audit({
      userId: ctx.session.user.id,
      action: "CREATE",
      entity: "Message",
      module: "communication",
      description: `Sent WhatsApp message to ${data.recipientName || data.phone}`,
      metadata: { channel: "whatsapp", phone: data.phone },
    });
  }

  return result.success
    ? { data: { messageId: result.providerMessageId } }
    : { error: result.error || "Failed to send WhatsApp message" };
}

/**
 * Send a notification through multiple channels simultaneously.
 */
export async function sendMultiChannelNotificationAction(data: {
  channels: ChannelType[];
  recipientUserId: string;
  recipientPhone?: string;
  message: string;
  subject?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGES_READ);
  if (denied) return denied;

  // For each channel, determine the recipient address
  const results: Record<string, { success: boolean; error?: string }> = {};

  for (const channel of data.channels) {
    let to: string;
    switch (channel) {
      case "in_app":
        to = data.recipientUserId;
        break;
      case "sms":
      case "whatsapp":
        if (!data.recipientPhone) {
          results[channel] = { success: false, error: "No phone number provided" };
          continue;
        }
        to = data.recipientPhone;
        break;
      default:
        to = data.recipientUserId;
    }

    const result = await sendMessage(channel, {
      to,
      body: data.message,
      subject: data.subject,
    });

    results[channel] = { success: result.success, error: result.error };
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Message",
    module: "communication",
    description: `Multi-channel notification via ${data.channels.join(", ")}`,
    metadata: { channels: data.channels, results },
  });

  return { data: results };
}

/**
 * Broadcast a message to a class, programme, or entire school.
 */
export async function broadcastToGroupAction(data: {
  channels: ChannelType[];
  targetType: "class" | "programme" | "school" | "boarding";
  targetId?: string;
  message: string;
  subject?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGES_READ);
  if (denied) return denied;

  // Resolve recipients based on target type
  let studentIds: string[] = [];

  switch (data.targetType) {
    case "class": {
      if (!data.targetId) return { error: "Class arm ID required" };
      const enrollments = await db.enrollment.findMany({
        where: { classArmId: data.targetId, status: "ACTIVE" },
        select: { studentId: true },
      });
      studentIds = enrollments.map((e) => e.studentId);
      break;
    }
    case "programme": {
      if (!data.targetId) return { error: "Programme ID required" };
      const enrollments = await db.enrollment.findMany({
        where: {
          classArm: { class: { programmeId: data.targetId } },
          status: "ACTIVE",
        },
        select: { studentId: true },
      });
      studentIds = enrollments.map((e) => e.studentId);
      break;
    }
    case "boarding": {
      const boarders = await db.student.findMany({
        where: { schoolId: ctx.schoolId, boardingStatus: "BOARDING", status: "ACTIVE" },
        select: { id: true },
      });
      studentIds = boarders.map((s) => s.id);
      break;
    }
    case "school": {
      const students = await db.student.findMany({
        where: { schoolId: ctx.schoolId, status: "ACTIVE" },
        select: { id: true },
      });
      studentIds = students.map((s) => s.id);
      break;
    }
  }

  if (studentIds.length === 0) {
    return { error: "No recipients found for the selected group" };
  }

  // Get guardian contact info for SMS/WhatsApp channels
  const guardians = await db.studentGuardian.findMany({
    where: { studentId: { in: studentIds }, isPrimary: true },
    include: {
      guardian: { select: { phone: true, firstName: true, lastName: true } },
    },
  });

  const recipients = guardians.map((sg) => ({
    userId: sg.studentId,
    phone: sg.guardian.phone,
  }));

  const stats = await broadcastMessage({
    channels: data.channels,
    recipients,
    message: data.message,
    subject: data.subject,
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Broadcast",
    module: "communication",
    description: `Broadcast to ${data.targetType} via ${data.channels.join(", ")}: ${stats.totalSent} sent, ${stats.totalFailed} failed`,
    metadata: { ...stats, targetType: data.targetType, targetId: data.targetId },
  });

  return { data: stats };
}

/**
 * Send fee reminder via preferred channels.
 */
export async function sendFeeReminderAction(data: {
  studentBillId: string;
  channels: ChannelType[];
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGES_READ);
  if (denied) return denied;

  const bill = await db.studentBill.findUnique({
    where: { id: data.studentBillId },
  });

  if (!bill) return { error: "Bill not found" };
  if (bill.status === "PAID" || bill.status === "OVERPAID") {
    return { error: "Bill is already paid" };
  }

  // Get student and guardian info separately (StudentBill has no direct student relation)
  const student = await db.student.findUnique({
    where: { id: bill.studentId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!student) return { error: "Student not found" };

  const guardianLink = await db.studentGuardian.findFirst({
    where: { studentId: bill.studentId, isPrimary: true },
    include: { guardian: { select: { phone: true, firstName: true } } },
  });
  const guardian = guardianLink?.guardian;

  const message = `Dear ${guardian?.firstName || "Parent/Guardian"}, this is a reminder that ${student.firstName} ${student.lastName} has an outstanding fee balance of ${bill.balanceAmount.toFixed(2)}. Please make payment at your earliest convenience.`;

  const results: Record<string, { success: boolean; error?: string }> = {};

  for (const channel of data.channels) {
    let to: string;
    switch (channel) {
      case "in_app":
        to = student.id;
        break;
      case "sms":
      case "whatsapp":
        if (!guardian?.phone) {
          results[channel] = { success: false, error: "No guardian phone number" };
          continue;
        }
        to = guardian.phone;
        break;
      default:
        to = student.id;
    }

    const result = await sendMessage(channel, {
      to,
      body: message,
      subject: "Fee Payment Reminder",
      metadata: { type: "WARNING", link: "/parent/fees" },
    });

    results[channel] = { success: result.success, error: result.error };
  }

  return { data: results };
}
