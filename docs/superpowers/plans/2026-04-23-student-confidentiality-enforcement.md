# Role-Based Confidentiality Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redact confidential `MedicalRecord` and `CounselingRecord` fields for users without the new `MEDICAL_CONFIDENTIAL_READ` / `COUNSELING_CONFIDENTIAL_READ` permissions, and write an `AuditLog` row each time a user opens (or is denied on) a confidential record's detail view.

**Architecture:** A shared pure-function helper (`src/lib/confidential.ts`) exposes a capability resolver, two redactors (medical/counseling), and an access logger that wraps the existing `audit()`. Each list action maps results through the redactor; each new detail action (`getMedicalRecordAction` / `getCounselingRecordAction`) additionally writes an `AuditLog` row when the target is confidential.

**Tech Stack:** Next.js 15 App Router server actions, Prisma on PostgreSQL, vitest + vitest-mock-extended, native HTML + tailwind (no shadcn/ui in this codebase).

**Spec reference:** `docs/superpowers/specs/2026-04-23-student-confidentiality-enforcement-design.md`

---

## File Structure

**New files**
- `src/lib/confidential.ts` — capability resolver, `redactMedicalRecord`, `redactCounselingRecord`, `logConfidentialAccess`
- `tests/unit/lib/confidential.test.ts` — pure-function unit tests
- `tests/unit/discipline/counseling.test.ts` — counseling action tests (file did not previously exist)
- `tests/integration/students/confidential-access.test.ts` — live-DB integration test

**Modified files**
- `src/lib/permissions.ts` — two new constants, `school_nurse` role bundle, grants, new `hasPermission` helper
- `src/modules/student/actions/medical.action.ts` — list returns redacted rows, new detail action
- `src/modules/discipline/actions/counseling.action.ts` — list returns redacted rows, new detail action
- `src/app/(dashboard)/students/[id]/health-section.tsx` — redacted-row rendering
- `tests/unit/student/medical.test.ts` — extend with confidentiality scenarios

**Not touched** (confirmed via context exploration)
- `prisma/schema/audit.prisma` — `AuditAction.READ` already exists; we reuse it (no enum migration)
- No Prisma enum for `UserRole`; roles live as a `Record<string, Permission[]>` map in `permissions.ts`
- `DisciplinaryIncident` confidentiality — out of scope (deferred to a future iteration)

---

## Task 1: Permissions — constants, hasPermission helper, role bundle, grants

**Files:**
- Modify: `src/lib/permissions.ts`

Subagents working on this task cannot rely on TDD because the existing permission helpers don't have individual unit tests. Verification is through `tsc` + the existing `tests/unit/auth/permissions.test.ts` guardrail.

### Step 1: Add the two new permission constants

Open `src/lib/permissions.ts`. Find the `// Medical` block (around line 404-407) and extend it:

```ts
  // Medical
  MEDICAL_CREATE: "medical:records:create",
  MEDICAL_READ: "medical:records:read",
  MEDICAL_UPDATE: "medical:records:update",
  MEDICAL_CONFIDENTIAL_READ: "medical:records:confidential:read",
```

Find the `// Counseling & Welfare` block (around line 394-402) and extend it:

```ts
  // Counseling & Welfare
  COUNSELING_CREATE: "welfare:counseling:create",
  COUNSELING_READ: "welfare:counseling:read",
  COUNSELING_UPDATE: "welfare:counseling:update",
  COUNSELING_CONFIDENTIAL_READ: "welfare:counseling:confidential:read",
```

### Step 2: Add the `school_nurse` role bundle

Find `DEFAULT_ROLE_PERMISSIONS` (around line 637). Locate the last defined role block (currently ends with `student: [...]` around line 1419-1425). Add the new `school_nurse` role before the closing `};` of the object:

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

### Step 3: Grant `MEDICAL_CONFIDENTIAL_READ` to headmaster

Search for `headmaster: [` in `DEFAULT_ROLE_PERMISSIONS`. The array starts around line 639. Find the last entry in the headmaster array (it's long — scroll to just before the closing `]`) and append:

```ts
    PERMISSIONS.MEDICAL_READ,
    PERMISSIONS.MEDICAL_CONFIDENTIAL_READ,
    PERMISSIONS.COUNSELING_READ,
    PERMISSIONS.COUNSELING_CONFIDENTIAL_READ,
```

Check first whether `MEDICAL_READ` / `COUNSELING_READ` already appear in the headmaster array. If they do, add only the two `_CONFIDENTIAL_READ` entries. If not, add all four.

### Step 4: Grant `COUNSELING_CONFIDENTIAL_READ` to guidance_counsellor

Search for `guidance_counsellor: [`. Find the closing `]` of that array and, immediately before it, add:

```ts
    PERMISSIONS.COUNSELING_CONFIDENTIAL_READ,
```

### Step 5: Verify

Run: `npx tsc --noEmit`
Expected: clean (no type errors).

Run: `npx vitest run tests/unit/auth/permissions.test.ts`
Expected: all tests pass (existing tests shouldn't regress; the new permission constants and role bundle are additive).

### Step 6: Commit

```bash
git add src/lib/permissions.ts
git commit -m "feat(confidentiality): add MEDICAL_CONFIDENTIAL_READ + COUNSELING_CONFIDENTIAL_READ + school_nurse role"
```

---

## Task 2: Shared helper module with TDD

**Files:**
- Create: `src/lib/confidential.ts`
- Create: `tests/unit/lib/confidential.test.ts`

### Step 1: Write failing tests

Create `tests/unit/lib/confidential.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { audit } from "@/lib/audit";
import {
  resolveConfidentialCapability,
  redactMedicalRecord,
  redactCounselingRecord,
  logConfidentialAccess,
} from "@/lib/confidential";

// audit() is globally mocked in tests/unit/setup.ts

const baseMedical = {
  id: "med-1",
  studentId: "s-1",
  date: new Date("2026-03-01"),
  type: "TREATMENT",
  title: "Allergic Reaction",
  description: "Student had a reaction to peanuts",
  treatment: "Antihistamine administered",
  followUpDate: new Date("2026-03-08"),
  isConfidential: true,
  attachmentKey: "medical/med-1/photo.jpg",
  recordedBy: "nurse-1",
};

const baseCounseling = {
  id: "cns-1",
  studentId: "s-1",
  sessionDate: new Date("2026-03-01"),
  type: "INDIVIDUAL",
  summary: "Student disclosed family issues",
  actionPlan: "Weekly check-in for 4 weeks",
  followUpDate: new Date("2026-03-08"),
  isConfidential: true,
  counselorId: "counselor-1",
  status: "OPEN",
};

describe("resolveConfidentialCapability", () => {
  it("returns canReadConfidential: true when session has the permission", () => {
    const session = {
      user: { id: "u1", permissions: ["medical:records:confidential:read"] },
    };
    const cap = resolveConfidentialCapability(session, "medical:records:confidential:read");
    expect(cap.canReadConfidential).toBe(true);
  });

  it("returns canReadConfidential: true when session has the '*' wildcard", () => {
    const session = { user: { id: "u1", permissions: ["*"] } };
    const cap = resolveConfidentialCapability(session, "medical:records:confidential:read");
    expect(cap.canReadConfidential).toBe(true);
  });

  it("returns canReadConfidential: false when session lacks the permission", () => {
    const session = { user: { id: "u1", permissions: ["medical:records:read"] } };
    const cap = resolveConfidentialCapability(session, "medical:records:confidential:read");
    expect(cap.canReadConfidential).toBe(false);
  });

  it("returns canReadConfidential: false for null session", () => {
    const cap = resolveConfidentialCapability(null, "medical:records:confidential:read");
    expect(cap.canReadConfidential).toBe(false);
  });
});

describe("redactMedicalRecord", () => {
  it("returns record unchanged when not confidential", () => {
    const input = { ...baseMedical, isConfidential: false };
    expect(redactMedicalRecord(input, false)).toBe(input);
  });

  it("returns record unchanged when canRead is true, even if confidential", () => {
    expect(redactMedicalRecord(baseMedical, true)).toBe(baseMedical);
  });

  it("strips sensitive fields when confidential and canRead is false", () => {
    const result = redactMedicalRecord(baseMedical, false);
    expect(result.title).toBe("Confidential — restricted");
    expect(result.description).toBe("");
    expect(result.treatment).toBeNull();
    expect(result.attachmentKey).toBeNull();
  });

  it("preserves metadata fields when redacting", () => {
    const result = redactMedicalRecord(baseMedical, false);
    expect(result.id).toBe(baseMedical.id);
    expect(result.studentId).toBe(baseMedical.studentId);
    expect(result.date).toBe(baseMedical.date);
    expect(result.type).toBe(baseMedical.type);
    expect(result.followUpDate).toBe(baseMedical.followUpDate);
    expect(result.isConfidential).toBe(true);
    expect(result.recordedBy).toBe(baseMedical.recordedBy);
  });
});

describe("redactCounselingRecord", () => {
  it("returns record unchanged when not confidential", () => {
    const input = { ...baseCounseling, isConfidential: false };
    expect(redactCounselingRecord(input, false)).toBe(input);
  });

  it("returns record unchanged when canRead is true, even if confidential", () => {
    expect(redactCounselingRecord(baseCounseling, true)).toBe(baseCounseling);
  });

  it("strips summary and actionPlan when confidential and canRead is false", () => {
    const result = redactCounselingRecord(baseCounseling, false);
    expect(result.summary).toBe("Confidential — restricted");
    expect(result.actionPlan).toBeNull();
  });

  it("preserves metadata fields when redacting", () => {
    const result = redactCounselingRecord(baseCounseling, false);
    expect(result.id).toBe(baseCounseling.id);
    expect(result.sessionDate).toBe(baseCounseling.sessionDate);
    expect(result.type).toBe(baseCounseling.type);
    expect(result.counselorId).toBe(baseCounseling.counselorId);
    expect(result.status).toBe(baseCounseling.status);
    expect(result.followUpDate).toBe(baseCounseling.followUpDate);
  });
});

describe("logConfidentialAccess", () => {
  beforeEach(() => {
    vi.mocked(audit).mockClear();
    vi.mocked(audit).mockResolvedValue(undefined);
  });

  it("writes audit row with description for authorized access", async () => {
    await logConfidentialAccess({
      userId: "u1",
      schoolId: "school-1",
      entity: "MedicalRecord",
      entityId: "med-1",
      isConfidential: true,
      denied: false,
      module: "medical",
    });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        schoolId: "school-1",
        action: "READ",
        entity: "MedicalRecord",
        entityId: "med-1",
        module: "medical",
        description: "Accessed confidential MedicalRecord",
        metadata: { isConfidential: true, denied: false },
      }),
    );
  });

  it("writes audit row with denial description when denied", async () => {
    await logConfidentialAccess({
      userId: "u2",
      schoolId: "school-1",
      entity: "CounselingRecord",
      entityId: "cns-9",
      isConfidential: true,
      denied: true,
      module: "welfare",
    });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "READ",
        entity: "CounselingRecord",
        entityId: "cns-9",
        module: "welfare",
        description: "Denied access to confidential CounselingRecord",
        metadata: { isConfidential: true, denied: true },
      }),
    );
  });

  it("does not throw when audit throws internally", async () => {
    vi.mocked(audit).mockRejectedValueOnce(new Error("db down"));
    await expect(
      logConfidentialAccess({
        userId: "u1",
        schoolId: "school-1",
        entity: "MedicalRecord",
        entityId: "med-1",
        isConfidential: true,
        denied: false,
        module: "medical",
      }),
    ).resolves.toBeUndefined();
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/lib/confidential.test.ts`
Expected: fail — module not found.

### Step 3: Implement

Create `src/lib/confidential.ts`:

```ts
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
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/lib/confidential.test.ts`
Expected: 14 tests passing (4 capability + 4 redact medical + 4 redact counseling + 3 access log).

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Commit

```bash
git add src/lib/confidential.ts tests/unit/lib/confidential.test.ts
git commit -m "feat(confidentiality): shared redaction helpers + access logger"
```

---

## Task 3: Medical action changes (list redaction + new detail action)

**Files:**
- Modify: `src/modules/student/actions/medical.action.ts`
- Modify: `tests/unit/student/medical.test.ts`

### Step 1: Add new test cases

Open `tests/unit/student/medical.test.ts`. At the top, extend the imports:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { audit } from "@/lib/audit";
import {
  createMedicalRecordAction,
  getMedicalRecordsAction,
  getMedicalRecordAction,
  updateMedicalRecordAction,
} from "@/modules/student/actions/medical.action";
```

Append these new test blocks at the end of the file:

```ts
// ─── getMedicalRecordsAction redaction ─────────────────────────────

describe("getMedicalRecordsAction redaction", () => {
  const confidentialRecord = {
    id: "med-1",
    schoolId: "default-school",
    studentId: "s-1",
    recordedBy: "nurse-1",
    date: new Date("2026-03-01"),
    type: "TREATMENT",
    title: "Allergic Reaction",
    description: "Peanut exposure",
    treatment: "Antihistamine",
    followUpDate: null,
    isConfidential: true,
    attachmentKey: "medical/med-1/photo.jpg",
    student: { firstName: "A", lastName: "B", studentId: "SCH/0001" },
  };
  const publicRecord = {
    id: "med-2",
    schoolId: "default-school",
    studentId: "s-1",
    recordedBy: "nurse-1",
    date: new Date("2026-03-02"),
    type: "CHECKUP",
    title: "Annual Checkup",
    description: "Routine",
    treatment: null,
    followUpDate: null,
    isConfidential: false,
    attachmentKey: null,
    student: { firstName: "A", lastName: "B", studentId: "SCH/0001" },
  };

  it("returns full content when the user has MEDICAL_CONFIDENTIAL_READ", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read", "medical:records:confidential:read"] });
    prismaMock.medicalRecord.findMany.mockResolvedValue([confidentialRecord, publicRecord] as never);
    prismaMock.medicalRecord.count.mockResolvedValue(2 as never);

    const result = await getMedicalRecordsAction();
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data[0]!.title).toBe("Allergic Reaction");
    expect(result.data[0]!.description).toBe("Peanut exposure");
    expect(result.data[0]!.treatment).toBe("Antihistamine");
    expect(result.data[0]!.attachmentKey).toBe("medical/med-1/photo.jpg");
  });

  it("redacts confidential rows when the user lacks MEDICAL_CONFIDENTIAL_READ", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read"] });
    prismaMock.medicalRecord.findMany.mockResolvedValue([confidentialRecord, publicRecord] as never);
    prismaMock.medicalRecord.count.mockResolvedValue(2 as never);

    const result = await getMedicalRecordsAction();
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data[0]!.title).toBe("Confidential — restricted");
    expect(result.data[0]!.description).toBe("");
    expect(result.data[0]!.treatment).toBeNull();
    expect(result.data[0]!.attachmentKey).toBeNull();
    expect(result.data[0]!.isConfidential).toBe(true);
    expect(result.data[0]!.type).toBe("TREATMENT");
    // Non-confidential row is untouched
    expect(result.data[1]!.title).toBe("Annual Checkup");
    expect(result.data[1]!.description).toBe("Routine");
  });
});

// ─── getMedicalRecordAction (detail) ──────────────────────────────

describe("getMedicalRecordAction", () => {
  beforeEach(() => {
    vi.mocked(audit).mockClear();
    vi.mocked(audit).mockResolvedValue(undefined);
  });

  const confidentialRecord = {
    id: "med-1",
    schoolId: "default-school",
    studentId: "s-1",
    recordedBy: "nurse-1",
    date: new Date("2026-03-01"),
    type: "TREATMENT",
    title: "Allergic Reaction",
    description: "Peanut exposure",
    treatment: "Antihistamine",
    followUpDate: null,
    isConfidential: true,
    attachmentKey: null,
    student: { firstName: "A", lastName: "B", studentId: "SCH/0001" },
  };

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMedicalRecordAction("med-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects users lacking MEDICAL_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getMedicalRecordAction("med-1");
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("returns { error: 'Record not found' } when findFirst returns null", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read"] });
    prismaMock.medicalRecord.findFirst.mockResolvedValue(null as never);
    const result = await getMedicalRecordAction("med-1");
    expect(result).toEqual({ error: "Record not found" });
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });

  it("returns full record + writes audit log when authorized on confidential", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read", "medical:records:confidential:read"] });
    prismaMock.medicalRecord.findFirst.mockResolvedValue(confidentialRecord as never);

    const result = await getMedicalRecordAction("med-1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.title).toBe("Allergic Reaction");
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "READ",
        entity: "MedicalRecord",
        entityId: "med-1",
        module: "medical",
        metadata: { isConfidential: true, denied: false },
      }),
    );
  });

  it("returns redacted record + writes denial audit log when unauthorized on confidential", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read"] });
    prismaMock.medicalRecord.findFirst.mockResolvedValue(confidentialRecord as never);

    const result = await getMedicalRecordAction("med-1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.title).toBe("Confidential — restricted");
    expect(result.data.description).toBe("");
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "READ",
        entity: "MedicalRecord",
        entityId: "med-1",
        metadata: { isConfidential: true, denied: true },
      }),
    );
  });

  it("does not write audit log when record is not confidential", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read"] });
    const publicRecord = { ...confidentialRecord, id: "med-2", isConfidential: false };
    prismaMock.medicalRecord.findFirst.mockResolvedValue(publicRecord as never);

    const result = await getMedicalRecordAction("med-2");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.title).toBe("Allergic Reaction");
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/student/medical.test.ts`
Expected: 8 new tests fail — `getMedicalRecordAction` is not exported yet, and list tests fail because redaction is not applied.

### Step 3: Implement action changes

Open `src/modules/student/actions/medical.action.ts`. Extend the imports at the top:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  resolveConfidentialCapability,
  redactMedicalRecord,
  logConfidentialAccess,
} from "@/lib/confidential";
```

Replace the body of `getMedicalRecordsAction` (currently around lines 56-90). Keep the existing signature; modify only the return:

```ts
export async function getMedicalRecordsAction(filters?: {
  studentId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_READ);
  if (denied) return denied;

  const { canReadConfidential } = resolveConfidentialCapability(
    ctx.session,
    PERMISSIONS.MEDICAL_CONFIDENTIAL_READ,
  );

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.type) where.type = filters.type;

  const [records, total] = await Promise.all([
    db.medicalRecord.findMany({
      where,
      include: { student: { select: { firstName: true, lastName: true, studentId: true } } },
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
    }),
    db.medicalRecord.count({ where }),
  ]);

  return {
    data: records.map((r) => redactMedicalRecord(r, canReadConfidential)),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
```

Append the new detail action at the end of the file (after `updateMedicalRecordAction`):

```ts
// ─── Get Single Medical Record (with access logging) ──────────────

/**
 * Fetches a single medical record by id. Writes an audit log entry when the
 * record is confidential (for both authorized and denied access). Redacts
 * sensitive fields when the caller lacks MEDICAL_CONFIDENTIAL_READ.
 */
export async function getMedicalRecordAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_READ);
  if (denied) return denied;

  const record = await db.medicalRecord.findFirst({
    where: { id, schoolId: ctx.schoolId },
    include: { student: { select: { firstName: true, lastName: true, studentId: true } } },
  });
  if (!record) return { error: "Record not found" };

  const { canReadConfidential } = resolveConfidentialCapability(
    ctx.session,
    PERMISSIONS.MEDICAL_CONFIDENTIAL_READ,
  );

  if (record.isConfidential) {
    await logConfidentialAccess({
      userId: ctx.session.user.id!,
      schoolId: ctx.schoolId,
      entity: "MedicalRecord",
      entityId: record.id,
      isConfidential: true,
      denied: !canReadConfidential,
      module: "medical",
    });
  }

  return { data: redactMedicalRecord(record, canReadConfidential) };
}
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/student/medical.test.ts`
Expected: all tests pass (existing + 8 new).

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Commit

```bash
git add src/modules/student/actions/medical.action.ts tests/unit/student/medical.test.ts
git commit -m "feat(confidentiality): redact medical records + add detail action with access logging"
```

---

## Task 4: Counseling action changes (list redaction + new detail action)

**Files:**
- Modify: `src/modules/discipline/actions/counseling.action.ts`
- Create: `tests/unit/discipline/counseling.test.ts`

### Step 1: Write the counseling test file

Create `tests/unit/discipline/counseling.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { audit } from "@/lib/audit";
import {
  getCounselingRecordsAction,
  getCounselingRecordAction,
} from "@/modules/discipline/actions/counseling.action";

const confidentialRecord = {
  id: "cns-1",
  schoolId: "default-school",
  studentId: "s-1",
  counselorId: "counselor-1",
  sessionDate: new Date("2026-03-01"),
  type: "INDIVIDUAL",
  summary: "Family issues",
  actionPlan: "Weekly check-in",
  followUpDate: null,
  isConfidential: true,
  status: "OPEN",
};
const publicRecord = {
  id: "cns-2",
  schoolId: "default-school",
  studentId: "s-1",
  counselorId: "counselor-1",
  sessionDate: new Date("2026-03-02"),
  type: "GROUP",
  summary: "Career guidance",
  actionPlan: null,
  followUpDate: null,
  isConfidential: false,
  status: "CLOSED",
};

describe("getCounselingRecordsAction redaction", () => {
  it("returns full content when the user has COUNSELING_CONFIDENTIAL_READ", async () => {
    mockAuthenticatedUser({
      permissions: ["welfare:counseling:read", "welfare:counseling:confidential:read"],
    });
    prismaMock.counselingRecord.findMany.mockResolvedValue([confidentialRecord, publicRecord] as never);
    prismaMock.counselingRecord.count.mockResolvedValue(2 as never);

    const result = await getCounselingRecordsAction();
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data[0]!.summary).toBe("Family issues");
    expect(result.data[0]!.actionPlan).toBe("Weekly check-in");
  });

  it("redacts confidential rows when the user lacks COUNSELING_CONFIDENTIAL_READ", async () => {
    mockAuthenticatedUser({ permissions: ["welfare:counseling:read"] });
    prismaMock.counselingRecord.findMany.mockResolvedValue([confidentialRecord, publicRecord] as never);
    prismaMock.counselingRecord.count.mockResolvedValue(2 as never);

    const result = await getCounselingRecordsAction();
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data[0]!.summary).toBe("Confidential — restricted");
    expect(result.data[0]!.actionPlan).toBeNull();
    expect(result.data[0]!.isConfidential).toBe(true);
    expect(result.data[0]!.type).toBe("INDIVIDUAL");
    expect(result.data[1]!.summary).toBe("Career guidance");
  });
});

describe("getCounselingRecordAction", () => {
  beforeEach(() => {
    vi.mocked(audit).mockClear();
    vi.mocked(audit).mockResolvedValue(undefined);
  });

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getCounselingRecordAction("cns-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects users lacking COUNSELING_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getCounselingRecordAction("cns-1");
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("returns { error: 'Record not found' } when findFirst returns null", async () => {
    mockAuthenticatedUser({ permissions: ["welfare:counseling:read"] });
    prismaMock.counselingRecord.findFirst.mockResolvedValue(null as never);
    const result = await getCounselingRecordAction("cns-1");
    expect(result).toEqual({ error: "Record not found" });
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });

  it("returns full record + writes audit log when authorized on confidential", async () => {
    mockAuthenticatedUser({
      permissions: ["welfare:counseling:read", "welfare:counseling:confidential:read"],
    });
    prismaMock.counselingRecord.findFirst.mockResolvedValue(confidentialRecord as never);

    const result = await getCounselingRecordAction("cns-1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.summary).toBe("Family issues");
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "READ",
        entity: "CounselingRecord",
        entityId: "cns-1",
        module: "welfare",
        metadata: { isConfidential: true, denied: false },
      }),
    );
  });

  it("returns redacted record + writes denial audit log when unauthorized", async () => {
    mockAuthenticatedUser({ permissions: ["welfare:counseling:read"] });
    prismaMock.counselingRecord.findFirst.mockResolvedValue(confidentialRecord as never);

    const result = await getCounselingRecordAction("cns-1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.summary).toBe("Confidential — restricted");
    expect(result.data.actionPlan).toBeNull();
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "READ",
        entity: "CounselingRecord",
        entityId: "cns-1",
        metadata: { isConfidential: true, denied: true },
      }),
    );
  });

  it("does not write audit log when record is not confidential", async () => {
    mockAuthenticatedUser({ permissions: ["welfare:counseling:read"] });
    prismaMock.counselingRecord.findFirst.mockResolvedValue(publicRecord as never);

    const result = await getCounselingRecordAction("cns-2");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.summary).toBe("Career guidance");
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/discipline/counseling.test.ts`
Expected: fail — `getCounselingRecordAction` is not exported, and list does not redact.

### Step 3: Implement action changes

Open `src/modules/discipline/actions/counseling.action.ts`. Extend imports:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  resolveConfidentialCapability,
  redactCounselingRecord,
  logConfidentialAccess,
} from "@/lib/confidential";
```

Replace the body of `getCounselingRecordsAction` (currently around lines 52-87):

```ts
export async function getCounselingRecordsAction(filters?: {
  studentId?: string;
  type?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COUNSELING_READ);
  if (denied) return denied;

  const { canReadConfidential } = resolveConfidentialCapability(
    ctx.session,
    PERMISSIONS.COUNSELING_CONFIDENTIAL_READ,
  );

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.type) where.type = filters.type;
  if (filters?.status) where.status = filters.status;

  const [records, total] = await Promise.all([
    db.counselingRecord.findMany({
      where,
      orderBy: { sessionDate: "desc" },
      skip,
      take: pageSize,
    }),
    db.counselingRecord.count({ where }),
  ]);

  return {
    data: records.map((r) => redactCounselingRecord(r, canReadConfidential)),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
```

Append the detail action at the end of the file:

```ts
// ─── Get Single Counseling Record (with access logging) ────────────

/**
 * Fetches a single counseling record by id. Writes an audit log entry when
 * the record is confidential. Redacts sensitive fields when the caller
 * lacks COUNSELING_CONFIDENTIAL_READ.
 */
export async function getCounselingRecordAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COUNSELING_READ);
  if (denied) return denied;

  const record = await db.counselingRecord.findFirst({
    where: { id, schoolId: ctx.schoolId },
  });
  if (!record) return { error: "Record not found" };

  const { canReadConfidential } = resolveConfidentialCapability(
    ctx.session,
    PERMISSIONS.COUNSELING_CONFIDENTIAL_READ,
  );

  if (record.isConfidential) {
    await logConfidentialAccess({
      userId: ctx.session.user.id!,
      schoolId: ctx.schoolId,
      entity: "CounselingRecord",
      entityId: record.id,
      isConfidential: true,
      denied: !canReadConfidential,
      module: "welfare",
    });
  }

  return { data: redactCounselingRecord(record, canReadConfidential) };
}
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/discipline/counseling.test.ts`
Expected: 8 new tests passing.

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Commit

```bash
git add src/modules/discipline/actions/counseling.action.ts tests/unit/discipline/counseling.test.ts
git commit -m "feat(confidentiality): redact counseling records + add detail action with access logging"
```

---

## Task 5: UI update — health section redacted-row rendering

**Files:**
- Modify: `src/app/(dashboard)/students/[id]/health-section.tsx`

This is a pure UI change. No tests are added (the existing test suite convention for this codebase doesn't unit-test UI components; behavior is verified through integration + manual QA).

### Step 1: Update the component

Replace the body of `src/app/(dashboard)/students/[id]/health-section.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getMedicalRecordsAction } from "@/modules/student/actions/medical.action";

interface MedicalRecord {
  id: string;
  date: Date | string;
  type: string;
  title: string;
  description: string;
  treatment: string | null;
  followUpDate: Date | string | null;
  isConfidential: boolean;
}

const REDACTED_TITLE = "Confidential — restricted";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function StudentHealthSection({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await getMedicalRecordsAction({ studentId, pageSize: 20 });
      if (cancelled) return;
      if ("error" in res) {
        setError(res.error as string);
        setLoading(false);
        return;
      }
      setRecords((res.data ?? []) satisfies MedicalRecord[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading health records…</div>;
  }
  if (error) {
    return <div className="py-12 text-center text-sm text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Medical Records</h3>
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No medical records on file.</p>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const isRedacted = r.isConfidential && r.title === REDACTED_TITLE;
            return (
              <div
                key={r.id}
                className={`rounded-lg border border-border p-4 ${isRedacted ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{r.title}</p>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {r.type}
                      </span>
                      {r.isConfidential && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                          Confidential
                        </span>
                      )}
                      {isRedacted && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300">
                          Restricted
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.date)}</p>
                  </div>
                  {r.followUpDate && (
                    <p className="text-xs text-muted-foreground">
                      Follow-up: {formatDate(r.followUpDate)}
                    </p>
                  )}
                </div>
                {isRedacted ? (
                  <p className="mt-2 text-sm italic text-muted-foreground">
                    Access restricted — contact school nurse.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm">{r.description}</p>
                    {r.treatment && (
                      <p className="mt-2 text-sm">
                        <span className="font-medium">Treatment:</span>{" "}
                        <span className="text-muted-foreground">{r.treatment}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### Step 2: Verify

Run: `npx tsc --noEmit`
Expected: clean.

### Step 3: Commit

```bash
git add "src/app/(dashboard)/students/[id]/health-section.tsx"
git commit -m "feat(confidentiality): render redacted medical records with restricted styling"
```

---

## Task 6: Integration test (live DB)

**Files:**
- Create: `tests/integration/students/confidential-access.test.ts`

### Step 1: Write the integration test

Create `tests/integration/students/confidential-access.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getMedicalRecordAction, getMedicalRecordsAction } from "@/modules/student/actions/medical.action";
import { getCounselingRecordAction, getCounselingRecordsAction } from "@/modules/discipline/actions/counseling.action";
import { resolveSeededAdminId, loginAs } from "./setup";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Confidential access (integration)", () => {
  const db = new PrismaClient();
  const testTag = `confidential-test-${Date.now()}`;
  let studentId: string;
  let confidentialMedId: string;
  let publicMedId: string;
  let confidentialCnsId: string;
  let publicCnsId: string;
  let adminId: string;

  // Synthetic users with narrow permission bundles — the integration test
  // invokes actions via loginAs() which stubs a session matching these shapes.
  const nurseSession = {
    user: { id: "nurse-test", permissions: ["medical:records:read", "medical:records:confidential:read"], schoolId: "default-school" },
  };
  const teacherSession = {
    user: { id: "teacher-test", permissions: ["medical:records:read", "welfare:counseling:read"], schoolId: "default-school" },
  };
  const counsellorSession = {
    user: { id: "counsellor-test", permissions: ["welfare:counseling:read", "welfare:counseling:confidential:read"], schoolId: "default-school" },
  };

  beforeAll(async () => {
    adminId = await resolveSeededAdminId();

    // Seed a student
    const student = await db.student.create({
      data: {
        schoolId: "default-school",
        studentId: `${testTag}/001`,
        firstName: "Confi",
        lastName: "Dential",
        dateOfBirth: new Date("2010-01-01"),
        gender: "MALE",
      },
    });
    studentId = student.id;

    // Seed a confidential + a non-confidential medical record
    const confMed = await db.medicalRecord.create({
      data: {
        schoolId: "default-school",
        studentId,
        recordedBy: adminId,
        date: new Date(),
        type: "TREATMENT",
        title: "Allergy management",
        description: "Private details",
        treatment: "Antihistamine",
        isConfidential: true,
      },
    });
    confidentialMedId = confMed.id;

    const pubMed = await db.medicalRecord.create({
      data: {
        schoolId: "default-school",
        studentId,
        recordedBy: adminId,
        date: new Date(),
        type: "CHECKUP",
        title: "Annual checkup",
        description: "Routine exam",
        isConfidential: false,
      },
    });
    publicMedId = pubMed.id;

    // Seed a confidential + a non-confidential counseling record
    const confCns = await db.counselingRecord.create({
      data: {
        schoolId: "default-school",
        studentId,
        counselorId: adminId,
        sessionDate: new Date(),
        type: "INDIVIDUAL",
        summary: "Sensitive family matter",
        actionPlan: "Weekly check-in",
        isConfidential: true,
      },
    });
    confidentialCnsId = confCns.id;

    const pubCns = await db.counselingRecord.create({
      data: {
        schoolId: "default-school",
        studentId,
        counselorId: adminId,
        sessionDate: new Date(),
        type: "GROUP",
        summary: "Career talk",
        isConfidential: false,
      },
    });
    publicCnsId = pubCns.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({
      where: { entityId: { in: [confidentialMedId, publicMedId, confidentialCnsId, publicCnsId] } },
    });
    await db.counselingRecord.deleteMany({
      where: { id: { in: [confidentialCnsId, publicCnsId] } },
    });
    await db.medicalRecord.deleteMany({
      where: { id: { in: [confidentialMedId, publicMedId] } },
    });
    await db.student.delete({ where: { id: studentId } });
    await db.$disconnect();
  });

  it("nurse sees full medical content on list", async () => {
    loginAs(nurseSession.user);
    const result = await getMedicalRecordsAction({ studentId });
    if (!("data" in result)) throw new Error(result.error);
    const conf = result.data.find((r) => r.id === confidentialMedId);
    expect(conf?.title).toBe("Allergy management");
    expect(conf?.description).toBe("Private details");
  });

  it("teacher sees redacted medical rows on list", async () => {
    loginAs(teacherSession.user);
    const result = await getMedicalRecordsAction({ studentId });
    if (!("data" in result)) throw new Error(result.error);
    const conf = result.data.find((r) => r.id === confidentialMedId);
    expect(conf?.title).toBe("Confidential — restricted");
    expect(conf?.description).toBe("");
    const pub = result.data.find((r) => r.id === publicMedId);
    expect(pub?.title).toBe("Annual checkup");
  });

  it("nurse detail on confidential writes audit row with denied:false", async () => {
    loginAs(nurseSession.user);
    const result = await getMedicalRecordAction(confidentialMedId);
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data.title).toBe("Allergy management");

    const rows = await db.auditLog.findMany({
      where: { entity: "MedicalRecord", entityId: confidentialMedId, userId: "nurse-test" },
      orderBy: { timestamp: "desc" },
      take: 1,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe("READ");
    expect(rows[0]!.metadata).toMatchObject({ isConfidential: true, denied: false });
  });

  it("teacher detail on confidential writes audit row with denied:true and returns redacted", async () => {
    loginAs(teacherSession.user);
    const result = await getMedicalRecordAction(confidentialMedId);
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data.title).toBe("Confidential — restricted");

    const rows = await db.auditLog.findMany({
      where: { entity: "MedicalRecord", entityId: confidentialMedId, userId: "teacher-test" },
      orderBy: { timestamp: "desc" },
      take: 1,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.metadata).toMatchObject({ isConfidential: true, denied: true });
  });

  it("detail on non-confidential does not write audit row", async () => {
    loginAs(teacherSession.user);
    const before = await db.auditLog.count({
      where: { entity: "MedicalRecord", entityId: publicMedId, userId: "teacher-test" },
    });
    const result = await getMedicalRecordAction(publicMedId);
    if (!("data" in result)) throw new Error(result.error);
    const after = await db.auditLog.count({
      where: { entity: "MedicalRecord", entityId: publicMedId, userId: "teacher-test" },
    });
    expect(after).toBe(before);
  });

  it("counselor sees full counseling content; teacher gets redacted summary", async () => {
    loginAs(counsellorSession.user);
    const cnsFull = await getCounselingRecordsAction({ studentId });
    if (!("data" in cnsFull)) throw new Error(cnsFull.error);
    const cnsConfFull = cnsFull.data.find((r) => r.id === confidentialCnsId);
    expect(cnsConfFull?.summary).toBe("Sensitive family matter");

    loginAs(teacherSession.user);
    const cnsRedacted = await getCounselingRecordsAction({ studentId });
    if (!("data" in cnsRedacted)) throw new Error(cnsRedacted.error);
    const cnsConfRedacted = cnsRedacted.data.find((r) => r.id === confidentialCnsId);
    expect(cnsConfRedacted?.summary).toBe("Confidential — restricted");
    expect(cnsConfRedacted?.actionPlan).toBeNull();
  });

  it("list action enforces schoolId isolation", async () => {
    loginAs({ id: "nurse-other", permissions: ["medical:records:read", "medical:records:confidential:read"], schoolId: "other-school" });
    const result = await getMedicalRecordsAction({ studentId });
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data).toHaveLength(0);
  });
});
```

### Step 2: Verify `loginAs` supports custom user shapes

The test relies on `loginAs(userShape)` stubbing the session with the given `permissions` and `schoolId`. Open `tests/integration/students/setup.ts` and confirm `loginAs` accepts a shape with these fields. If it only accepts `{ id }`, adapt the helper's signature so the test can pass a `permissions` array. (This is an incidental change — if the existing helper doesn't support it, extend it minimally rather than duplicating it.)

### Step 3: Run

Run: `npm run test:students`
Expected: passing — 7 new integration assertions plus the existing students suite.

### Step 4: Commit

```bash
git add tests/integration/students/confidential-access.test.ts tests/integration/students/setup.ts
git commit -m "test(confidentiality): integration coverage for redaction + access logging"
```

---

## Task 7: End-to-end verification

**Files:** verification only — no edits.

### Step 1: Unit suite

Run: `npx vitest run`
Expected: all passing. Specifically verify:
- `tests/unit/lib/confidential.test.ts` — 14 tests
- `tests/unit/student/medical.test.ts` — existing tests + 8 new
- `tests/unit/discipline/counseling.test.ts` — 8 new tests
- No regressions elsewhere

### Step 2: Integration suite

Run: `npm run test:students`
Expected: existing + 7 new confidential-access assertions pass.

### Step 3: Audit guardrail

Run: `npx vitest run tests/unit/guardrails/audit-coverage.test.ts`
Expected: 2/2 passing. If the guardrail flags `getMedicalRecordAction` / `getCounselingRecordAction` (they call `audit()` conditionally via `logConfidentialAccess`, not on every invocation), mark those two actions with a `@no-audit` JSDoc block and rely on the integration test for coverage. Re-run and expect pass.

### Step 4: TypeScript check

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Build

Run: `npm run build`
Expected: success. `/students/[id]` route still compiles; medical/counseling module imports resolve.

### Step 6: Lint

Run: `npm run lint`
Expected: no new errors in `src/lib/confidential.ts`, action files, or `health-section.tsx`.

### Step 7: Manual UI walk (when dev server + DB available)

1. Seed or assign `school_nurse` role to a test user (role row may need to be created in the `Role` table for the user to be assigned — ops task outside this plan's scope).
2. Log in as super_admin → `/students/[id]` → Medical tab → confidential records show full content.
3. Log in as a user with `MEDICAL_READ` only (no confidential) → same page → confidential rows show "Restricted" badge, opacity-60 styling, "Access restricted — contact school nurse" message.
4. Query the `AuditLog` table: no rows appear from the list views (those don't log). Detail reads are not yet wired into the UI so no VIEW rows are written from the browser — verify by calling `getMedicalRecordAction` directly via REPL or unit/integration test if needed.
5. Switch to a user with `COUNSELING_READ` only and repeat for counseling (UI component deferred — backend redaction is exercised via the test).

No code changes result from this step.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage:**
  - §2 scope → Tasks 1-6 cover medical + counseling; discipline explicitly deferred
  - §3 architecture → Task 2 builds the helper; Tasks 3-4 consume it
  - §4 data model — no schema changes needed (AuditAction.READ already exists) → confirmed during plan research
  - §5 permissions → Task 1
  - §6 shared helper → Task 2
  - §7 server actions → Tasks 3-4
  - §8 access logging → Task 2 defines the logger; Tasks 3-4 call it in detail paths
  - §9 UI → Task 5 (health-section only; counseling UI explicitly out of scope)
  - §10 error handling → tests in Tasks 3-4 cover not-found, denied, non-confidential, audit-failure
  - §11 testing → Tasks 2, 3, 4, 6
- [x] **No placeholders:** every step has actual code; every command has expected output. Headmaster permission grant step has a conditional ("check first whether MEDICAL_READ already appears") — this is necessary because the file is long and I can't verify without reading it fresh, but the action is deterministic
- [x] **Type consistency:** `ConfidentialCapability`, `redactMedicalRecord`, `redactCounselingRecord`, `logConfidentialAccess` signatures match across Tasks 2, 3, 4. Permission constant names match between Task 1 and Tasks 3, 4
- [x] **File paths:** all absolute-from-repo-root; no Windows-specific separators in-code
- [x] **TDD shape:** Tasks 2, 3, 4 follow write-test → verify-RED → implement → verify-GREEN → commit. Task 1 skips TDD (permission constants are additive data; tsc + existing permissions test covers it). Task 5 skips TDD per this codebase's UI convention. Task 6 is integration-only. Task 7 is verification-only
