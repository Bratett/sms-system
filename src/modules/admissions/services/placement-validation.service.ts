import { db } from "@/lib/db";
import {
  BECE_AUTO_ADMIT_MAX_AGGREGATE,
  BECE_INTERVIEW_WAIVER_MAX_AGGREGATE,
} from "@/modules/admissions/constants";

/**
 * Pure placement-validation helpers. No DB writes — callers handle persistence.
 *
 * Rules implemented here are a conservative subset of the DDD doc §4.1–§4.4:
 * format checks, duplicate-code detection, BECE→merit mapping, and auto-admit gating.
 * School-match + GES-API verification are intentionally deferred (we don't
 * maintain a per-school placement code in the schema yet; add a column or
 * SystemSetting before enabling that check).
 */

const ENROLLMENT_CODE_REGEX = /^[A-Za-z0-9]{6,}$/;
// Accepts the 10-digit BECE index number, or the 12-digit variant when the
// 2-digit year prefix is included. No slashes or other separators.
const BECE_INDEX_REGEX = /^(\d{10}|\d{12})$/;

export function validateEnrollmentCodeFormat(code: string | null | undefined): boolean {
  if (!code) return false;
  return ENROLLMENT_CODE_REGEX.test(code.trim());
}

export function validateBECEIndexFormat(index: string | null | undefined): boolean {
  if (!index) return false;
  return BECE_INDEX_REGEX.test(index.trim());
}

/**
 * Active application statuses that should block a second application sharing
 * the same enrollment code. Withdrawn/rejected slots allow re-application.
 */
const BLOCKING_DUPLICATE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PAYMENT_PENDING",
  "DOCUMENTS_PENDING",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "AWAITING_DECISION",
  "ACCEPTED",
  "CONDITIONAL_ACCEPT",
  "WAITLISTED",
  "ENROLLED",
] as const;

export interface DuplicateCheckResult {
  allowed: boolean;
  existingApplicationNumber?: string;
  reason?: string;
  warning?: string;
}

/**
 * Returns whether a new application may be submitted for this enrollment code.
 * Withdrawn/rejected/expired/cancelled previous attempts allow a fresh submission
 * (with a warning for staff visibility).
 */
export async function checkDuplicateEnrollmentCode(
  enrollmentCode: string,
  opts: { schoolId: string; academicYearId: string; excludeApplicationId?: string },
): Promise<DuplicateCheckResult> {
  const existing = await db.admissionApplication.findFirst({
    where: {
      schoolId: opts.schoolId,
      academicYearId: opts.academicYearId,
      enrollmentCode: enrollmentCode.trim(),
      ...(opts.excludeApplicationId ? { id: { not: opts.excludeApplicationId } } : {}),
    },
    select: { applicationNumber: true, status: true },
  });

  if (!existing) return { allowed: true };

  const isBlocking = BLOCKING_DUPLICATE_STATUSES.includes(
    existing.status as (typeof BLOCKING_DUPLICATE_STATUSES)[number],
  );

  if (isBlocking) {
    return {
      allowed: false,
      existingApplicationNumber: existing.applicationNumber,
      reason: `An active application (${existing.applicationNumber}) already exists for this enrollment code.`,
    };
  }

  return {
    allowed: true,
    existingApplicationNumber: existing.applicationNumber,
    warning: `A previous application (${existing.applicationNumber}, ${existing.status}) was found for this enrollment code.`,
  };
}

export interface PlacementValidationInput {
  enrollmentCode?: string | null;
  beceIndexNumber?: string | null;
  schoolId: string;
  academicYearId: string;
  excludeApplicationId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function validatePlacement(
  input: PlacementValidationInput,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!validateEnrollmentCodeFormat(input.enrollmentCode)) {
    errors.push("Enrollment code is missing or does not meet the 6+ alphanumeric format.");
  }

  if (!validateBECEIndexFormat(input.beceIndexNumber)) {
    errors.push(
      "BECE Index Number is missing or not 10 digits (or 12 digits including the 2-digit year prefix).",
    );
  }

  // Only check duplicates if formats are valid (otherwise the query is meaningless).
  if (input.enrollmentCode && validateEnrollmentCodeFormat(input.enrollmentCode)) {
    const dup = await checkDuplicateEnrollmentCode(input.enrollmentCode, {
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      excludeApplicationId: input.excludeApplicationId,
    });
    if (!dup.allowed && dup.reason) errors.push(dup.reason);
    if (dup.warning) warnings.push(dup.warning);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Map a BECE aggregate (6 = best, 54 = worst) to a 0–10 merit score
 * used when the interview is waived. Bands from attached doc §4.3.
 */
export function beceToMeritScore(aggregate: number): number {
  if (aggregate <= 6) return 10.0;
  if (aggregate <= 10) return 9.5;
  if (aggregate <= 15) return 8.5;
  if (aggregate <= 20) return 7.5;
  if (aggregate <= 25) return 6.5;
  if (aggregate <= 30) return 5.5;
  return 4.0;
}

export function isInterviewWaivable(aggregate: number | null | undefined): boolean {
  return typeof aggregate === "number" && aggregate <= BECE_INTERVIEW_WAIVER_MAX_AGGREGATE;
}

export interface AutoAdmitInput {
  isPlacementStudent: boolean;
  placementVerified: boolean;
  beceAggregate: number | null | undefined;
  documentsComplete: boolean;
  hasCapacity: boolean;
}

export interface AutoAdmitDecision {
  admit: boolean;
  reasons: string[];
}

/**
 * Decide whether a placement application qualifies for system auto-admission.
 * All conditions must hold; we collect negative reasons for audit/telemetry.
 */
export function shouldAutoAdmitPlacementStudent(input: AutoAdmitInput): AutoAdmitDecision {
  const reasons: string[] = [];

  if (!input.isPlacementStudent) reasons.push("not a placement application");
  if (!input.placementVerified) reasons.push("placement not verified");
  if (typeof input.beceAggregate !== "number") {
    reasons.push("BECE aggregate missing");
  } else if (input.beceAggregate > BECE_AUTO_ADMIT_MAX_AGGREGATE) {
    reasons.push(`BECE aggregate ${input.beceAggregate} above auto-admit threshold`);
  }
  if (!input.documentsComplete) reasons.push("documents incomplete");
  if (!input.hasCapacity) reasons.push("no capacity available");

  return { admit: reasons.length === 0, reasons };
}
