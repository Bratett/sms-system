/**
 * Data Retention Policy Definitions
 *
 * Defines how long different data types should be retained,
 * and what action to take when the retention period expires.
 *
 * Ghana-specific considerations:
 * - Student academic records should be retained indefinitely (statutory requirement)
 * - Financial records: minimum 7 years
 * - Audit logs: minimum 5 years
 * - Temporary/operational data: can be cleaned up sooner
 */

export interface RetentionPolicy {
  entity: string;
  description: string;
  retentionDays: number;
  action: "delete" | "archive" | "anonymize";
  /** Prisma model name */
  model: string;
  /** Date field to check against */
  dateField: string;
  /** Additional where clause for targeting specific records */
  condition?: Record<string, unknown>;
}

export const RETENTION_POLICIES: RetentionPolicy[] = [
  // ─── Short-term (30-90 days) ─────────────────────────────────
  {
    entity: "SMS Logs (delivered/failed)",
    description: "Clean up delivered and failed SMS logs older than 90 days",
    retentionDays: 90,
    action: "delete",
    model: "smsLog",
    dateField: "createdAt",
    condition: { status: { in: ["DELIVERED", "FAILED"] } },
  },
  {
    entity: "Notifications (read)",
    description: "Remove read notifications older than 60 days",
    retentionDays: 60,
    action: "delete",
    model: "notification",
    dateField: "createdAt",
    condition: { isRead: true },
  },

  // ─── Medium-term (1-2 years) ─────────────────────────────────
  {
    entity: "Attendance Records",
    description: "Archive attendance records older than 2 years (keep aggregates)",
    retentionDays: 730,
    action: "archive",
    model: "attendanceRecord",
    dateField: "createdAt",
  },
  {
    entity: "Rejected Admission Applications",
    description: "Anonymize rejected applications after 1 year",
    retentionDays: 365,
    action: "anonymize",
    model: "admissionApplication",
    dateField: "updatedAt",
    condition: { status: { in: ["REJECTED", "CANCELLED"] } },
  },
  {
    entity: "Expired Announcements",
    description: "Delete expired announcements after 1 year",
    retentionDays: 365,
    action: "delete",
    model: "announcement",
    dateField: "expiresAt",
    condition: { status: "ARCHIVED" },
  },

  // ─── Long-term (5+ years) ────────────────────────────────────
  {
    entity: "Audit Logs",
    description: "Retain audit logs for minimum 5 years per compliance",
    retentionDays: 1825, // 5 years
    action: "archive",
    model: "auditLog",
    dateField: "timestamp",
  },

  // ─── Indefinite (never auto-delete) ──────────────────────────
  // Student academic records (TerminalResult, SubjectResult, Transcript)
  // Financial records (Payment, Receipt, StudentBill) - 7 year minimum
  // Graduation records
  // These are NOT included in retention policies — they are retained forever.
];

/**
 * Get all policies that should be enforced now.
 */
export function getActivePolicies(): RetentionPolicy[] {
  return RETENTION_POLICIES;
}

/**
 * Calculate the cutoff date for a given retention period.
 */
export function getCutoffDate(retentionDays: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}
