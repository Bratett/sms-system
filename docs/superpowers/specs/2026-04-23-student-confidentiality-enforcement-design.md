# Role-Based Confidentiality Enforcement — Design

**Date:** 2026-04-23
**Author:** Product Engineering
**Status:** Approved
**Tier:** 2 — item #8 from the Students module review

## 1. Context

`MedicalRecord` and `CounselingRecord` both carry an `isConfidential: Boolean @default(true)` field in Prisma. The flag is stored faithfully but **never enforced**: anyone with the ordinary `MEDICAL_READ` or `COUNSELING_READ` permission sees every record, confidential or not. The UI shows a small "Confidential" badge but no access control follows. The review item flagged this as a latent compliance gap.

This spec closes the gap by (a) adding an access-control layer that distinguishes ordinary read from confidential read, (b) redacting confidential content for unauthorized users rather than hiding rows entirely, and (c) logging detail-view access to confidential records.

Disciplinary incidents also carry an `isConfidential` flag but are **out of scope** for this iteration (deferred per Q1 scope decision).

## 2. Scope

**In scope**
- `MedicalRecord` — list + detail action redaction, new confidential permission
- `CounselingRecord` — list + detail action redaction, new confidential permission
- New `school_nurse` role with a sensible permission bundle (closes the latent gap where `MEDICAL_CREATE` / `MEDICAL_UPDATE` are unassigned)
- Access logging via the existing `AuditLog` table (enum extension only)
- UI update to the existing `health-section.tsx` so redacted rows render distinctly from confidential-but-readable rows

**Out of scope**
- `DisciplinaryIncident` confidentiality enforcement (Tier 2 follow-up)
- A dedicated audit-log UI (Tier 3 item #10)
- Counseling student-profile UI (will adopt this feature's backend redaction automatically when built)
- Create/update gates on confidential records — confidentiality is defined by the owner at write time and never leaks content in the write paths, so redaction at read is the only missing layer

## 3. Architecture

**Approach: post-fetch redaction via a shared helper (Approach B).**

Each `get*Action` keeps its existing query, resolves a small capability object, and maps results through a pure redactor on the way out. Detail actions also write an `AuditLog` row describing the access (successful or denied).

The redactor is a pure function in `src/lib/confidential.ts` — no DB calls, no side effects — so it unit-tests independently of Prisma. The access logger wraps the existing `audit()` helper with the right shape.

**Data flow (list):**
1. Action asserts ordinary read permission; returns `{ error }` on denial
2. Action resolves `canReadConfidential` from session + specific permission
3. Action runs the existing Prisma query unchanged
4. Action maps each row through `redactMedicalRecord(r, canReadConfidential)` / `redactCounselingRecord`
5. No audit log entry — list scans are too noisy to be useful

**Data flow (detail):**
1. Same outer permission check
2. `findFirst` by `{ id, schoolId }`; return `{ error: "Record not found" }` if absent
3. Resolve `canReadConfidential`
4. If the record is confidential, write an `AuditLog` row (`action: VIEW`, `metadata: { isConfidential, denied }`)
5. Return the record passed through the redactor

## 4. Data Model

**No schema changes beyond two enum extensions:**

1. `AuditAction` enum in `prisma/schema/audit.prisma` gains a `VIEW` value. Migration: `add_audit_action_view` — single `ALTER TYPE` statement.
2. `UserRole` enum (wherever defined) gains `school_nurse`. Migration: `add_school_nurse_role` — single `ALTER TYPE` statement.

`MedicalRecord.isConfidential` and `CounselingRecord.isConfidential` already exist with `@default(true)`; reused as-is.

`AuditLog` already captures `userId`, `schoolId`, `action`, `entity`, `entityId`, `module`, `description`, `metadata`. Fully sufficient for this feature.

## 5. Permissions & Roles

**New permission constants** (`src/lib/permissions.ts`):
```ts
MEDICAL_CONFIDENTIAL_READ: "medical:records:confidential:read",
COUNSELING_CONFIDENTIAL_READ: "welfare:counseling:confidential:read",
```

**New `school_nurse` role bundle:**
```ts
school_nurse: [
  PERMISSIONS.STUDENTS_READ,
  PERMISSIONS.MEDICAL_CREATE,
  PERMISSIONS.MEDICAL_READ,
  PERMISSIONS.MEDICAL_UPDATE,
  PERMISSIONS.MEDICAL_CONFIDENTIAL_READ,
  PERMISSIONS.ANNOUNCEMENTS_READ,
],
```

**Grants to existing roles:**

| Permission | Granted to |
|---|---|
| `MEDICAL_CONFIDENTIAL_READ` | `school_nurse`, `headmaster` (super_admin inherits via `ALL_PERMISSIONS`) |
| `COUNSELING_CONFIDENTIAL_READ` | `guidance_counsellor`, `headmaster` (super_admin inherits) |

`guidance_counsellor` keeps its existing `COUNSELING_CREATE` / `COUNSELING_READ` / `COUNSELING_UPDATE` and gains `COUNSELING_CONFIDENTIAL_READ`. If `headmaster` lacks `MEDICAL_READ` / `COUNSELING_READ`, those are granted too so the headmaster isn't locked out of the outer gate before reaching the confidential check.

## 6. Shared Helper Module

New file **`src/lib/confidential.ts`** (~60 lines):

```ts
import type { Session } from "next-auth";
import { hasPermission } from "./permissions";
import { audit } from "./audit";

export type ConfidentialCapability = { canReadConfidential: boolean };

export function resolveConfidentialCapability(
  session: Session,
  permission: string,
): ConfidentialCapability {
  return { canReadConfidential: hasPermission(session, permission) };
}

// Pure redaction functions — no side effects.
// Short-circuit on non-confidential records so callers can blanket-map.

type MedicalLike = {
  id: string; studentId: string; date: Date; type: string;
  title: string; description: string; treatment: string | null;
  followUpDate: Date | null; isConfidential: boolean;
  attachmentKey: string | null; recordedBy: string;
  [k: string]: unknown;
};

export function redactMedicalRecord<T extends MedicalLike>(
  record: T, canRead: boolean,
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
  id: string; studentId: string; sessionDate: Date; type: string;
  summary: string; actionPlan: string | null; followUpDate: Date | null;
  isConfidential: boolean; counselorId: string; status: string;
  [k: string]: unknown;
};

export function redactCounselingRecord<T extends CounselingLike>(
  record: T, canRead: boolean,
): T {
  if (!record.isConfidential || canRead) return record;
  return {
    ...record,
    summary: "Confidential — restricted",
    actionPlan: null,
  };
}

export async function logConfidentialAccess(params: {
  userId: string;
  schoolId: string;
  entity: "MedicalRecord" | "CounselingRecord";
  entityId: string;
  isConfidential: boolean;
  denied: boolean;
  module: string;
}): Promise<void> {
  await audit({
    userId: params.userId,
    schoolId: params.schoolId,
    action: "VIEW",
    entity: params.entity,
    entityId: params.entityId,
    module: params.module,
    description: params.denied
      ? `Denied access to confidential ${params.entity}`
      : `Accessed confidential ${params.entity}`,
    metadata: { isConfidential: params.isConfidential, denied: params.denied },
  });
}
```

**Contract:** the redactor is always safe to call — it's a no-op for non-confidential records and for users with the permission. Callers don't branch; they just `.map(r => redact(r, canRead))`.

## 7. Server Actions

### `src/modules/student/actions/medical.action.ts`

**Modified: `getMedicalRecordsAction`**
- After the existing `assertPermission(MEDICAL_READ)` check, resolve `canReadConfidential` from `MEDICAL_CONFIDENTIAL_READ`.
- Existing Prisma query unchanged.
- Return `records.map(r => redactMedicalRecord(r, canReadConfidential))` instead of the raw list.
- No access log write.

**New: `getMedicalRecordAction(id: string)`**
- Require ordinary `MEDICAL_READ`; return `{ error: "Insufficient permissions" }` on denial.
- `findFirst({ where: { id, schoolId }, include: { student } })`; return `{ error: "Record not found" }` on null.
- Resolve `canReadConfidential`.
- If `record.isConfidential === true`: `await logConfidentialAccess({ ...ctx, entity: "MedicalRecord", entityId: id, isConfidential: true, denied: !canReadConfidential, module: "medical" })`.
- Return `{ data: redactMedicalRecord(record, canReadConfidential) }`.

### `src/modules/discipline/actions/counseling.action.ts`

Mirror structure: modified `getCounselingRecordsAction` + new `getCounselingRecordAction(id)`. Uses `COUNSELING_CONFIDENTIAL_READ` and `module: "welfare"`.

### Create/update actions

`createMedicalRecordAction`, `updateMedicalRecordAction`, `createCounselingRecordAction`, `updateCounselingRecordAction` are **not modified**. Their existing permission gates (`MEDICAL_CREATE` / `MEDICAL_UPDATE` / `COUNSELING_*`) suffice — the `school_nurse` role inherits the medical ones via the bundle in section 5.

## 8. Access Logging Policy

Per the Q4 decision:

| Event | Logged? | Why |
|---|---|---|
| List scan (any permission) | ❌ | Too noisy; every student-profile load would write rows |
| Detail view of confidential record, authorized | ✅ | Disclosure event worth reviewing |
| Detail view of confidential record, denied (redacted) | ✅ | Possible probing behavior |
| Detail view of non-confidential record | ❌ | Not a confidentiality event |
| Record-not-found on detail | ❌ | Nothing to correlate; avoids enabling ID enumeration |
| Outer permission denied (no `MEDICAL_READ`) | ❌ | User never reached the confidential check |

**Row shape** written to `AuditLog`:
```js
{
  userId:       <session.user.id>,
  schoolId:     <ctx.schoolId>,
  action:       "VIEW",
  entity:       "MedicalRecord" | "CounselingRecord",
  entityId:     <record.id>,
  module:       "medical" | "welfare",
  description:  "Accessed confidential MedicalRecord"
                // OR "Denied access to confidential MedicalRecord"
  metadata:     { isConfidential: true, denied: boolean }
}
```

**Failure mode:** `audit()` retries 3 times; if all fail it logs to stderr and returns. The detail action continues and returns the record. Surfacing the record to a legitimate user is more important than blocking on telemetry.

**Querying:** the existing audit infrastructure supports filtering by `action`, `entity`, `module`. No dedicated confidential-access UI in this feature; Tier 3 #10 (Audit Trail UI) can build a specific viewer.

## 9. UI Changes

**`src/app/(dashboard)/students/[id]/health-section.tsx`** — the only UI component in scope.

Current behavior: each medical record renders with a "Confidential" badge when `isConfidential: true` and always shows the `title`, `description`, `treatment`.

Changes:
- Detect redacted rows by checking `record.title === "Confidential — restricted"`.
- Redacted rows render with `opacity-60` and the message *"Access restricted — contact school nurse"* in place of description/treatment.
- "Confidential" badge retained; redacted rows also carry a secondary "Restricted" indicator so readable-but-confidential vs truly-redacted are visually distinguishable.
- No new route or detail page in this PR — `getMedicalRecordAction` is wired at the action layer but exposing a "View full details" button is deferred to avoid designing a denial-state modal in the same change.

**Counseling UI:** if a counseling section on the student profile exists, same pattern is applied. If no such component exists today, backend redaction + access logging land without UI work; any future counseling UI inherits the behavior automatically.

## 10. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| No session | `requireSchoolContext` returns `{ error: "Unauthorized" }`; actions propagate |
| Session but no `MEDICAL_READ` | `assertPermission` returns `{ error: "Insufficient permissions" }`; no audit entry |
| Record not found | `{ error: "Record not found" }`; no audit entry |
| Record not confidential | Full record returned; no audit entry |
| Confidential + authorized | Full record returned; audit `denied: false` |
| Confidential + unauthorized | Redacted record returned; audit `denied: true`; HTTP still 200-equivalent |
| `audit()` fails | stderr log; action continues normally |
| Concurrent delete during read | Prisma returns null → "not found" branch; no null-deref in redactor |
| Cross-tenant ID guess | `findFirst { where: { id, schoolId } }` filter prevents disclosure regardless of ID validity |

## 11. Testing Strategy

**Pure-function unit tests** (`tests/unit/lib/confidential.test.ts`, ~8 tests):
- `resolveConfidentialCapability` — with permission, without permission
- `redactMedicalRecord` — non-confidential unchanged, confidential+authorized unchanged, confidential+unauthorized stripped (title / description / treatment / attachmentKey), metadata preserved
- `redactCounselingRecord` — mirror (strips summary / actionPlan)
- `logConfidentialAccess` — writes correct shape, swallows audit failures

**Action-layer unit tests** (extending `tests/unit/student/medical.test.ts` and `tests/unit/discipline/counseling.test.ts`):
- List: full-return with confidential permission, redacted-return without
- Detail: authorized access → full record + audit `denied:false`; unauthorized → redacted + audit `denied:true`; non-confidential → full + no audit; not found → error + no audit

**Integration tests** (new `tests/integration/students/confidential-access.test.ts`, live DB):
- Seed `school_nurse`, `guidance_counsellor`, `form_master`/`class_teacher` users
- Seed 1 confidential + 1 non-confidential record of each type
- For each role, exercise list + detail; assert payload shape and audit rows
- Tenant isolation: confidential record from school B does not leak to school A user

**Audit coverage guardrail:** new read actions conditionally write audit entries. If the existing `tests/unit/guardrails/audit-coverage.test.ts` flags them, mark with `@no-audit` (the confidential access is logged via `logConfidentialAccess`, not the standard `audit()` on every call). Verify by integration test instead.

**Total new tests:** ~24.

## 12. Verification Plan

1. `npx vitest run` — all unit tests (existing + new) pass
2. `npm run test:students` — integration suite including new confidential-access test
3. `npx tsc --noEmit` — clean
4. `npm run lint` — no errors in new files
5. `npx prisma migrate dev` — both enum migrations (`VIEW`, `school_nurse`) apply cleanly without FK drift
6. Manual: seed a `school_nurse` user, sign in, visit a student profile with confidential medical records — see full content. Switch to a `class_teacher` user, visit same profile — see redacted rows with "Access restricted" message. Inspect `AuditLog` table: no rows for list scans, expected rows after any detail-view action (when that's exposed in a later PR).

## 13. Critical Files

- `prisma/schema/audit.prisma` — extend `AuditAction` enum
- `prisma/schema/user.prisma` (or equivalent) — extend `UserRole` enum with `school_nurse`
- `src/lib/permissions.ts` — new constants + `school_nurse` role + grants
- `src/lib/confidential.ts` — new shared module
- `src/modules/student/actions/medical.action.ts` — modify list, add detail
- `src/modules/discipline/actions/counseling.action.ts` — modify list, add detail
- `src/app/(dashboard)/students/[id]/health-section.tsx` — redacted-row UI
- `tests/unit/lib/confidential.test.ts` — new
- `tests/unit/student/medical.test.ts` — extend
- `tests/unit/discipline/counseling.test.ts` — extend
- `tests/integration/students/confidential-access.test.ts` — new
