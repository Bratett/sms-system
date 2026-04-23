/**
 * Strips non-digits and returns the last 9 digits of the input phone number.
 * Returns null if fewer than 9 digits remain after stripping, or input is nullish.
 *
 * Ghana MSISDN is 9 digits; using the tail handles both local (024..) and
 * international (+233 24..) forms uniformly.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (phone == null) return null;
  const digits = phone.replace(/\D+/g, "");
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

/**
 * Standard Levenshtein edit distance (dynamic programming, O(m*n) space/time).
 * Caller is responsible for case-folding or any other normalisation.
 */
export function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,        // deletion
        dp[i]![j - 1]! + 1,        // insertion
        dp[i - 1]![j - 1]! + cost, // substitution
      );
    }
  }
  return dp[m]![n]!;
}

/**
 * Canonical name key for fuzzy matching: lowercased, trimmed, joined by "_".
 */
export function nameKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()}_${lastName.trim().toLowerCase()}`;
}

export type GuardianLite = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
};

export type MatchReason = "phone" | "email" | "name-fuzzy";

export type DuplicateMatch = {
  guardian: GuardianLite;
  reasons: MatchReason[];
};

const FUZZY_NAME_MAX_DISTANCE = 2;

/**
 * Returns matches from `existing` that are plausibly the same person as
 * `candidate`. Callers MUST pre-filter `existing` to the relevant school.
 *
 * Match rules (each fires independently; reasons list records which fired):
 * - "phone"       : normalised phone matches exactly
 * - "email"       : non-null emails match exactly (case-insensitive)
 * - "name-fuzzy"  : Levenshtein distance between canonical name keys <= 2
 *
 * Excludes self-match by id (safe to use during update flows where the
 * updated record appears in `existing`).
 */
export function findPotentialDuplicates(
  candidate: GuardianLite,
  existing: GuardianLite[],
): DuplicateMatch[] {
  const candPhone = normalizePhone(candidate.phone);
  const candEmail = candidate.email?.trim().toLowerCase() ?? null;
  const candNameKey = nameKey(candidate.firstName, candidate.lastName);

  const matches: DuplicateMatch[] = [];

  for (const g of existing) {
    if (g.id === candidate.id) continue;

    const reasons: MatchReason[] = [];

    // Phone match
    if (candPhone) {
      const gPhone = normalizePhone(g.phone);
      if (gPhone && gPhone === candPhone) reasons.push("phone");
    }

    // Email match
    if (candEmail && g.email) {
      if (g.email.trim().toLowerCase() === candEmail) reasons.push("email");
    }

    // Name fuzzy match
    const gNameKey = nameKey(g.firstName, g.lastName);
    if (levenshtein(candNameKey, gNameKey) <= FUZZY_NAME_MAX_DISTANCE) {
      reasons.push("name-fuzzy");
    }

    if (reasons.length > 0) {
      matches.push({ guardian: g, reasons });
    }
  }

  return matches;
}
