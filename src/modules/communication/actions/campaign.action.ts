"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import type { NotificationChannel } from "@prisma/client";

/**
 * Scheduled communication campaigns.
 *
 * Admins pick a channel, optional template, recipient audience (class-arm,
 * hostel, etc.) and a scheduledAt time. The campaign worker polls for
 * SCHEDULED rows whose scheduledAt has passed, resolves the audience into a
 * recipient list, enqueues per-recipient jobs on the appropriate delivery
 * queue, and updates counts on completion.
 */

const CHANNELS = ["IN_APP", "SMS", "EMAIL", "WHATSAPP"] as const;

const audienceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("CLASS_ARM"),
    classArmId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("HOSTEL"),
    hostelId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("ALL_GUARDIANS"),
  }),
  z.object({
    kind: z.literal("ALL_STAFF"),
  }),
  z.object({
    kind: z.literal("CUSTOM_USER_IDS"),
    userIds: z.array(z.string()).min(1),
  }),
]);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  templateId: z.string().optional().nullable(),
  channel: z.enum(CHANNELS),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(10_000),
  audience: audienceSchema,
  scheduledAt: z.string().datetime().or(z.date()),
});

export async function createCampaignAction(input: z.input<typeof createSchema>) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SMS_SEND);
  if (denied) return denied;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const scheduledAt =
    parsed.data.scheduledAt instanceof Date
      ? parsed.data.scheduledAt
      : new Date(parsed.data.scheduledAt);

  if (scheduledAt.getTime() < Date.now() - 60_000) {
    return { error: "Scheduled time must be in the future." };
  }

  const campaign = await db.communicationCampaign.create({
    data: {
      schoolId: ctx.schoolId,
      name: parsed.data.name,
      templateId: parsed.data.templateId ?? null,
      channel: parsed.data.channel as NotificationChannel,
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
      audienceQuery: parsed.data.audience as never,
      scheduledAt,
      createdBy: ctx.session.user.id,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "CommunicationCampaign",
    entityId: campaign.id,
    module: "communication",
    description: `Scheduled ${parsed.data.channel} campaign "${parsed.data.name}" for ${scheduledAt.toISOString()}`,
    newData: campaign,
  });

  revalidatePath("/communication/campaigns");
  return { data: campaign };
}

export async function cancelCampaignAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SMS_SEND);
  if (denied) return denied;

  const existing = await db.communicationCampaign.findUnique({ where: { id } });
  if (!existing || existing.schoolId !== ctx.schoolId) {
    return { error: "Campaign not found." };
  }
  if (existing.status !== "SCHEDULED") {
    return {
      error:
        "Only SCHEDULED campaigns can be cancelled — this one has already started dispatching.",
    };
  }

  await db.communicationCampaign.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "CommunicationCampaign",
    entityId: id,
    module: "communication",
    description: `Cancelled campaign "${existing.name}"`,
    previousData: { status: existing.status },
    newData: { status: "CANCELLED" },
  });

  revalidatePath("/communication/campaigns");
  return { success: true };
}

export async function listCampaignsAction(params?: { status?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SMS_SEND);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (params?.status) where.status = params.status;

  const campaigns = await db.communicationCampaign.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
    take: 100,
  });

  return { data: campaigns };
}
