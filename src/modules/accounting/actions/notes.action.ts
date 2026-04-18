"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { mergeNotes, type NoteSection } from "@/modules/accounting/lib/notes-disclosures";

export async function getFinancialStatementNotesAction(opts?: { approvalDate?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE);
  if (permErr) return permErr;

  const school = await db.school.findUnique({
    where: { id: ctx.schoolId },
    select: { name: true, type: true },
  });

  const variables: Record<string, string> = {
    schoolName: school?.name ?? "the School",
    schoolType: school?.type?.replace("_", " ").toLowerCase() ?? "public secondary",
    approvalDate: opts?.approvalDate ?? new Date().toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" }),
  };

  const notes = mergeNotes(undefined, variables);
  return { data: { notes, school: { name: school?.name, type: school?.type } } };
}

/**
 * Overwrite one or more notes on a persisted FinancialReport. The overrides
 * are stored in the report's JSON `data.notes` object so subsequent viewers
 * see the finance officer's wording instead of the defaults.
 */
export async function updateFinancialStatementNotesAction(
  reportId: string,
  overrides: Partial<Record<NoteSection, string>>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE);
  if (permErr) return permErr;

  const report = await db.financialReport.findUnique({ where: { id: reportId } });
  if (!report) return { error: "Report not found" };
  if (report.schoolId !== ctx.schoolId) return { error: "Access denied" };

  const currentData = (report.data as Record<string, unknown>) ?? {};
  const nextData = { ...currentData, notes: { ...(currentData.notes as object ?? {}), ...overrides } };

  await db.financialReport.update({ where: { id: reportId }, data: { data: nextData } });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "FinancialReport",
    entityId: reportId,
    module: "accounting",
    description: `Updated ${Object.keys(overrides).length} note section(s) on report`,
    newData: { sections: Object.keys(overrides) },
  });

  return { data: { success: true } };
}
