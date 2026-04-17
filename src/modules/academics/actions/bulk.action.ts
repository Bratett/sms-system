"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { computeTerminalResultsAction } from "./result.action";
import { computeAnnualResultsAction } from "./annual-result.action";
import { generateReportCardDataAction } from "./report-card.action";

// ─── Batch Compute Terminal Results ──────────────────────────────────

export async function batchComputeResultsAction(
  classArmIds: string[],
  termId: string,
  academicYearId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BULK_OPERATIONS);
  if (denied) return denied;

  const results: Array<{ classArmId: string; status: string; computed?: number; error?: string }> = [];

  for (const classArmId of classArmIds) {
    const result = await computeTerminalResultsAction(classArmId, termId, academicYearId);
    if ("error" in result) {
      results.push({ classArmId, status: "error", error: result.error });
    } else {
      results.push({ classArmId, status: "success", computed: result.data?.computed ?? 0 });
    }
  }

  const totalComputed = results.reduce((sum, r) => sum + (r.computed ?? 0), 0);
  const errorCount = results.filter((r) => r.status === "error").length;

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "TerminalResult",
    entityId: "batch",
    module: "academics",
    description: `Batch computed terminal results for ${classArmIds.length} class arm(s): ${totalComputed} students, ${errorCount} errors`,
    metadata: { classArmIds, termId, academicYearId, results },
  });

  return { data: { results, totalComputed, errorCount } };
}

// ─── Batch Compute Annual Results ────────────────────────────────────

export async function batchComputeAnnualResultsAction(
  classArmIds: string[],
  academicYearId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BULK_OPERATIONS);
  if (denied) return denied;

  const results: Array<{ classArmId: string; status: string; computed?: number; error?: string }> = [];

  for (const classArmId of classArmIds) {
    const result = await computeAnnualResultsAction(classArmId, academicYearId);
    if ("error" in result) {
      results.push({ classArmId, status: "error", error: result.error });
    } else {
      results.push({ classArmId, status: "success", computed: result.data?.computed ?? 0 });
    }
  }

  const totalComputed = results.reduce((sum, r) => sum + (r.computed ?? 0), 0);

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "AnnualResult",
    entityId: "batch",
    module: "academics",
    description: `Batch computed annual results for ${classArmIds.length} class arm(s): ${totalComputed} students`,
    metadata: { classArmIds, academicYearId, results },
  });

  return { data: { results, totalComputed } };
}

// ─── Batch Generate Report Cards ─────────────────────────────────────

export async function batchGenerateReportCardsAction(
  classArmIds: string[],
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BULK_OPERATIONS);
  if (denied) return denied;

  const allReportCards: any[] = [];
  const errors: string[] = [];

  for (const classArmId of classArmIds) {
    const terminalResults = await db.terminalResult.findMany({
      where: { classArmId, termId },
      orderBy: { classPosition: "asc" },
      select: { studentId: true },
    });

    for (const result of terminalResults) {
      const cardResult = await generateReportCardDataAction(result.studentId, termId);
      if ("error" in cardResult) {
        errors.push(cardResult.error);
      } else if (cardResult.data) {
        allReportCards.push(cardResult.data);
      }
    }
  }

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "ReportCard",
    entityId: "batch",
    module: "academics",
    description: `Batch generated ${allReportCards.length} report cards across ${classArmIds.length} class arm(s)`,
    metadata: { classArmIds, termId, count: allReportCards.length, errorCount: errors.length },
  });

  return { data: allReportCards, errors };
}

// ─── Batch Promote Students ──────────────────────────────────────────

export async function batchPromoteAction(
  classArmIds: string[],
  academicYearId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BULK_OPERATIONS);
  if (denied) return denied;

  let totalPromoted = 0;
  let totalRetained = 0;
  let totalGraduated = 0;
  const errors: string[] = [];

  for (const classArmId of classArmIds) {
    const classArm = await db.classArm.findUnique({
      where: { id: classArmId },
      include: { class: { select: { yearGroup: true } } },
    });

    if (!classArm) {
      errors.push(`Class arm ${classArmId} not found`);
      continue;
    }

    // Get promotion rule
    const rule = await db.promotionRule.findFirst({
      where: {
        schoolId: ctx.schoolId,
        isActive: true,
        OR: [
          { yearGroup: classArm.class.yearGroup },
          { yearGroup: null },
        ],
      },
    });

    const passAverage = rule?.passAverage ?? 40;
    const maxFailing = rule?.maxFailingSubjects ?? 3;
    const isGraduationYear = classArm.class.yearGroup === 3;

    // Get annual results or latest terminal result
    const annualResults = await db.annualResult.findMany({
      where: { classArmId, academicYearId },
      include: { subjectAnnualResults: true },
    });

    for (const ar of annualResults) {
      const avg = ar.averageScore ?? 0;
      const failCount = ar.subjectAnnualResults.filter(
        (sr) => (sr.averageScore ?? 0) < passAverage,
      ).length;

      let status: "PROMOTED" | "RETAINED" | "GRADUATED";
      if (isGraduationYear) {
        status = "GRADUATED";
      } else if (avg >= passAverage && failCount <= maxFailing) {
        status = "PROMOTED";
      } else {
        status = "RETAINED";
      }

      await db.annualResult.update({
        where: { id: ar.id },
        data: { promotionStatus: status },
      });

      // Update enrollment status
      await db.enrollment.updateMany({
        where: { studentId: ar.studentId, academicYearId, classArmId },
        data: { status: status === "PROMOTED" ? "PROMOTED" : status === "GRADUATED" ? "COMPLETED" : "ACTIVE" },
      });

      if (status === "PROMOTED") totalPromoted++;
      else if (status === "RETAINED") totalRetained++;
      else totalGraduated++;
    }
  }

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "Enrollment",
    entityId: "batch",
    module: "academics",
    description: `Batch promotion: ${totalPromoted} promoted, ${totalRetained} retained, ${totalGraduated} graduated`,
    metadata: { classArmIds, academicYearId, totalPromoted, totalRetained, totalGraduated },
  });

  return { data: { totalPromoted, totalRetained, totalGraduated, errors } };
}
