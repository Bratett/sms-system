"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { executeDunningRun } from "@/lib/finance/dunning-engine";
import { revalidatePath } from "next/cache";
import {
  createDunningPolicySchema,
  updateDunningPolicySchema,
  runDunningSchema,
  type CreateDunningPolicyInput,
  type UpdateDunningPolicyInput,
  type RunDunningInput,
} from "../schemas/dunning.schema";

// parse helper removed — we call schema.safeParse directly below.

// ─── Policies ─────────────────────────────────────────────────────────

export async function listDunningPoliciesAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DUNNING_READ);
  if (denied) return denied;

  const policies = await db.dunningPolicy.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      stages: { orderBy: { order: "asc" } },
      _count: { select: { runs: true, cases: true } },
    },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });
  return { data: policies };
}

export async function getDunningPolicyAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DUNNING_READ);
  if (denied) return denied;
  const policy = await db.dunningPolicy.findFirst({
    where: { id, schoolId: ctx.schoolId },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!policy) return { error: "Policy not found" };
  return { data: policy };
}

export async function createDunningPolicyAction(input: CreateDunningPolicyInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DUNNING_MANAGE);
  if (denied) return denied;
  const parsed = createDunningPolicySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const created = await db.$transaction(async (tx) => {
    const policy = await tx.dunningPolicy.create({
      data: {
        schoolId: ctx.schoolId,
        name: data.name,
        description: data.description ?? null,
        scope: data.scope,
        programmeId: data.programmeId ?? null,
        feeStructureId: data.feeStructureId ?? null,
        boardingStatus: data.boardingStatus ?? null,
        minBalance: data.minBalance,
        suppressOnInstallment: data.suppressOnInstallment,
        suppressOnAid: data.suppressOnAid,
        isActive: data.isActive,
        createdBy: ctx.session.user.id,
      },
    });
    if (data.stages.length > 0) {
      await tx.dunningStage.createMany({
        data: data.stages.map((s) => ({
          policyId: policy.id,
          schoolId: ctx.schoolId,
          order: s.order,
          name: s.name,
          daysOverdue: s.daysOverdue,
          channels: s.channels,
          templateKey: s.templateKey ?? null,
          applyPenaltyId: s.applyPenaltyId ?? null,
          escalateToRole: s.escalateToRole ?? null,
          blockPortal: s.blockPortal,
        })),
      });
    }
    return policy;
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "DunningPolicy",
    entityId: created.id,
    module: "finance",
    description: `Created dunning policy "${data.name}"`,
    metadata: { stages: data.stages.length, scope: data.scope },
  });

  revalidatePath("/finance/dunning");
  return { data: created };
}

export async function updateDunningPolicyAction(input: UpdateDunningPolicyInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DUNNING_MANAGE);
  if (denied) return denied;
  const parsed = updateDunningPolicySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const existing = await db.dunningPolicy.findFirst({
    where: { id: data.id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Policy not found" };

  const updated = await db.$transaction(async (tx) => {
    const policy = await tx.dunningPolicy.update({
      where: { id: data.id },
      data: {
        name: data.name ?? undefined,
        description: data.description ?? undefined,
        scope: data.scope ?? undefined,
        programmeId: data.programmeId ?? undefined,
        feeStructureId: data.feeStructureId ?? undefined,
        boardingStatus: data.boardingStatus ?? undefined,
        minBalance: data.minBalance ?? undefined,
        suppressOnInstallment: data.suppressOnInstallment ?? undefined,
        suppressOnAid: data.suppressOnAid ?? undefined,
        isActive: data.isActive ?? undefined,
      },
    });
    if (data.stages) {
      await tx.dunningStage.deleteMany({ where: { policyId: policy.id } });
      await tx.dunningStage.createMany({
        data: data.stages.map((s) => ({
          policyId: policy.id,
          schoolId: ctx.schoolId,
          order: s.order,
          name: s.name,
          daysOverdue: s.daysOverdue,
          channels: s.channels,
          templateKey: s.templateKey ?? null,
          applyPenaltyId: s.applyPenaltyId ?? null,
          escalateToRole: s.escalateToRole ?? null,
          blockPortal: s.blockPortal ?? false,
        })),
      });
    }
    return policy;
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "DunningPolicy",
    entityId: updated.id,
    module: "finance",
    description: `Updated dunning policy "${updated.name}"`,
  });
  revalidatePath("/finance/dunning");
  return { data: updated };
}

export async function deleteDunningPolicyAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DUNNING_MANAGE);
  if (denied) return denied;

  const existing = await db.dunningPolicy.findFirst({
    where: { id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Policy not found" };

  await db.dunningPolicy.delete({ where: { id } });
  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "DunningPolicy",
    entityId: id,
    module: "finance",
    description: `Deleted dunning policy "${existing.name}"`,
  });
  revalidatePath("/finance/dunning");
  return { data: { ok: true } };
}

// ─── Runs ─────────────────────────────────────────────────────────────

export async function runDunningPolicyAction(input: RunDunningInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DUNNING_RUN);
  if (denied) return denied;
  const parsed = runDunningSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const policy = await db.dunningPolicy.findFirst({
    where: { id: data.policyId, schoolId: ctx.schoolId },
  });
  if (!policy) return { error: "Policy not found" };

  try {
    const result = await executeDunningRun(data.policyId, {
      triggeredBy: ctx.session.user.id,
      triggerType: data.triggerType,
      dryRun: data.dryRun,
    });
    await audit({
      userId: ctx.session.user.id,
      action: "UPDATE",
      entity: "DunningRun",
      entityId: result.runId,
      module: "finance",
      description: `Dunning run for "${policy.name}" — ${result.eventsSent} events, ${result.errors} errors`,
      metadata: { dryRun: data.dryRun, ...result },
    });
    revalidatePath("/finance/dunning");
    return { data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Run failed" };
  }
}

export async function listDunningRunsAction(policyId?: string, page = 1, pageSize = 25) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DUNNING_READ);
  if (denied) return denied;

  const where = { schoolId: ctx.schoolId, ...(policyId ? { policyId } : {}) };
  const [runs, total] = await Promise.all([
    db.dunningRun.findMany({
      where,
      include: { policy: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.dunningRun.count({ where }),
  ]);
  return { data: { runs, pagination: { page, pageSize, total } } };
}

export async function listDunningCasesAction(filters?: {
  policyId?: string;
  status?: "OPEN" | "ESCALATED" | "PAUSED" | "RESOLVED" | "CLOSED";
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DUNNING_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.policyId) where.policyId = filters.policyId;
  if (filters?.status) where.status = filters.status;

  const [cases, total] = await Promise.all([
    db.dunningCase.findMany({
      where,
      include: {
        policy: { select: { name: true } },
        events: { orderBy: { occurredAt: "desc" }, take: 5 },
      },
      orderBy: { lastActionAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.dunningCase.count({ where }),
  ]);
  return { data: { cases, pagination: { page, pageSize, total } } };
}

export async function closeDunningCaseAction(id: string, resolution: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DUNNING_MANAGE);
  if (denied) return denied;

  const existing = await db.dunningCase.findFirst({
    where: { id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Case not found" };

  const updated = await db.dunningCase.update({
    where: { id },
    data: {
      status: "CLOSED",
      resolvedAt: new Date(),
      resolution: resolution.slice(0, 120),
    },
  });
  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "DunningCase",
    entityId: id,
    module: "finance",
    description: `Closed dunning case with resolution "${resolution}"`,
  });
  revalidatePath("/finance/dunning");
  return { data: updated };
}
