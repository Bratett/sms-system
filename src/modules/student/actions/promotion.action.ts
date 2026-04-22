"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import {
  createPromotionRunSchema,
  updatePromotionRunItemSchema,
  bulkUpdatePromotionRunItemsSchema,
  revertPromotionRunSchema,
} from "../schemas/promotion.schema";
import { audit } from "@/lib/audit";

export async function getEligibleSourceArmsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const currentYear = await db.academicYear.findFirst({
    where: { schoolId: ctx.schoolId, isCurrent: true },
  });
  if (!currentYear) return { error: "No current academic year set." };

  const arms = await db.classArm.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "ACTIVE",
      class: { academicYearId: currentYear.id },
    },
    include: {
      class: { select: { name: true, yearGroup: true, academicYearId: true, programmeId: true } },
      _count: { select: { enrollments: { where: { status: "ACTIVE", academicYearId: currentYear.id } } } },
    },
    orderBy: [{ class: { yearGroup: "asc" } }, { name: "asc" }],
  });

  const drafts = await db.promotionRun.findMany({
    where: { schoolId: ctx.schoolId, sourceAcademicYearId: currentYear.id, status: "DRAFT" },
    select: { sourceClassArmId: true },
  });
  const draftArmIds = new Set(drafts.map((d) => d.sourceClassArmId));

  return { data: arms.filter((a) => !draftArmIds.has(a.id)) };
}

export async function listPromotionRunsAction(opts?: { status?: "DRAFT" | "COMMITTED" | "REVERTED"; academicYearId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const runs = await db.promotionRun.findMany({
    where: {
      schoolId: ctx.schoolId,
      ...(opts?.status && { status: opts.status }),
      ...(opts?.academicYearId && { sourceAcademicYearId: opts.academicYearId }),
    },
    include: {
      sourceClassArm: { include: { class: { select: { name: true, yearGroup: true } } } },
      sourceAcademicYear: { select: { name: true } },
      targetAcademicYear: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return { data: runs };
}

export async function getPromotionRunAction(runId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const run = await db.promotionRun.findFirst({
    where: { id: runId, schoolId: ctx.schoolId },
    include: {
      items: {
        include: {
          student: { select: { id: true, studentId: true, firstName: true, lastName: true, status: true } },
          destinationClassArm: { include: { class: { select: { name: true, yearGroup: true } } } },
        },
        orderBy: [{ student: { lastName: "asc" } }],
      },
      sourceClassArm: { include: { class: { select: { id: true, name: true, yearGroup: true, programmeId: true } } } },
      sourceAcademicYear: { select: { id: true, name: true } },
      targetAcademicYear: { select: { id: true, name: true } },
    },
  });
  if (!run) return { error: "Promotion run not found" };

  // Capacity rollup: count draft items per destination arm.
  const destIds = run.items.map((i) => i.destinationClassArmId).filter(Boolean) as string[];
  const destArms = destIds.length
    ? await db.classArm.findMany({
        where: { id: { in: destIds } },
        select: { id: true, capacity: true, _count: { select: { enrollments: { where: { status: "ACTIVE", academicYearId: run.targetAcademicYearId } } } } },
      })
    : [];
  const capacityByArm: Record<string, { capacity: number; existing: number; incoming: number }> = {};
  for (const a of destArms) {
    capacityByArm[a.id] = {
      capacity: a.capacity,
      existing: a._count.enrollments,
      incoming: run.items.filter((i) => i.destinationClassArmId === a.id).length,
    };
  }

  return { data: { ...run, capacityByArm } };
}

export async function createPromotionRunAction(input: { sourceClassArmId: string }) {
  const parsed = createPromotionRunSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const sourceArm = await db.classArm.findFirst({
    where: { id: parsed.data.sourceClassArmId, schoolId: ctx.schoolId },
    include: { class: { select: { academicYearId: true, yearGroup: true } } },
  });
  if (!sourceArm) return { error: "Source class arm not found in the current academic year" };

  const currentYear = await db.academicYear.findFirst({
    where: { id: sourceArm.class.academicYearId, schoolId: ctx.schoolId },
  });
  if (!currentYear) return { error: "Source class arm not found in the current academic year" };

  const targetYear = await db.academicYear.findFirst({
    where: { schoolId: ctx.schoolId, startDate: { gt: currentYear.startDate } },
    orderBy: { startDate: "asc" },
  });
  if (!targetYear) return { error: "No target academic year found. Create the next academic year first." };

  const existing = await db.promotionRun.findFirst({
    where: { sourceClassArmId: sourceArm.id, sourceAcademicYearId: currentYear.id, status: "DRAFT" },
  });
  if (existing) return { error: "A draft promotion run already exists for this class arm" };

  const run = await db.promotionRun.create({
    data: {
      schoolId: ctx.schoolId,
      sourceAcademicYearId: currentYear.id,
      targetAcademicYearId: targetYear.id,
      sourceClassArmId: sourceArm.id,
      createdBy: ctx.session.user.id!,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "PromotionRun",
    entityId: run.id,
    module: "students",
    description: `Created promotion run for classArm ${sourceArm.id}`,
  });

  return { data: run };
}

export async function seedPromotionRunItemsAction(runId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const run = await db.promotionRun.findFirst({
    where: { id: runId, schoolId: ctx.schoolId, status: "DRAFT" },
    include: { sourceClassArm: { include: { class: { select: { programmeId: true, yearGroup: true } } } } },
  });
  if (!run) return { error: "Promotion run not found or not in DRAFT status" };

  const enrollments = await db.enrollment.findMany({
    where: { classArmId: run.sourceClassArmId, academicYearId: run.sourceAcademicYearId, status: "ACTIVE" },
    include: { student: { select: { id: true, status: true } } },
  });

  const sourceYearGroup = run.sourceClassArm.class.yearGroup;
  const isFinalYear = sourceYearGroup >= 3;
  const sourceArmName = run.sourceClassArm.name;

  let destArmByDefault: string | null = null;
  if (!isFinalYear) {
    const targetClass = await db.class.findFirst({
      where: {
        schoolId: ctx.schoolId,
        academicYearId: run.targetAcademicYearId,
        programmeId: run.sourceClassArm.class.programmeId,
        yearGroup: sourceYearGroup + 1,
      },
      include: { classArms: { where: { status: "ACTIVE" } } },
    });
    if (!targetClass) {
      return { error: `Missing target-year class for programme yearGroup ${sourceYearGroup + 1}` };
    }
    const sameNamedArm = targetClass.classArms.find((a) => a.name === sourceArmName);
    destArmByDefault = sameNamedArm?.id ?? null;
  }

  const existing = await db.promotionRunItem.findMany({
    where: { runId },
    select: { studentId: true },
  });
  const existingIds = new Set(existing.map((e) => e.studentId));

  const toCreate = enrollments
    .filter((e) => !existingIds.has(e.studentId))
    .map((e) => ({
      runId,
      studentId: e.studentId,
      outcome: (isFinalYear ? "GRADUATE" : "PROMOTE") as "GRADUATE" | "PROMOTE",
      destinationClassArmId: isFinalYear ? null : destArmByDefault,
      previousEnrollmentId: e.id,
      previousStatus: e.student.status,
    }));

  if (toCreate.length > 0) {
    await db.promotionRunItem.createMany({ data: toCreate });

    await audit({
      userId: ctx.session.user.id!,
      action: "CREATE",
      entity: "PromotionRun",
      entityId: runId,
      module: "students",
      description: `Seeded ${toCreate.length} promotion run items`,
      metadata: { seeded: toCreate.length, skipped: enrollments.length - toCreate.length },
    });
  }

  return { data: { seeded: toCreate.length, skipped: enrollments.length - toCreate.length } };
}

export async function updatePromotionRunItemAction(input: {
  itemId: string;
  outcome?: "PROMOTE" | "RETAIN" | "GRADUATE" | "WITHDRAW";
  destinationClassArmId?: string | null;
  notes?: string;
}) {
  const parsed = updatePromotionRunItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const item = await db.promotionRunItem.findFirst({
    where: { id: parsed.data.itemId },
    include: { run: { select: { schoolId: true, status: true } } },
  });
  if (!item || item.run.schoolId !== ctx.schoolId) return { error: "Item not found" };
  if (item.run.status !== "DRAFT") return { error: "Run is no longer editable" };

  const data: Record<string, unknown> = {};
  if (parsed.data.outcome !== undefined) {
    data.outcome = parsed.data.outcome;
    if (parsed.data.outcome === "GRADUATE" || parsed.data.outcome === "WITHDRAW") {
      data.destinationClassArmId = null;
    }
  }
  if (parsed.data.destinationClassArmId !== undefined) {
    data.destinationClassArmId = parsed.data.destinationClassArmId;
  }
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  const updated = await db.promotionRunItem.update({ where: { id: parsed.data.itemId }, data });
  return { data: updated };
}

export async function bulkUpdatePromotionRunItemsAction(input: {
  runId: string;
  itemIds: string[];
  outcome?: "PROMOTE" | "RETAIN" | "GRADUATE" | "WITHDRAW";
  destinationClassArmId?: string | null;
}) {
  const parsed = bulkUpdatePromotionRunItemsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const run = await db.promotionRun.findFirst({
    where: { id: parsed.data.runId, schoolId: ctx.schoolId, status: "DRAFT" },
  });
  if (!run) return { error: "Run not found or not editable" };

  const data: Record<string, unknown> = {};
  if (parsed.data.outcome !== undefined) {
    data.outcome = parsed.data.outcome;
    if (parsed.data.outcome === "GRADUATE" || parsed.data.outcome === "WITHDRAW") {
      data.destinationClassArmId = null;
    }
  }
  if (parsed.data.destinationClassArmId !== undefined) {
    data.destinationClassArmId = parsed.data.destinationClassArmId;
  }

  const result = await db.promotionRunItem.updateMany({
    where: { id: { in: parsed.data.itemIds }, runId: parsed.data.runId },
    data,
  });
  return { data: { updated: result.count } };
}

export async function commitPromotionRunAction(runId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const result = await db.$transaction(async (tx) => {
    const run = await tx.promotionRun.findFirst({
      where: { id: runId, schoolId: ctx.schoolId },
      include: { items: true },
    });
    if (!run) return { error: "Run not found" as string };
    if (run.status !== "DRAFT") return { error: "Run is not in DRAFT status" as string };

    const commitDate = new Date();
    const counts = { PROMOTE: 0, RETAIN: 0, GRADUATE: 0, WITHDRAW: 0 };
    let skipped = 0;

    for (const item of run.items) {
      const prevEnrollment = await tx.enrollment.findUnique({ where: { id: item.previousEnrollmentId } });
      if (!prevEnrollment || prevEnrollment.status !== "ACTIVE") {
        skipped++;
        continue;
      }

      if (item.outcome === "PROMOTE" || item.outcome === "RETAIN") {
        if (!item.destinationClassArmId) {
          throw new Error(`Item ${item.id} has ${item.outcome} outcome but no destination arm`);
        }
        await tx.enrollment.update({
          where: { id: item.previousEnrollmentId },
          data: { status: "PROMOTED" },
        });
        const newEnrollment = await tx.enrollment.create({
          data: {
            studentId: item.studentId,
            classArmId: item.destinationClassArmId,
            schoolId: ctx.schoolId,
            academicYearId: run.targetAcademicYearId,
            isFreeShsPlacement: prevEnrollment.isFreeShsPlacement,
            previousClassArmId: prevEnrollment.classArmId,
          },
        });
        await tx.promotionRunItem.update({
          where: { id: item.id },
          data: { newEnrollmentId: newEnrollment.id },
        });
        counts[item.outcome]++;
      } else if (item.outcome === "GRADUATE") {
        await tx.enrollment.update({
          where: { id: item.previousEnrollmentId },
          data: { status: "COMPLETED" },
        });
        await tx.student.update({
          where: { id: item.studentId },
          data: { status: "GRADUATED" },
        });
        await tx.bedAllocation.updateMany({
          where: { studentId: item.studentId, vacatedAt: null },
          data: { vacatedAt: commitDate },
        });
        counts.GRADUATE++;
      } else if (item.outcome === "WITHDRAW") {
        await tx.enrollment.update({
          where: { id: item.previousEnrollmentId },
          data: { status: "WITHDRAWN" },
        });
        await tx.student.update({
          where: { id: item.studentId },
          data: { status: "WITHDRAWN" },
        });
        await tx.bedAllocation.updateMany({
          where: { studentId: item.studentId, vacatedAt: null },
          data: { vacatedAt: commitDate },
        });
        counts.WITHDRAW++;
      }
    }

    const committed = await tx.promotionRun.update({
      where: { id: runId },
      data: {
        status: "COMMITTED",
        committedAt: commitDate,
        committedBy: ctx.session.user.id!,
      },
    });

    return { data: { ...committed, counts, skipped } };
  });

  if ("error" in result) return result;

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "PromotionRun",
    entityId: runId,
    module: "students",
    description: `Committed promotion run`,
    newData: { status: "COMMITTED" },
    metadata: { counts: result.data.counts, skipped: result.data.skipped },
  });

  return result;
}

export async function deletePromotionRunAction(runId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const run = await db.promotionRun.findFirst({ where: { id: runId, schoolId: ctx.schoolId } });
  if (!run) return { error: "Run not found" };
  if (run.status !== "DRAFT") return { error: "Only DRAFT runs can be deleted" };

  await db.promotionRun.delete({ where: { id: runId } });
  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "PromotionRun",
    entityId: runId,
    module: "students",
    description: `Deleted draft promotion run`,
  });

  return { data: { deleted: true } };
}

const REVERT_GRACE_DAYS = 14;

export async function revertPromotionRunAction(input: { runId: string; reason: string }) {
  const parsed = revertPromotionRunSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const result = await db.$transaction(async (tx) => {
    const run = await tx.promotionRun.findFirst({
      where: { id: parsed.data.runId, schoolId: ctx.schoolId },
      include: { items: true },
    });
    if (!run) return { error: "Run not found" as string };
    if (run.status !== "COMMITTED") return { error: "Only COMMITTED runs can be reverted" as string };
    if (!run.committedAt) return { error: "Run missing commit timestamp" as string };

    const ageDays = (Date.now() - run.committedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > REVERT_GRACE_DAYS) {
      return { error: `Revert window has expired (${REVERT_GRACE_DAYS} days)` as string };
    }

    for (const item of run.items) {
      if (item.newEnrollmentId) {
        try {
          await tx.enrollment.delete({ where: { id: item.newEnrollmentId } });
        } catch {
          // enrollment may already be gone; proceed to restore previous state
        }
      }
      await tx.enrollment.update({
        where: { id: item.previousEnrollmentId },
        data: { status: "ACTIVE" },
      });
      await tx.student.update({
        where: { id: item.studentId },
        data: { status: item.previousStatus },
      });
    }

    const reverted = await tx.promotionRun.update({
      where: { id: parsed.data.runId },
      data: {
        status: "REVERTED",
        revertedAt: new Date(),
        revertedBy: ctx.session.user.id!,
        revertReason: parsed.data.reason,
      },
    });
    return { data: reverted };
  });

  if ("error" in result) return result;

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "PromotionRun",
    entityId: parsed.data.runId,
    module: "students",
    description: `Reverted promotion run: ${parsed.data.reason}`,
    newData: { status: "REVERTED" },
  });

  return result;
}
