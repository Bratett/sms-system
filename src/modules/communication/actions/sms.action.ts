"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getQueue, QUEUE_NAMES, type SmsJobData } from "@/lib/queue";

// ─── Send Single SMS ────────────────────────────────────────────────

export async function sendSmsAction(data: {
  recipientPhone: string;
  recipientName?: string;
  message: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const smsLog = await db.smsLog.create({
    data: {
      schoolId: school.id,
      recipientPhone: data.recipientPhone,
      recipientName: data.recipientName || null,
      message: data.message,
      status: "QUEUED",
    },
  });

  // Dispatch to SMS delivery queue
  const smsQueue = getQueue<SmsJobData>(QUEUE_NAMES.SMS);
  await smsQueue.add("sms-send", {
    smsLogId: smsLog.id,
    phone: data.recipientPhone,
    message: data.message,
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "SmsLog",
    entityId: smsLog.id,
    module: "communication",
    description: `Queued SMS to ${data.recipientPhone}`,
    newData: smsLog,
  });

  return { data: smsLog };
}

// ─── Send Bulk SMS ──────────────────────────────────────────────────

export async function sendBulkSmsAction(data: {
  recipients: Array<{ phone: string; name?: string }>;
  message: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  if (data.recipients.length === 0) {
    return { error: "No recipients provided." };
  }

  const smsQueue = getQueue<SmsJobData>(QUEUE_NAMES.SMS);

  const records = data.recipients.map((r) => ({
    schoolId: school.id,
    recipientPhone: r.phone,
    recipientName: r.name || null,
    message: data.message,
    status: "QUEUED",
  }));

  const result = await db.smsLog.createMany({ data: records });

  // Fetch created records to dispatch to queue
  const createdLogs = await db.smsLog.findMany({
    where: { schoolId: school.id, status: "QUEUED", message: data.message },
    orderBy: { createdAt: "desc" },
    take: data.recipients.length,
  });

  for (const log of createdLogs) {
    await smsQueue.add("sms-send", {
      smsLogId: log.id,
      phone: log.recipientPhone,
      message: log.message,
    });
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "SmsLog",
    module: "communication",
    description: `Queued bulk SMS to ${data.recipients.length} recipients`,
    metadata: { recipientCount: data.recipients.length },
  });

  return { data: { count: result.count } };
}

// ─── Get SMS Logs (paginated) ───────────────────────────────────────

export async function getSmsLogsAction(filters?: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: school.id };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.search) {
    where.OR = [
      { recipientPhone: { contains: filters.search, mode: "insensitive" } },
      { recipientName: { contains: filters.search, mode: "insensitive" } },
      { message: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [logs, total] = await Promise.all([
    db.smsLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.smsLog.count({ where }),
  ]);

  return {
    data: logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
