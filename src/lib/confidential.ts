import { audit } from "./audit";

export type ConfidentialCapability = { canReadConfidential: boolean };

type SessionLike = {
  user?: { id?: string | null; permissions?: string[] };
} | null;

/**
 * Resolves whether the current session can read confidential records for a
 * specific permission. Returns `{ canReadConfidential: true }` when the user
 * holds the permission explicitly or has the `*` wildcard.
 */
export function resolveConfidentialCapability(
  session: SessionLike,
  permission: string,
): ConfidentialCapability {
  if (!session?.user?.id) return { canReadConfidential: false };
  const perms = session.user.permissions;
  if (!perms) return { canReadConfidential: false };
  return {
    canReadConfidential: perms.includes("*") || perms.includes(permission),
  };
}

type MedicalLike = {
  id: string;
  studentId: string;
  date: Date;
  type: string;
  title: string;
  description: string;
  treatment: string | null;
  followUpDate: Date | null;
  isConfidential: boolean;
  attachmentKey: string | null;
  recordedBy: string;
  [k: string]: unknown;
};

/**
 * Redacts sensitive fields on a MedicalRecord when it is confidential AND
 * the caller lacks read capability. For non-confidential or authorized
 * callers the record is returned by reference (safe no-op), so callers can
 * blanket-map every row without branching.
 */
export function redactMedicalRecord<T extends MedicalLike>(
  record: T,
  canRead: boolean,
): T {
  if (!record.isConfidential || canRead) return record;
  return {
    ...record,
    title: "Confidential — restricted",
    description: "",
    treatment: null,
    attachmentKey: null,
  };
}

type CounselingLike = {
  id: string;
  studentId: string;
  sessionDate: Date;
  type: string;
  summary: string;
  actionPlan: string | null;
  followUpDate: Date | null;
  isConfidential: boolean;
  counselorId: string;
  status: string;
  [k: string]: unknown;
};

/**
 * Redacts sensitive fields on a CounselingRecord. Same contract as
 * {@link redactMedicalRecord}.
 */
export function redactCounselingRecord<T extends CounselingLike>(
  record: T,
  canRead: boolean,
): T {
  if (!record.isConfidential || canRead) return record;
  return {
    ...record,
    summary: "Confidential — restricted",
    actionPlan: null,
  };
}

/**
 * Writes an AuditLog row describing access to a confidential record.
 * Swallows audit failures — callers should still return the record to the
 * legitimate user if the telemetry write fails. `audit()` itself retries 3x
 * before giving up (see src/lib/audit.ts).
 */
export async function logConfidentialAccess(params: {
  userId: string;
  schoolId: string;
  entity: "MedicalRecord" | "CounselingRecord";
  entityId: string;
  isConfidential: boolean;
  denied: boolean;
  module: string;
}): Promise<void> {
  try {
    await audit({
      userId: params.userId,
      schoolId: params.schoolId,
      action: "READ",
      entity: params.entity,
      entityId: params.entityId,
      module: params.module,
      description: params.denied
        ? `Denied access to confidential ${params.entity}`
        : `Accessed confidential ${params.entity}`,
      metadata: { isConfidential: params.isConfidential, denied: params.denied },
    });
  } catch {
    // audit() already logs to stderr after 3 retries; do not bubble up.
  }
}
