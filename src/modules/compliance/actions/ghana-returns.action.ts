"use server";

import { z } from "zod";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { loadEmployerContext, missingIdentifiers } from "@/lib/compliance/ghana/context";
import { generatePayeReturn } from "@/lib/compliance/ghana/paye-return";
import {
  generateSsnitTier1Return,
  generateSsnitTier2Return,
} from "@/lib/compliance/ghana/ssnit-return";
import { generateGetFundReturn } from "@/lib/compliance/ghana/getfund-return";
import {
  generateVatReturn,
  generateGraConsolidatedReturn,
} from "@/lib/compliance/ghana/vat-return";
import { generateEnrollmentCensus } from "@/lib/compliance/ghana/ges/enrollment-census";
import { generateStaffingReturn } from "@/lib/compliance/ghana/ges/staffing-return";
import { generateBeceCandidature } from "@/lib/compliance/ghana/ges/bece-candidature";
import type { EmployerContext, StatutoryReturnPeriod } from "@/lib/compliance/ghana/types";
// Plain-module imports — Next.js disallows non-async exports from a
// "use server" file, so the kind list + type live in a sibling module.
import { GHANA_RETURN_KINDS, type GhanaReturnKind } from "./ghana-returns.constants";

/**
 * Server-facing wrappers over the Ghana return generators. Each call:
 *   1. Validates the caller's permission.
 *   2. Loads the employer context (school + statutory identifiers).
 *   3. Asserts the identifiers the specific return needs are present.
 *   4. Dispatches to the generator.
 *   5. Writes an audit row so compliance filings are always traceable.
 */

const requestSchema = z.object({
  kind: z.enum(GHANA_RETURN_KINDS),
  periodFrom: z.coerce.date(),
  periodTo: z.coerce.date(),
  label: z.string().min(1).max(100),
  academicYearId: z.string().optional(),
});

const REQUIREMENTS: Record<GhanaReturnKind, (keyof EmployerContext)[]> = {
  PAYE: ["tin"],
  SSNIT_TIER1: ["ssnitEmployerNumber"],
  SSNIT_TIER2: ["ssnitEmployerNumber"],
  GETFUND: ["getFundCode"],
  VAT: ["graVatTin"],
  GRA_CONSOLIDATED: ["tin"],
  GES_ENROLLMENT: ["ghanaEducationServiceCode"],
  GES_STAFFING: ["ghanaEducationServiceCode"],
  GES_BECE_CANDIDATURE: ["ghanaEducationServiceCode"],
};

export async function generateGhanaReturnAction(
  input: z.input<typeof requestSchema>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.COMPLIANCE_RETURN_GENERATE,
  );
  if (denied) return denied;

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const { kind, periodFrom, periodTo, label, academicYearId } = parsed.data;

  if (periodTo <= periodFrom) {
    return { error: "Period end must be after period start." };
  }

  const employer = await loadEmployerContext(ctx.schoolId);
  if (!employer) return { error: "School not found." };

  const missing = missingIdentifiers(employer, REQUIREMENTS[kind]);
  if (missing.length > 0) {
    return {
      error: "Missing statutory identifiers.",
      missing,
    };
  }

  const period: StatutoryReturnPeriod = { from: periodFrom, to: periodTo, label };

  let generated;
  switch (kind) {
    case "PAYE":
      generated = await generatePayeReturn(ctx.schoolId, employer, period);
      break;
    case "SSNIT_TIER1":
      generated = await generateSsnitTier1Return(ctx.schoolId, employer, period);
      break;
    case "SSNIT_TIER2":
      generated = await generateSsnitTier2Return(ctx.schoolId, employer, period);
      break;
    case "GETFUND":
      generated = await generateGetFundReturn(ctx.schoolId, employer, period);
      break;
    case "VAT":
      generated = await generateVatReturn(ctx.schoolId, employer, period);
      break;
    case "GRA_CONSOLIDATED":
      generated = await generateGraConsolidatedReturn(ctx.schoolId, employer, period);
      break;
    case "GES_ENROLLMENT":
      if (!academicYearId) return { error: "GES enrollment census needs an academicYearId." };
      generated = await generateEnrollmentCensus(
        ctx.schoolId,
        employer,
        period,
        academicYearId,
      );
      break;
    case "GES_STAFFING":
      generated = await generateStaffingReturn(ctx.schoolId, employer, period);
      break;
    case "GES_BECE_CANDIDATURE":
      if (!academicYearId) return { error: "BECE candidature needs an academicYearId." };
      generated = await generateBeceCandidature(
        ctx.schoolId,
        employer,
        period,
        academicYearId,
      );
      break;
  }

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "EXPORT",
    entity: "ComplianceReturn",
    module: "compliance",
    description: `Generated ${kind} return for ${label}`,
    metadata: {
      kind,
      periodFrom: periodFrom.toISOString(),
      periodTo: periodTo.toISOString(),
      rows: generated.rows.length,
    },
  });

  return { data: generated };
}
