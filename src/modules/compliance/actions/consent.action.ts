"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function getConsentStatusAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COMPLIANCE_CONSENT_READ);
  if (denied) return denied;

  const consents = await db.consentRecord.findMany({
    where: { userId: ctx.session.user.id, schoolId: ctx.schoolId },
    orderBy: { updatedAt: "desc" },
  });

  const consentTypes = ["DATA_PROCESSING", "MARKETING_COMMUNICATIONS", "PHOTO_VIDEO", "THIRD_PARTY_SHARING", "ANALYTICS_TRACKING"];

  const status = consentTypes.map((type) => {
    const record = consents.find((c) => c.consentType === type);
    return {
      type,
      granted: record?.granted ?? false,
      grantedAt: record?.grantedAt ?? null,
      revokedAt: record?.revokedAt ?? null,
      version: record?.version ?? null,
    };
  });

  return { data: status };
}

export async function updateConsentAction(data: {
  consentType: string;
  granted: boolean;
  ipAddress?: string;
  userAgent?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COMPLIANCE_CONSENT_CREATE);
  if (denied) return denied;

  const now = new Date();
  const consentType = data.consentType as "DATA_PROCESSING" | "MARKETING_COMMUNICATIONS" | "PHOTO_VIDEO" | "THIRD_PARTY_SHARING" | "ANALYTICS_TRACKING";

  const record = await db.consentRecord.upsert({
    where: {
      userId_schoolId_consentType: {
        userId: ctx.session.user.id,
        schoolId: ctx.schoolId,
        consentType,
      },
    },
    create: {
      userId: ctx.session.user.id,
      schoolId: ctx.schoolId,
      consentType,
      granted: data.granted,
      grantedAt: data.granted ? now : null,
      revokedAt: data.granted ? null : now,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    },
    update: {
      granted: data.granted,
      grantedAt: data.granted ? now : undefined,
      revokedAt: data.granted ? null : now,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "ConsentRecord",
    entityId: record.id,
    module: "compliance",
    description: `${data.granted ? "Granted" : "Revoked"} consent for ${data.consentType}`,
  });

  return { data: record };
}

export async function getConsentAuditAction(filters?: {
  consentType?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COMPLIANCE_CONSENT_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.consentType) where.consentType = filters.consentType;

  const [records, total] = await Promise.all([
    db.consentRecord.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { updatedAt: "desc" },
    }),
    db.consentRecord.count({ where }),
  ]);

  return { data: records, total, page, pageSize };
}
