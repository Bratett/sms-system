"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
// ─── Link Marks to Curriculum Standards ──────────────────────────────

/** @no-audit Derived tagging over already-audited marks; not a source-of-truth mutation. */
export async function linkMarkToStandardsAction(
  markId: string,
  standardIds: string[],
  proficiencies: string[],
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_READ);
  if (denied) return denied;

  if (standardIds.length !== proficiencies.length) {
    return { error: "Standards and proficiencies arrays must have same length." };
  }

  // Delete existing links for this mark
  await db.markStandardLink.deleteMany({ where: { markId } });

  // Create new links
  const links = await Promise.all(
    standardIds.map((standardId, i) =>
      db.markStandardLink.create({
        data: {
          schoolId: ctx.schoolId,
          markId,
          standardId,
          proficiency: proficiencies[i] as any,
        },
      }),
    ),
  );

  return { data: { linked: links.length } };
}

// ─── Compute Student Mastery ─────────────────────────────────────────

/** @no-audit Derived analytics over already-audited marks; computed, not authored. */
export async function computeStudentMasteryAction(
  studentId: string,
  academicYearId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_READ);
  if (denied) return denied;

  // Get all marks for this student/term
  const marks = await db.mark.findMany({
    where: { studentId, termId, academicYearId, status: "APPROVED" },
    select: { id: true },
  });

  const markIds = marks.map((m) => m.id);

  // Get all standard links for these marks
  const links = await db.markStandardLink.findMany({
    where: { markId: { in: markIds } },
  });

  if (links.length === 0) return { data: { computed: 0 } };

  // Group by standard and determine mastery
  const standardLinks = new Map<string, string[]>();
  for (const link of links) {
    if (!standardLinks.has(link.standardId)) {
      standardLinks.set(link.standardId, []);
    }
    standardLinks.get(link.standardId)!.push(link.proficiency);
  }

  // Proficiency levels ordered
  const proficiencyOrder = ["NOT_YET", "DEVELOPING", "APPROACHING", "MEETING", "EXCEEDING"];

  // Delete existing mastery records
  await db.studentStandardMastery.deleteMany({
    where: { studentId, termId },
  });

  let computed = 0;

  for (const [standardId, proficiencies] of standardLinks) {
    // Use the highest proficiency level among all linked marks
    let maxLevel = 0;
    for (const p of proficiencies) {
      const level = proficiencyOrder.indexOf(p);
      if (level > maxLevel) maxLevel = level;
    }

    await db.studentStandardMastery.create({
      data: {
        schoolId: ctx.schoolId,
        studentId,
        standardId,
        academicYearId,
        termId,
        proficiency: proficiencyOrder[maxLevel] as any,
        evidence: markIds,
      },
    });
    computed++;
  }

  return { data: { computed } };
}

// ─── Get Student Competency Report ───────────────────────────────────

export async function getStudentCompetencyReportAction(
  studentId: string,
  academicYearId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_READ);
  if (denied) return denied;

  const masteryRecords = await db.studentStandardMastery.findMany({
    where: { studentId, academicYearId },
    orderBy: { computedAt: "desc" },
  });

  if (masteryRecords.length === 0) return { data: [] };

  // Get standard details
  const standardIds = [...new Set(masteryRecords.map((m) => m.standardId))];
  const standards = await db.curriculumStandard.findMany({
    where: { id: { in: standardIds } },
    select: { id: true, code: true, subject: true, strand: true, subStrand: true, description: true },
  });
  const standardMap = new Map(standards.map((s) => [s.id, s]));

  const data = masteryRecords.map((m) => {
    const standard = standardMap.get(m.standardId);
    return {
      id: m.id,
      standardId: m.standardId,
      standardCode: standard?.code ?? "",
      subject: standard?.subject ?? "",
      strand: standard?.strand ?? "",
      subStrand: standard?.subStrand ?? "",
      description: standard?.description ?? "",
      proficiency: m.proficiency,
      termId: m.termId,
      computedAt: m.computedAt,
    };
  });

  // Group by subject for reporting
  const bySubject = new Map<string, typeof data>();
  for (const d of data) {
    if (!bySubject.has(d.subject)) bySubject.set(d.subject, []);
    bySubject.get(d.subject)!.push(d);
  }

  // Calculate mastery percentages per subject
  const proficiencyOrder = ["NOT_YET", "DEVELOPING", "APPROACHING", "MEETING", "EXCEEDING"];
  const report = Array.from(bySubject.entries()).map(([subject, standards]) => {
    const meetingOrAbove = standards.filter(
      (s) => proficiencyOrder.indexOf(s.proficiency) >= 3,
    ).length;

    return {
      subject,
      totalStandards: standards.length,
      meetingOrAbove,
      masteryPercentage: standards.length > 0
        ? Math.round((meetingOrAbove / standards.length) * 100)
        : 0,
      standards,
    };
  });

  return { data: report };
}
