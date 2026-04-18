import { PERMISSIONS, type Permission } from "@/lib/permissions";
import {
  AUTO_ACCEPT_SCORE_THRESHOLD,
  BECE_AUTO_ADMIT_MAX_AGGREGATE,
} from "@/modules/admissions/constants";

export type DecisionType =
  | "ACCEPTED"
  | "CONDITIONAL_ACCEPT"
  | "WAITLISTED"
  | "REJECTED";

export interface DecisionAuthorityInput {
  decision: DecisionType;
  /** Interview total score 0–10 (preferred) or BECE-derived merit score. */
  score?: number | null;
  isPlacementStudent?: boolean;
  beceAggregate?: number | null;
}

export interface DecisionAuthorityResult {
  /** null when the system can auto-decide without any user approval. */
  requiredPermission: Permission | null;
  autoApproved: boolean;
  /** Human-readable rationale for the authority determination. */
  reason: string;
}

/**
 * Approval matrix from admissions doc §4.4, adapted to our permission keys.
 *
 *   Auto-accept (SYSTEM):
 *     - score ≥ 9.0  OR  verified placement with BECE aggregate ≤ 10
 *   Standard accept / waitlist:
 *     - ADMISSIONS_APPROVE
 *   Conditional accept / reject:
 *     - ADMISSIONS_OVERRIDE  (head-level)
 */
export function resolveDecisionAuthority(
  input: DecisionAuthorityInput,
): DecisionAuthorityResult {
  const { decision } = input;

  if (decision === "ACCEPTED") {
    // Auto-admit for excellent interview score
    if (typeof input.score === "number" && input.score >= AUTO_ACCEPT_SCORE_THRESHOLD) {
      return {
        requiredPermission: null,
        autoApproved: true,
        reason: `Auto-accepted: score ${input.score.toFixed(1)} ≥ ${AUTO_ACCEPT_SCORE_THRESHOLD}`,
      };
    }
    // Auto-admit for verified placement with top BECE band
    if (
      input.isPlacementStudent === true &&
      typeof input.beceAggregate === "number" &&
      input.beceAggregate <= BECE_AUTO_ADMIT_MAX_AGGREGATE
    ) {
      return {
        requiredPermission: null,
        autoApproved: true,
        reason: `Auto-accepted: placement student with BECE aggregate ${input.beceAggregate} ≤ ${BECE_AUTO_ADMIT_MAX_AGGREGATE}`,
      };
    }
    return {
      requiredPermission: PERMISSIONS.ADMISSIONS_APPROVE,
      autoApproved: false,
      reason: "Standard acceptance — admissions approval required",
    };
  }

  if (decision === "WAITLISTED") {
    return {
      requiredPermission: PERMISSIONS.ADMISSIONS_APPROVE,
      autoApproved: false,
      reason: "Waitlist — admissions approval required",
    };
  }

  // CONDITIONAL_ACCEPT and REJECTED both require head-level authority.
  return {
    requiredPermission: PERMISSIONS.ADMISSIONS_OVERRIDE,
    autoApproved: false,
    reason:
      decision === "REJECTED"
        ? "Rejection — head-of-admissions override required"
        : "Conditional acceptance — head-of-admissions override required",
  };
}

/**
 * Interview total-score calculator. Weights sum to 1.0 and come from
 * `constants.INTERVIEW_WEIGHTS`. All three sub-scores must be present; any
 * missing score means the interview is not yet ready for a decision.
 */
export function computeInterviewTotal(
  scores: { academic: number; behavioral: number; parent: number },
  weights = { academic: 0.4, behavioral: 0.35, parent: 0.25 },
): number {
  const total =
    scores.academic * weights.academic +
    scores.behavioral * weights.behavioral +
    scores.parent * weights.parent;
  // Round to 2 decimal places to match schema precision (Decimal 5,2).
  return Math.round(total * 100) / 100;
}
