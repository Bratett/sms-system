/**
 * Input sanitization helpers for security hardening.
 */

const HTML_TAG_REGEX = /<[^>]*>/g;

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|UNION|DECLARE)\b)/gi,
  /(--|;|\/\*|\*\/|xp_|sp_)/g,
  /('|")\s*(OR|AND)\s*('|")/gi,
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/gi,
];

const MAX_SEARCH_QUERY_LENGTH = 200;

const PATH_TRAVERSAL_CHARS = /[/\\:*?"<>|]/g;

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

/**
 * Strip all HTML tags from the input string.
 * Useful for preventing XSS when displaying user input.
 */
export function sanitizeHtml(input: string): string {
  return input.replace(HTML_TAG_REGEX, "").trim();
}

/**
 * Remove SQL injection patterns and enforce a max length on search queries.
 * This is a defense-in-depth measure alongside parameterized queries.
 */
export function sanitizeSearchQuery(input: string): string {
  let sanitized = input;

  for (const pattern of SQL_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Collapse multiple spaces left after removals
  sanitized = sanitized.replace(/\s{2,}/g, " ").trim();

  // Enforce max length
  if (sanitized.length > MAX_SEARCH_QUERY_LENGTH) {
    sanitized = sanitized.slice(0, MAX_SEARCH_QUERY_LENGTH);
  }

  return sanitized;
}

/**
 * Remove path traversal characters and sequences from a filename.
 * Prevents directory traversal attacks when handling file uploads.
 */
export function sanitizeFilename(input: string): string {
  let sanitized = input;

  // Remove path traversal sequences
  sanitized = sanitized.replace(/\.\.\//g, "");
  sanitized = sanitized.replace(/\.\.\\/g, "");

  // Remove dangerous characters
  sanitized = sanitized.replace(PATH_TRAVERSAL_CHARS, "");

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, "");

  // Fallback for empty filenames
  if (!sanitized) {
    return "unnamed";
  }

  return sanitized;
}

/**
 * Escape all regex special characters in a string.
 * Use this when building RegExp from user input to prevent ReDoS.
 */
export function escapeRegex(input: string): string {
  return input.replace(REGEX_SPECIAL_CHARS, "\\$&");
}
