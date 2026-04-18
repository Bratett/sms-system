/**
 * Admissions module constants.
 * Kept module-local; promote to SystemSetting only if per-school overrides are needed.
 */

/** Days an ACCEPTED offer stays open before it auto-expires. */
export const DEFAULT_OFFER_EXPIRY_DAYS = 14;

/**
 * BECE aggregate thresholds for placement auto-admit and interview waiver.
 * Source: attached admissions doc §4.4 (auto-admit) + §4.3 (interview waivers).
 * BECE aggregate runs 6 (best) to 54 (worst).
 */
export const BECE_AUTO_ADMIT_MAX_AGGREGATE = 10;
export const BECE_INTERVIEW_WAIVER_MAX_AGGREGATE = 15;

/** Interview-equivalent score threshold for auto-acceptance (out of 10). */
export const AUTO_ACCEPT_SCORE_THRESHOLD = 9.0;

/** User ID sentinel for actions originating from the public portal. */
export const PUBLIC_PORTAL_ACTOR_ID = "PUBLIC_PORTAL";

/** User ID sentinel for system-driven decisions (e.g. auto-admit). */
export const SYSTEM_ACTOR_ID = "SYSTEM";

/** Standard fee-waiver reason for verified Free SHS / CSSPS placement students. */
export const FREE_SHS_FEE_WAIVER_REASON = "Free SHS placement student";

/** Interview scoring weights (must sum to 1.0). */
export const INTERVIEW_WEIGHTS = {
  academic: 0.4,
  behavioral: 0.35,
  parent: 0.25,
} as const;
