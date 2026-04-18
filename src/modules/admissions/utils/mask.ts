/**
 * PII-masking helpers for admissions identifiers.
 *
 * Enrollment codes and BECE index numbers are sensitive. Mask them when:
 *   - rendering in list views visible to users without
 *     `ADMISSIONS_VERIFY_PLACEMENT` / `ADMISSIONS_OVERRIDE`
 *   - exporting CSV/PDF that leaves the tenant boundary
 *   - logging for analytics
 *
 * Staff with the verification permission see the full value.
 *
 * All functions are pure and tolerant of null/undefined/short inputs so callers
 * can use them unconditionally.
 */

/**
 * Mask an enrollment code, keeping the first 3 and last 2 characters.
 *   "ABC123XYZ" → "ABC****YZ"
 *   "ENCODE123" → "ENC****23"
 * Short codes (≤ 6 chars) are returned as-is to avoid over-masking.
 */
export function maskEnrollmentCode(code: string | null | undefined): string {
  if (!code) return "—";
  const trimmed = code.trim();
  if (trimmed.length <= 6) return trimmed;
  const head = trimmed.slice(0, 3);
  const tail = trimmed.slice(-2);
  return `${head}${"*".repeat(4)}${tail}`;
}

/**
 * Mask a BECE index. Both 10-digit and 12-digit formats are supported.
 *   "0120045067"    → "01******67"
 *   "250120045067"  → "2501******67"
 */
export function maskBECEIndex(index: string | null | undefined): string {
  if (!index) return "—";
  const trimmed = index.trim();
  if (trimmed.length < 6) return trimmed;
  const prefixLen = trimmed.length === 12 ? 4 : 2;
  const head = trimmed.slice(0, prefixLen);
  const tail = trimmed.slice(-2);
  const stars = "*".repeat(Math.max(0, trimmed.length - prefixLen - 2));
  return `${head}${stars}${tail}`;
}

/**
 * Utility: apply either mask helper conditionally based on a canSee flag.
 * Reads nicely at call sites: `maskUnless(canSeeFull, enrollmentCode, maskEnrollmentCode)`.
 */
export function maskUnless<T>(
  canSeeFull: boolean,
  value: T,
  masker: (v: T) => string,
): string {
  if (canSeeFull) return value == null ? "—" : String(value);
  return masker(value);
}
