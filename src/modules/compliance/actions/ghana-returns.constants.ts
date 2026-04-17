/**
 * Plain constants module for Ghana statutory returns.
 *
 * Kept out of `ghana-returns.action.ts` because Next.js forbids non-async
 * exports from files marked `"use server"`. Re-exported by the action file
 * for call-site convenience.
 */

export const GHANA_RETURN_KINDS = [
  "PAYE",
  "SSNIT_TIER1",
  "SSNIT_TIER2",
  "GETFUND",
  "VAT",
  "GRA_CONSOLIDATED",
  "GES_ENROLLMENT",
  "GES_STAFFING",
  "GES_BECE_CANDIDATURE",
] as const;

export type GhanaReturnKind = (typeof GHANA_RETURN_KINDS)[number];
