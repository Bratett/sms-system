"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function getConsentStatusAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const consents = await db.consentRecord.findMany({
    where: { userId: session.user.id!, schoolId: school.id },
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const now = new Date();
  const consentType = data.consentType as "DATA_PROCESSING" | "MARKETING_COMMUNICATIONS" | "PHOTO_VIDEO" | "THIRD_PARTY_SHARING" | "ANALYTICS_TRACKING";

  const record = await db.consentRecord.upsert({
    where: {
      userId_schoolId_consentType: {
        userId: session.user.id!,
        schoolId: school.id,
        consentType,
      },
    },
    create: {
      userId: session.user.id!,
      schoolId: school.id,
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
    userId: session.user.id!,
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;

  const where: Record<string, unknown> = { schoolId: school.id };
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
