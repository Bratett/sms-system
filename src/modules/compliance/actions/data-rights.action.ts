"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Data Export (Right to Portability) ─────────────────────────────

export async function requestDataExportAction(format?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  // Check for existing pending/processing request
  const existing = await db.dataExportRequest.findFirst({
    where: {
      userId: session.user.id!,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });

  if (existing) {
    return { error: "You already have a pending data export request" };
  }

  const request = await db.dataExportRequest.create({
    data: {
      userId: session.user.id!,
      schoolId: school.id,
      format: format || "json",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "DataExportRequest",
    entityId: request.id,
    module: "compliance",
    description: "Requested personal data export",
  });

  return { data: request };
}

export async function getDataExportRequestsAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const requests = await db.dataExportRequest.findMany({
    where: { userId: session.user.id! },
    orderBy: { requestedAt: "desc" },
    take: 10,
  });

  return { data: requests };
}

export async function processDataExportAction(requestId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const request = await db.dataExportRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) return { error: "Export request not found" };
  if (request.status !== "PENDING") return { error: "Request is not in pending status" };

  // Mark as processing
  await db.dataExportRequest.update({
    where: { id: requestId },
    data: { status: "PROCESSING" },
  });

  try {
    // Collect user's personal data
    const userData = await collectUserData(request.userId, request.schoolId);

    // In production, this would upload to S3/R2 and set fileUrl
    // For now, we mark as completed with the data structure
    await db.dataExportRequest.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    await audit({
      userId: session.user.id!,
      action: "EXPORT",
      entity: "DataExportRequest",
      entityId: requestId,
      module: "compliance",
      description: `Processed data export for user ${request.userId}`,
    });

    return { data: userData };
  } catch (error) {
    await db.dataExportRequest.update({
      where: { id: requestId },
      data: { status: "FAILED" },
    });

    return { error: "Failed to process data export" };
  }
}

async function collectUserData(userId: string, schoolId: string) {
  const [user, student, staff, consents, auditLogs] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    db.student.findFirst({
      where: { schoolId },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        nationality: true,
        hometown: true,
        region: true,
        boardingStatus: true,
        status: true,
        createdAt: true,
      },
    }),
    db.staff.findFirst({
      where: { schoolId },
      select: {
        id: true,
        staffId: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        staffType: true,
        status: true,
        createdAt: true,
      },
    }),
    db.consentRecord.findMany({
      where: { userId, schoolId },
    }),
    db.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: 100,
      select: {
        action: true,
        entity: true,
        module: true,
        description: true,
        timestamp: true,
      },
    }),
  ]);

  return {
    exportDate: new Date().toISOString(),
    user,
    student,
    staff,
    consents,
    activityLog: auditLogs,
  };
}

// ─── Data Deletion (Right to Erasure) ───────────────────────────────

export async function requestDataDeletionAction(data: {
  entityType: string;
  entityId: string;
  reason?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const request = await db.dataDeletionRequest.create({
    data: {
      userId: session.user.id!,
      schoolId: school.id,
      entityType: data.entityType,
      entityId: data.entityId,
      reason: data.reason || null,
      status: "PENDING",
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "DataDeletionRequest",
    entityId: request.id,
    module: "compliance",
    description: `Requested deletion of ${data.entityType} record ${data.entityId}`,
  });

  return { data: request };
}

export async function getDeletionRequestsAction(filters?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.status) where.status = filters.status;

  const [requests, total] = await Promise.all([
    db.dataDeletionRequest.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { requestedAt: "desc" },
    }),
    db.dataDeletionRequest.count({ where }),
  ]);

  return { data: requests, total, page, pageSize };
}

export async function reviewDeletionRequestAction(
  requestId: string,
  decision: { status: "APPROVED" | "REJECTED"; scheduledFor?: string },
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const request = await db.dataDeletionRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) return { error: "Deletion request not found" };
  if (request.status !== "PENDING") return { error: "Request is not in pending status" };

  const updated = await db.dataDeletionRequest.update({
    where: { id: requestId },
    data: {
      status: decision.status === "APPROVED" ? "SCHEDULED" : "REJECTED",
      reviewedBy: session.user.id!,
      reviewedAt: new Date(),
      scheduledFor: decision.status === "APPROVED" && decision.scheduledFor
        ? new Date(decision.scheduledFor)
        : decision.status === "APPROVED"
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30-day grace period
          : null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "DataDeletionRequest",
    entityId: requestId,
    module: "compliance",
    description: `${decision.status === "APPROVED" ? "Approved" : "Rejected"} deletion request for ${request.entityType} ${request.entityId}`,
  });

  return { data: updated };
}

// ─── Privacy Policies ───────────────────────────────────────────────

export async function getPrivacyPoliciesAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const policies = await db.privacyPolicy.findMany({
    where: { schoolId: school.id },
    orderBy: { effectiveDate: "desc" },
  });

  return { data: policies };
}

export async function createPrivacyPolicyAction(data: {
  version: string;
  title: string;
  content: string;
  effectiveDate: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  // Deactivate previous policies
  await db.privacyPolicy.updateMany({
    where: { schoolId: school.id, isActive: true },
    data: { isActive: false },
  });

  const policy = await db.privacyPolicy.create({
    data: {
      schoolId: school.id,
      version: data.version,
      title: data.title,
      content: data.content,
      effectiveDate: new Date(data.effectiveDate),
      isActive: true,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "PrivacyPolicy",
    entityId: policy.id,
    module: "compliance",
    description: `Published privacy policy v${data.version}`,
  });

  return { data: policy };
}

// ─── Retention Policies ─────────────────────────────────────────────

export async function getRetentionPoliciesAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const policies = await db.dataRetentionPolicy.findMany({
    where: { schoolId: school.id },
    orderBy: { entityType: "asc" },
  });

  return { data: policies };
}

export async function upsertRetentionPolicyAction(data: {
  entityType: string;
  retentionDays: number;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  if (data.retentionDays < 30) {
    return { error: "Minimum retention period is 30 days" };
  }

  const policy = await db.dataRetentionPolicy.upsert({
    where: {
      schoolId_entityType: {
        schoolId: school.id,
        entityType: data.entityType,
      },
    },
    create: {
      schoolId: school.id,
      entityType: data.entityType,
      retentionDays: data.retentionDays,
      description: data.description || null,
    },
    update: {
      retentionDays: data.retentionDays,
      description: data.description || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "DataRetentionPolicy",
    entityId: policy.id,
    module: "compliance",
    description: `Set retention for ${data.entityType}: ${data.retentionDays} days`,
  });

  return { data: policy };
}
