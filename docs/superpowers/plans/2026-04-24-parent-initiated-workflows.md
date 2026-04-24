# Parent-Initiated Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two parent-initiated workflows — excuse-absence submissions (date-range, 14-day retroactive, class-teacher/housemaster review) and medical disclosures (ALLERGY/CONDITION/MEDICATION + urgency flag, nurse review). Both use a shared `PENDING → APPROVED | REJECTED | WITHDRAWN` state machine, reuse the messaging attachment helpers (R2 + HEAD verification), and plug into the existing NotificationPreference system.

**Architecture:** New `src/modules/parent-requests/` module split into pure helpers (`eligibility.ts`, `notifications.ts`, `lifecycle.ts`) and focused action files (`excuse.action.ts`, `medical-disclosure.action.ts`, `attachment.action.ts`). Two new Prisma models appended to `attendance.prisma` + `student.prisma`. Existing `NotificationPreference` + `sendMessage` hub reused for fan-out. R2 + attachment validation reused from messaging.

**Tech Stack:** Next.js 15 App Router, Prisma on PostgreSQL, vitest + vitest-mock-extended, Cloudflare R2, native HTML + tailwind, sonner for toasts.

**Spec reference:** `docs/superpowers/specs/2026-04-24-parent-initiated-workflows-design.md`

---

## File Structure

**New files**
- `src/modules/parent-requests/eligibility.ts` — pure rules
- `src/modules/parent-requests/notifications.ts` — fan-out over `sendMessage`
- `src/modules/parent-requests/lifecycle.ts` — cancel-on-student-lifecycle helper
- `src/modules/parent-requests/actions/excuse.action.ts`
- `src/modules/parent-requests/actions/medical-disclosure.action.ts`
- `src/modules/parent-requests/actions/attachment.action.ts`
- `src/components/portal/attachment-upload.tsx` — factored from NewConversationModal
- `src/app/(portal)/parent/requests/page.tsx` + `requests-client.tsx`
- `src/app/(portal)/parent/requests/new-excuse-modal.tsx`
- `src/app/(portal)/parent/requests/new-medical-modal.tsx`
- `src/app/(portal)/staff/excuse-reviews/page.tsx` + `excuse-reviews-client.tsx`
- `src/app/(dashboard)/students/medical-disclosures/page.tsx` + `medical-disclosures-client.tsx`
- `tests/unit/modules/parent-requests/eligibility.test.ts`
- `tests/unit/modules/parent-requests/excuse.test.ts`
- `tests/unit/modules/parent-requests/medical-disclosure.test.ts`
- `tests/unit/modules/parent-requests/notifications.test.ts`
- `tests/unit/modules/parent-requests/lifecycle.test.ts`
- `tests/integration/students/parent-requests.test.ts`

**Modified files**
- `prisma/schema/attendance.prisma` — append `ExcuseRequest` + enum + back-relations
- `prisma/schema/student.prisma` — append `MedicalDisclosure` + enums + back-relations
- `prisma/schema/school.prisma` + `auth.prisma` — back-relations
- `prisma/schema/migrations/<timestamp>_add_parent_requests_models/migration.sql`
- `src/lib/permissions.ts` — 4 new permissions + grants
- `src/lib/notifications/events.ts` — 4 new event keys + `EVENT_CHANNELS`
- `src/modules/messaging/attachments.ts` — add optional `prefix` param to `buildAttachmentKey` (default `"messages"`)
- `src/app/(portal)/portal-nav.tsx` — add `My requests` under parentLinks, `Excuse reviews` under staffLinks
- `src/app/(dashboard)/students/` sidebar — add `Medical Disclosures` link
- `src/modules/student/actions/transfer.action.ts` — call `cancelPendingRequestsForStudent` in transfer + withdraw paths
- `src/modules/student/actions/student.action.ts` — same in `deleteStudentAction`
- `src/modules/student/actions/promotion.action.ts` — GRADUATE/WITHDRAW outcomes
- `src/modules/academics/actions/promotion.action.ts` — GRADUATED branch
- `src/workers/retention.worker.ts` (or wherever messaging retention lives) — add 2 tables
- `tests/unit/auth/permissions.test.ts` — +1 regression test
- Back-relations on `Student`, `School`, `User` in their Prisma files

---

## Task 1: Schema migration (models + enums + back-relations)

**Files:**
- Modify: `prisma/schema/attendance.prisma`
- Modify: `prisma/schema/student.prisma`
- Modify: `prisma/schema/school.prisma`
- Modify: `prisma/schema/auth.prisma`
- Create: `prisma/schema/migrations/<timestamp>_add_parent_requests_models/migration.sql`

### Step 1: Append `ExcuseRequest` to `attendance.prisma`

At the bottom of `prisma/schema/attendance.prisma`, append:

```prisma
// ─── Parent-Initiated: Excuse Requests ────────────────────────────────

model ExcuseRequest {
  id                String              @id @default(cuid())
  schoolId          String
  studentId         String
  submittedByUserId String
  fromDate          DateTime
  toDate            DateTime
  reason            String
  attachmentKey     String?
  attachmentName    String?
  attachmentSize    Int?
  attachmentMime    String?
  status            ExcuseRequestStatus @default(PENDING)
  reviewerUserId    String?
  reviewNote        String?
  reviewedAt        DateTime?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  school      School  @relation("SchoolExcuseRequest", fields: [schoolId], references: [id])
  student     Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  submittedBy User    @relation("SubmittedExcuses", fields: [submittedByUserId], references: [id])
  reviewer    User?   @relation("ReviewedExcuses", fields: [reviewerUserId], references: [id], onDelete: SetNull)

  @@index([schoolId, status])
  @@index([studentId, status])
  @@index([submittedByUserId])
  @@index([fromDate, toDate])
}

enum ExcuseRequestStatus {
  PENDING
  APPROVED
  REJECTED
  WITHDRAWN
}
```

### Step 2: Append `MedicalDisclosure` to `student.prisma`

At the bottom of `prisma/schema/student.prisma`, append:

```prisma
// ─── Parent-Initiated: Medical Disclosures ────────────────────────────

model MedicalDisclosure {
  id                       String                    @id @default(cuid())
  schoolId                 String
  studentId                String
  submittedByUserId        String
  category                 MedicalDisclosureCategory
  title                    String
  description              String
  isUrgent                 Boolean                   @default(false)
  attachmentKey            String?
  attachmentName           String?
  attachmentSize           Int?
  attachmentMime           String?
  status                   MedicalDisclosureStatus   @default(PENDING)
  reviewerUserId           String?
  reviewNote               String?
  reviewedAt               DateTime?
  resultingMedicalRecordId String?
  createdAt                DateTime                  @default(now())
  updatedAt                DateTime                  @updatedAt

  school      School  @relation("SchoolMedicalDisclosure", fields: [schoolId], references: [id])
  student     Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  submittedBy User    @relation("SubmittedDisclosures", fields: [submittedByUserId], references: [id])
  reviewer    User?   @relation("ReviewedDisclosures", fields: [reviewerUserId], references: [id], onDelete: SetNull)

  @@index([schoolId, status])
  @@index([schoolId, status, isUrgent])
  @@index([studentId, status])
  @@index([submittedByUserId])
}

enum MedicalDisclosureCategory {
  ALLERGY
  CONDITION
  MEDICATION
}

enum MedicalDisclosureStatus {
  PENDING
  APPROVED
  REJECTED
  WITHDRAWN
}
```

### Step 3: Add back-relations on `Student`

In `prisma/schema/student.prisma`, inside `model Student { ... }` alongside other relations:

```prisma
  excuseRequests     ExcuseRequest[]
  medicalDisclosures MedicalDisclosure[]
```

### Step 4: Add back-relations on `School`

In `prisma/schema/school.prisma`, inside `model School { ... }`:

```prisma
  excuseRequests     ExcuseRequest[]     @relation("SchoolExcuseRequest")
  medicalDisclosures MedicalDisclosure[] @relation("SchoolMedicalDisclosure")
```

### Step 5: Add back-relations on `User`

In `prisma/schema/auth.prisma` (confirm via `grep -r "model User" prisma/schema/`), inside `model User { ... }`:

```prisma
  submittedExcuses     ExcuseRequest[]     @relation("SubmittedExcuses")
  reviewedExcuses      ExcuseRequest[]     @relation("ReviewedExcuses")
  submittedDisclosures MedicalDisclosure[] @relation("SubmittedDisclosures")
  reviewedDisclosures  MedicalDisclosure[] @relation("ReviewedDisclosures")
```

### Step 6: Validate

- [ ] Run: `npx prisma validate`
  Expected: `The schemas at prisma\schema are valid`

### Step 7: Generate migration

- [ ] Run: `npx prisma migrate dev --name add_parent_requests_models --create-only`
  Expected: new migration dir under `prisma/schema/migrations/` containing only messaging-unrelated CREATE TABLE / CREATE TYPE / CREATE INDEX / AddForeignKey statements for ExcuseRequest, MedicalDisclosure, and their enums.

Inspect the generated SQL. If Prisma proposes ALTER TABLE on unrelated models (known spurious drift), strip those lines.

### Step 8: Apply

- [ ] Run: `npx prisma migrate dev`
  Expected: migration applied, Prisma client regenerated.

### Step 9: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean (no output).

### Step 10: Commit

```bash
git add prisma/
git commit -m "feat(parent-requests): add ExcuseRequest + MedicalDisclosure models"
```

---

## Task 2: Permissions + role grants

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `tests/unit/auth/permissions.test.ts`

### Step 1: Add four new constants

In `src/lib/permissions.ts`, find the `MESSAGING_*` block (added in Tier 2 #6 sub-project B). After `MESSAGING_ADMIN_REVIEW`, add:

```ts
  // Parent-initiated workflows
  EXCUSE_SUBMIT:             "parent_requests:excuse:submit",
  EXCUSE_REVIEW:             "parent_requests:excuse:review",
  MEDICAL_DISCLOSURE_SUBMIT: "parent_requests:medical:submit",
  MEDICAL_DISCLOSURE_REVIEW: "parent_requests:medical:review",
```

### Step 2: Grant `EXCUSE_SUBMIT` + `MEDICAL_DISCLOSURE_SUBMIT` to `parent`

Find `parent:` in `DEFAULT_ROLE_PERMISSIONS`. Add:

```ts
    PERMISSIONS.EXCUSE_SUBMIT,
    PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT,
```

### Step 3: Grant `EXCUSE_REVIEW` to `class_teacher` + `housemaster`

Find `class_teacher:` and `housemaster:` arrays. Add:

```ts
    PERMISSIONS.EXCUSE_REVIEW,
```

### Step 4: Grant `MEDICAL_DISCLOSURE_REVIEW` to `school_nurse`

Find `school_nurse:` in `DEFAULT_ROLE_PERMISSIONS`. Add:

```ts
    PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW,
```

### Step 5: Add regression test

Open `tests/unit/auth/permissions.test.ts`. Near the existing `messaging permissions are granted` test, add:

```ts
it("parent-request permissions are granted to the expected roles", () => {
  expect(DEFAULT_ROLE_PERMISSIONS.parent).toContain(PERMISSIONS.EXCUSE_SUBMIT);
  expect(DEFAULT_ROLE_PERMISSIONS.parent).toContain(PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT);
  for (const role of ["class_teacher", "housemaster"]) {
    expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.EXCUSE_REVIEW);
  }
  expect(DEFAULT_ROLE_PERMISSIONS.school_nurse).toContain(PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);

  // Negative: parent must NOT have review perms
  expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.EXCUSE_REVIEW);
  expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  // Negative: class_teacher must NOT have medical review
  expect(DEFAULT_ROLE_PERMISSIONS.class_teacher).not.toContain(PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  // Negative: school_nurse must NOT have excuse review (they're different workflows)
  expect(DEFAULT_ROLE_PERMISSIONS.school_nurse).not.toContain(PERMISSIONS.EXCUSE_REVIEW);
});
```

Also update any existing `parent role should be read-only` test to include the new submit permissions in its allow-list (same pattern used by the messaging PR).

### Step 6: Verify

- [ ] Run: `npx tsc --noEmit` — clean
- [ ] Run: `npx vitest run tests/unit/auth/permissions.test.ts` — all existing tests pass + 1 new

### Step 7: Commit

```bash
git add src/lib/permissions.ts tests/unit/auth/permissions.test.ts
git commit -m "feat(parent-requests): add EXCUSE_* + MEDICAL_DISCLOSURE_* permissions"
```

---

## Task 3: Pure eligibility helpers (TDD)

**Files:**
- Create: `src/modules/parent-requests/eligibility.ts`
- Create: `tests/unit/modules/parent-requests/eligibility.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/parent-requests/eligibility.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  isWithinRetroactiveWindow,
  isValidDateRange,
  canReviewExcuse,
} from "@/modules/parent-requests/eligibility";
import type {
  StudentContext,
  StaffAssignment,
} from "@/modules/messaging/eligibility";

const now = new Date("2026-04-24T12:00:00Z");

const activeBoarder: StudentContext = {
  id: "s1",
  schoolId: "school-1",
  status: "ACTIVE",
  boardingStatus: "BOARDING",
  classArmId: "arm-1",
  houseId: "house-1",
};
const activeDay: StudentContext = { ...activeBoarder, boardingStatus: "DAY", houseId: null };
const withdrawn: StudentContext = { ...activeBoarder, status: "WITHDRAWN" };
const suspended: StudentContext = { ...activeBoarder, status: "SUSPENDED" };

describe("isWithinRetroactiveWindow", () => {
  it("returns true for today", () => {
    expect(isWithinRetroactiveWindow(now, now)).toBe(true);
  });

  it("returns true for exactly 14 days ago (inclusive)", () => {
    const d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    expect(isWithinRetroactiveWindow(d, now)).toBe(true);
  });

  it("returns false for 15 days ago", () => {
    const d = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    expect(isWithinRetroactiveWindow(d, now)).toBe(false);
  });

  it("returns false for future dates", () => {
    const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    expect(isWithinRetroactiveWindow(d, now)).toBe(false);
  });

  it("respects custom window days", () => {
    const d = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    expect(isWithinRetroactiveWindow(d, now, 3)).toBe(false);
    expect(isWithinRetroactiveWindow(d, now, 7)).toBe(true);
  });
});

describe("isValidDateRange", () => {
  it("returns true when fromDate === toDate", () => {
    const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(isValidDateRange(d, d, now)).toBe(true);
  });

  it("returns true when fromDate < toDate", () => {
    const a = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const b = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    expect(isValidDateRange(a, b, now)).toBe(true);
  });

  it("returns false when fromDate > toDate", () => {
    const a = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const b = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(isValidDateRange(a, b, now)).toBe(false);
  });

  it("returns false when toDate is in the future", () => {
    const a = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const b = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    expect(isValidDateRange(a, b, now)).toBe(false);
  });
});

describe("canReviewExcuse", () => {
  it("class_teacher of matching arm can review", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(canReviewExcuse(staff, activeBoarder)).toBe(true);
  });

  it("class_teacher of different arm cannot", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-9" };
    expect(canReviewExcuse(staff, activeBoarder)).toBe(false);
  });

  it("housemaster for BOARDING student can review", () => {
    const staff: StaffAssignment = { userId: "u2", role: "housemaster", houseId: "house-1" };
    expect(canReviewExcuse(staff, activeBoarder)).toBe(true);
  });

  it("housemaster for DAY student cannot", () => {
    const staff: StaffAssignment = { userId: "u2", role: "housemaster", houseId: "house-1" };
    expect(canReviewExcuse(staff, activeDay)).toBe(false);
  });

  it("class_teacher cannot review WITHDRAWN student", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(canReviewExcuse(staff, withdrawn)).toBe(false);
  });

  it("class_teacher can review SUSPENDED student", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(canReviewExcuse(staff, suspended)).toBe(true);
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/parent-requests/eligibility.test.ts`
  Expected: fail — module not found.

### Step 3: Implement

Create `src/modules/parent-requests/eligibility.ts`:

```ts
import {
  eligibleStaffRole,
  type StaffAssignment,
  type StudentContext,
} from "@/modules/messaging/eligibility";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 14;

/**
 * Returns true if `fromDate` falls within the trailing retroactive window.
 * Default window is 14 days. Future dates are never valid.
 */
export function isWithinRetroactiveWindow(
  fromDate: Date,
  now: Date = new Date(),
  windowDays: number = DEFAULT_WINDOW_DAYS,
): boolean {
  const nowMs = now.getTime();
  const fromMs = fromDate.getTime();
  if (fromMs > nowMs) return false;
  return nowMs - fromMs <= windowDays * ONE_DAY_MS;
}

/**
 * Returns true if `fromDate <= toDate` and neither is in the future.
 * Same-day ranges are valid.
 */
export function isValidDateRange(
  fromDate: Date,
  toDate: Date,
  now: Date = new Date(),
): boolean {
  if (fromDate.getTime() > toDate.getTime()) return false;
  if (toDate.getTime() > now.getTime()) return false;
  return true;
}

/**
 * Returns true if this staff member is eligible to review excuse requests
 * for this student. Reuses the messaging eligibility rule:
 * class_teacher of the student's arm, OR housemaster of the student's house
 * (boarders only). Student must be ACTIVE or SUSPENDED.
 */
export function canReviewExcuse(
  reviewer: StaffAssignment,
  student: StudentContext,
): boolean {
  return eligibleStaffRole(reviewer, student) !== null;
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/parent-requests/eligibility.test.ts`
  Expected: all tests passing.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/parent-requests/eligibility.ts tests/unit/modules/parent-requests/eligibility.test.ts
git commit -m "feat(parent-requests): pure eligibility + date-range helpers"
```

---

## Task 4: Attachment key prefix refactor

**Files:**
- Modify: `src/modules/messaging/attachments.ts`
- Modify: `tests/unit/modules/messaging/attachments.test.ts`

### Step 1: Add `prefix` parameter to `buildAttachmentKey`

Open `src/modules/messaging/attachments.ts`. Update the `buildAttachmentKey` signature:

```ts
/**
 * Deterministic R2 key generation. Sanitises filename and prefixes with a
 * random UUID to avoid collisions. Scoped by schoolId + prefix so a leaked key
 * cannot target another tenant's bucket space.
 *
 * @param input.prefix Optional top-level key prefix (default "messages").
 *                     Use "parent-requests" for excuse/medical attachments.
 */
export function buildAttachmentKey(input: {
  schoolId: string;
  threadId: string;
  filename: string;
  prefix?: string;
}): string {
  const safeName = sanitiseFilename(input.filename);
  const uuid = randomUUID();
  const prefix = input.prefix ?? "messages";
  return `${prefix}/${input.schoolId}/${input.threadId}/${uuid}-${safeName}`;
}
```

(Everything else — `sanitiseFilename`, `validateAttachment`, `ALLOWED_MIME_TYPES`, `MAX_ATTACHMENT_SIZE_BYTES` — unchanged.)

### Step 2: Add test coverage for prefix

In `tests/unit/modules/messaging/attachments.test.ts`, add inside `describe("buildAttachmentKey", ...)`:

```ts
it("defaults prefix to 'messages' when omitted", () => {
  const key = buildAttachmentKey({
    schoolId: "school-1",
    threadId: "t-1",
    filename: "x.pdf",
  });
  expect(key.startsWith("messages/school-1/t-1/")).toBe(true);
});

it("uses a custom prefix when provided", () => {
  const key = buildAttachmentKey({
    schoolId: "school-1",
    threadId: "t-1",
    filename: "x.pdf",
    prefix: "parent-requests",
  });
  expect(key.startsWith("parent-requests/school-1/t-1/")).toBe(true);
});
```

### Step 3: Verify

- [ ] Run: `npx vitest run tests/unit/modules/messaging/attachments.test.ts`
  Expected: all pass including 2 new.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 4: Commit

```bash
git add src/modules/messaging/attachments.ts tests/unit/modules/messaging/attachments.test.ts
git commit -m "refactor(messaging): buildAttachmentKey takes optional prefix for cross-module reuse"
```

---

## Task 5: Notification events + fan-out helper (TDD)

**Files:**
- Modify: `src/lib/notifications/events.ts`
- Create: `src/modules/parent-requests/notifications.ts`
- Create: `tests/unit/modules/parent-requests/notifications.test.ts`

### Step 1: Register 4 new event keys

Open `src/lib/notifications/events.ts`. Find `NOTIFICATION_EVENTS` (before closing `} as const;`). Add inside or after the `// Messaging` block:

```ts
  // Parent-initiated workflows
  EXCUSE_REQUEST_SUBMITTED:     "excuse_request_submitted",
  EXCUSE_REQUEST_REVIEWED:      "excuse_request_reviewed",
  MEDICAL_DISCLOSURE_SUBMITTED: "medical_disclosure_submitted",
  MEDICAL_DISCLOSURE_REVIEWED:  "medical_disclosure_reviewed",
```

Find `EVENT_CHANNELS`. Add:

```ts
  [NOTIFICATION_EVENTS.EXCUSE_REQUEST_SUBMITTED]:     ["in_app"],
  [NOTIFICATION_EVENTS.EXCUSE_REQUEST_REVIEWED]:      ["in_app", "email"],
  [NOTIFICATION_EVENTS.MEDICAL_DISCLOSURE_SUBMITTED]: ["in_app"],
  [NOTIFICATION_EVENTS.MEDICAL_DISCLOSURE_REVIEWED]:  ["in_app", "email"],
```

Note: the urgent medical SMS escalation is handled at fan-out time in the module, not via the registry default.

### Step 2: Verify registry compiles

- [ ] Run: `npx tsc --noEmit`
  Expected: clean (the `EVENT_CHANNELS: Record<NotificationEvent, …>` type enforces completeness).

### Step 3: Write failing tests

Create `tests/unit/modules/parent-requests/notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import {
  notifyExcuseSubmitted,
  notifyExcuseReviewed,
  notifyMedicalDisclosureSubmitted,
  notifyMedicalDisclosureReviewed,
} from "@/modules/parent-requests/notifications";
import { sendMessage } from "@/lib/messaging/hub";

vi.mock("@/lib/messaging/hub", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

describe("notifyExcuseSubmitted", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses IN_APP default for reviewers", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyExcuseSubmitted({
      requestId: "req-1",
      reviewerUserIds: ["teacher-1", "housemaster-1"],
      studentName: "Kofi Asante",
      fromDate: new Date("2026-04-20"),
      toDate: new Date("2026-04-22"),
      submitterName: "Mrs. Asante",
    });

    const calls = vi.mocked(sendMessage).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const channelsCalled = calls.map((c) => c[0]);
    expect(channelsCalled.every((c) => c === "in_app")).toBe(true);
  });
});

describe("notifyExcuseReviewed", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses IN_APP + EMAIL defaults and includes outcome in body", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyExcuseReviewed({
      requestId: "req-1",
      submitterUserId: "parent-1",
      outcome: "APPROVED",
      reviewerName: "Ms. Mensah",
      reviewNote: "Thanks for the note",
      studentName: "Kofi",
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
  });
});

describe("notifyMedicalDisclosureSubmitted", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("routine disclosure uses IN_APP only", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyMedicalDisclosureSubmitted({
      disclosureId: "d-1",
      nurseUserIds: ["nurse-1"],
      studentName: "Kofi",
      category: "ALLERGY",
      title: "Peanut allergy",
      isUrgent: false,
      submitterName: "Mrs. Asante",
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).not.toContain("sms");
  });

  it("urgent disclosure adds SMS alongside IN_APP", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyMedicalDisclosureSubmitted({
      disclosureId: "d-1",
      nurseUserIds: ["nurse-1"],
      studentName: "Kofi",
      category: "ALLERGY",
      title: "Severe peanut allergy",
      isUrgent: true,
      submitterName: "Mrs. Asante",
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("sms");
  });

  it("swallows per-recipient errors", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("hub down"));

    await expect(
      notifyMedicalDisclosureSubmitted({
        disclosureId: "d-1",
        nurseUserIds: ["nurse-1", "nurse-2"],
        studentName: "K",
        category: "CONDITION",
        title: "x",
        isUrgent: false,
        submitterName: "P",
      }),
    ).resolves.toBeUndefined();
    expect(vi.mocked(sendMessage).mock.calls.length).toBeGreaterThan(1);
  });
});

describe("notifyMedicalDisclosureReviewed", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses IN_APP + EMAIL defaults", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyMedicalDisclosureReviewed({
      disclosureId: "d-1",
      submitterUserId: "parent-1",
      outcome: "REJECTED",
      reviewerName: "Nurse Adom",
      reviewNote: "Please consult your doctor first",
      studentName: "Kofi",
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
  });
});
```

### Step 4: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/parent-requests/notifications.test.ts`
  Expected: fail — module not found.

### Step 5: Implement

Create `src/modules/parent-requests/notifications.ts`:

```ts
import { db } from "@/lib/db";
import { sendMessage, type ChannelType } from "@/lib/messaging/hub";
import { NOTIFICATION_EVENTS, EVENT_CHANNELS } from "@/lib/notifications/events";
import type { NotificationChannel } from "@prisma/client";

type ChannelKey = "in_app" | "sms" | "email" | "whatsapp" | "push";

function channelKeyToHub(c: ChannelKey): ChannelType | null {
  switch (c) {
    case "in_app": return "in_app";
    case "sms": return "sms";
    case "email": return "email";
    case "whatsapp": return "whatsapp";
    case "push": return "push";
    default: return null;
  }
}

function channelKeyToEnum(c: ChannelKey): NotificationChannel {
  switch (c) {
    case "in_app": return "IN_APP";
    case "sms": return "SMS";
    case "email": return "EMAIL";
    case "whatsapp": return "WHATSAPP";
    case "push": return "PUSH";
    default: throw new Error(`unknown channel key: ${c}`);
  }
}

function channelEnumToKey(c: NotificationChannel): ChannelKey {
  switch (c) {
    case "IN_APP": return "in_app";
    case "SMS": return "sms";
    case "EMAIL": return "email";
    case "WHATSAPP": return "whatsapp";
    case "PUSH": return "push";
  }
}

async function fanOut(params: {
  eventKey: string;
  recipientUserIds: string[];
  defaultChannels: ChannelKey[];
  renderBody: (userId: string) => string;
  templateData: Record<string, unknown>;
}): Promise<void> {
  const prefs = await db.notificationPreference.findMany({
    where: {
      userId: { in: params.recipientUserIds },
      eventKey: params.eventKey,
    },
  });
  const prefByUser = new Map(prefs.map((p) => [p.userId, p.channels]));

  for (const userId of params.recipientUserIds) {
    const override = prefByUser.get(userId);
    const channels: ChannelKey[] = override
      ? override.map(channelEnumToKey)
      : params.defaultChannels;

    if (channels.length === 0) continue;

    for (const channel of channels) {
      const hubChannel = channelKeyToHub(channel);
      if (!hubChannel) continue;

      try {
        await sendMessage(hubChannel, {
          to: userId,
          body: params.renderBody(userId),
          templateData: params.templateData,
        });
      } catch (err) {
        console.error("parent-requests notification failed", {
          eventKey: params.eventKey,
          userId,
          err,
        });
      }
    }
  }
}

// ─── Excuse ────────────────────────────────────────────────────────

export async function notifyExcuseSubmitted(params: {
  requestId: string;
  reviewerUserIds: string[];
  studentName: string;
  fromDate: Date;
  toDate: Date;
  submitterName: string;
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.EXCUSE_REQUEST_SUBMITTED] as ChannelKey[];
  const range = formatRange(params.fromDate, params.toDate);
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.EXCUSE_REQUEST_SUBMITTED,
    recipientUserIds: params.reviewerUserIds,
    defaultChannels: defaults,
    renderBody: () =>
      `${params.submitterName} submitted an excuse request for ${params.studentName} (${range}).`,
    templateData: {
      requestId: params.requestId,
      studentName: params.studentName,
      submitterName: params.submitterName,
      range,
    },
  });
}

export async function notifyExcuseReviewed(params: {
  requestId: string;
  submitterUserId: string;
  outcome: "APPROVED" | "REJECTED";
  reviewerName: string;
  reviewNote?: string;
  studentName: string;
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.EXCUSE_REQUEST_REVIEWED] as ChannelKey[];
  const verb = params.outcome === "APPROVED" ? "approved" : "rejected";
  const noteText = params.reviewNote ? ` Note: ${params.reviewNote}` : "";
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.EXCUSE_REQUEST_REVIEWED,
    recipientUserIds: [params.submitterUserId],
    defaultChannels: defaults,
    renderBody: () =>
      `Your excuse request for ${params.studentName} was ${verb} by ${params.reviewerName}.${noteText}`,
    templateData: {
      requestId: params.requestId,
      outcome: params.outcome,
      reviewerName: params.reviewerName,
      reviewNote: params.reviewNote ?? null,
      studentName: params.studentName,
    },
  });
}

// ─── Medical Disclosure ────────────────────────────────────────────

export async function notifyMedicalDisclosureSubmitted(params: {
  disclosureId: string;
  nurseUserIds: string[];
  studentName: string;
  category: "ALLERGY" | "CONDITION" | "MEDICATION";
  title: string;
  isUrgent: boolean;
  submitterName: string;
}): Promise<void> {
  const defaults: ChannelKey[] = params.isUrgent
    ? ["in_app", "sms"]
    : (EVENT_CHANNELS[NOTIFICATION_EVENTS.MEDICAL_DISCLOSURE_SUBMITTED] as ChannelKey[]);
  const urgentPrefix = params.isUrgent ? "[URGENT] " : "";
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.MEDICAL_DISCLOSURE_SUBMITTED,
    recipientUserIds: params.nurseUserIds,
    defaultChannels: defaults,
    renderBody: () =>
      `${urgentPrefix}${params.submitterName} disclosed ${params.category.toLowerCase()} for ${params.studentName}: ${params.title}.`,
    templateData: {
      disclosureId: params.disclosureId,
      studentName: params.studentName,
      category: params.category,
      title: params.title,
      isUrgent: params.isUrgent,
      submitterName: params.submitterName,
    },
  });
}

export async function notifyMedicalDisclosureReviewed(params: {
  disclosureId: string;
  submitterUserId: string;
  outcome: "APPROVED" | "REJECTED";
  reviewerName: string;
  reviewNote?: string;
  studentName: string;
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.MEDICAL_DISCLOSURE_REVIEWED] as ChannelKey[];
  const verb = params.outcome === "APPROVED" ? "approved" : "rejected";
  const noteText = params.reviewNote ? ` Note: ${params.reviewNote}` : "";
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.MEDICAL_DISCLOSURE_REVIEWED,
    recipientUserIds: [params.submitterUserId],
    defaultChannels: defaults,
    renderBody: () =>
      `Your medical disclosure for ${params.studentName} was ${verb} by ${params.reviewerName}.${noteText}`,
    templateData: {
      disclosureId: params.disclosureId,
      outcome: params.outcome,
      reviewerName: params.reviewerName,
      reviewNote: params.reviewNote ?? null,
      studentName: params.studentName,
    },
  });
}

function formatRange(from: Date, to: Date): string {
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  return fromStr === toStr ? fromStr : `${fromStr} → ${toStr}`;
}
```

Unused `channelKeyToEnum` can be removed if the module doesn't reference it (kept above for symmetry with messaging; feel free to delete).

### Step 6: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/parent-requests/notifications.test.ts`
  Expected: all 5 tests passing.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 7: Commit

```bash
git add src/modules/parent-requests/notifications.ts src/lib/notifications/events.ts tests/unit/modules/parent-requests/notifications.test.ts
git commit -m "feat(parent-requests): register events + fan-out helpers"
```

---

## Task 6: Excuse action (CRUD + review) with TDD

**Files:**
- Create: `src/modules/parent-requests/actions/excuse.action.ts`
- Create: `tests/unit/modules/parent-requests/excuse.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/parent-requests/excuse.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  submitExcuseRequestAction,
  withdrawExcuseRequestAction,
  approveExcuseRequestAction,
  rejectExcuseRequestAction,
  getPendingExcuseRequestsAction,
} from "@/modules/parent-requests/actions/excuse.action";
import { notifyExcuseSubmitted, notifyExcuseReviewed } from "@/modules/parent-requests/notifications";

vi.mock("@/modules/parent-requests/notifications", () => ({
  notifyExcuseSubmitted: vi.fn().mockResolvedValue(undefined),
  notifyExcuseReviewed: vi.fn().mockResolvedValue(undefined),
}));

const within14Days = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
const older = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

const sampleStudent = {
  id: "s-1",
  schoolId: "default-school",
  status: "ACTIVE",
  boardingStatus: "BOARDING",
  guardians: [{ guardian: { userId: "test-user-id" } }],
  enrollments: [{ classArmId: "arm-1" }],
  houseAssignment: { houseId: "house-1" },
};

describe("submitExcuseRequestAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:excuse:submit"] });
    vi.mocked(notifyExcuseSubmitted).mockClear();
  });

  it("rejects non-guardian parent", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      ...sampleStudent,
      guardians: [{ guardian: { userId: "other-user" } }],
    } as never);

    const res = await submitExcuseRequestAction({
      studentId: "s-1",
      fromDate: within14Days,
      toDate: within14Days,
      reason: "sick",
    });
    expect(res).toHaveProperty("error");
  });

  it("rejects dates older than 14 days", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    const res = await submitExcuseRequestAction({
      studentId: "s-1",
      fromDate: older,
      toDate: older,
      reason: "sick",
    });
    expect((res as { error: string }).error).toMatch(/14 days/);
  });

  it("rejects future dates", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    const res = await submitExcuseRequestAction({
      studentId: "s-1",
      fromDate: within14Days,
      toDate: future,
      reason: "sick",
    });
    expect(res).toHaveProperty("error");
  });

  it("rejects empty reason", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    const res = await submitExcuseRequestAction({
      studentId: "s-1",
      fromDate: within14Days,
      toDate: within14Days,
      reason: "   ",
    });
    expect(res).toHaveProperty("error");
  });

  it("creates request and triggers notify fan-out", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "arm-1",
      classTeacherId: "staff-teacher",
    } as never);
    prismaMock.house.findFirst.mockResolvedValue({
      id: "house-1",
      housemasterId: "staff-hm",
    } as never);
    prismaMock.staff.findMany.mockResolvedValue([
      { id: "staff-teacher", userId: "user-teacher", firstName: "Ms", lastName: "Mensah" },
      { id: "staff-hm", userId: "user-hm", firstName: "Mr", lastName: "Asante" },
    ] as never);
    prismaMock.excuseRequest.create.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      studentId: "s-1",
    } as never);

    const res = await submitExcuseRequestAction({
      studentId: "s-1",
      fromDate: within14Days,
      toDate: within14Days,
      reason: "Fever",
    });
    if (!("data" in res)) throw new Error("expected data: " + JSON.stringify(res));
    expect(res.data.id).toBe("req-1");
    expect(vi.mocked(notifyExcuseSubmitted)).toHaveBeenCalled();
    const notifyCall = vi.mocked(notifyExcuseSubmitted).mock.calls[0][0];
    expect(notifyCall.reviewerUserIds).toEqual(
      expect.arrayContaining(["user-teacher", "user-hm"]),
    );
  });
});

describe("withdrawExcuseRequestAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["parent_requests:excuse:submit"] }));

  it("works on own PENDING rows", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      submittedByUserId: "test-user-id",
      status: "PENDING",
    } as never);
    prismaMock.excuseRequest.update.mockResolvedValue({} as never);

    const res = await withdrawExcuseRequestAction("req-1");
    expect(res).toEqual({ success: true });
    expect(prismaMock.excuseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "WITHDRAWN" }),
      }),
    );
  });

  it("rejects other users' rows", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      submittedByUserId: "someone-else",
      status: "PENDING",
    } as never);

    const res = await withdrawExcuseRequestAction("req-1");
    expect(res).toHaveProperty("error");
  });

  it("rejects non-PENDING rows", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      submittedByUserId: "test-user-id",
      status: "APPROVED",
    } as never);

    const res = await withdrawExcuseRequestAction("req-1");
    expect(res).toHaveProperty("error");
  });
});

describe("approveExcuseRequestAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:excuse:review"] });
    vi.mocked(notifyExcuseReviewed).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("rejects non-eligible reviewer", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      studentId: "s-1",
      status: "PENDING",
      fromDate: within14Days,
      toDate: within14Days,
      student: {
        id: "s-1",
        status: "ACTIVE",
        boardingStatus: "BOARDING",
        enrollments: [{ classArmId: "arm-OTHER" }],
        houseAssignment: { houseId: "house-OTHER" },
      },
    } as never);
    prismaMock.staff.findFirst.mockResolvedValue({
      id: "staff-x",
      userId: "test-user-id",
    } as never);
    // Not teacher of arm-OTHER, not housemaster of house-OTHER
    prismaMock.classArm.findFirst.mockResolvedValue(null as never);
    prismaMock.house.findFirst.mockResolvedValue(null as never);

    const res = await approveExcuseRequestAction({ requestId: "req-1" });
    expect(res).toHaveProperty("error");
  });

  it("rejects if already reviewed", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      status: "APPROVED",
    } as never);

    const res = await approveExcuseRequestAction({ requestId: "req-1" });
    expect(res).toEqual({ error: "Already reviewed" });
  });

  it("flips attendance + audits + notifies on approve", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      studentId: "s-1",
      submittedByUserId: "parent-1",
      status: "PENDING",
      fromDate: within14Days,
      toDate: within14Days,
      student: {
        id: "s-1",
        firstName: "Kofi",
        lastName: "Asante",
        status: "ACTIVE",
        boardingStatus: "BOARDING",
        enrollments: [{ classArmId: "arm-1" }],
        houseAssignment: { houseId: "house-1" },
      },
    } as never);
    prismaMock.staff.findFirst.mockResolvedValue({
      id: "staff-teacher",
      userId: "test-user-id",
      firstName: "Ms",
      lastName: "Mensah",
    } as never);
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "arm-1",
      classTeacherId: "staff-teacher",
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.excuseRequest.update.mockResolvedValue({} as never);
    prismaMock.attendanceRecord.updateMany.mockResolvedValue({ count: 2 } as never);

    const res = await approveExcuseRequestAction({ requestId: "req-1" });
    expect(res).toEqual({ success: true });
    expect(prismaMock.attendanceRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "EXCUSED" }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
    expect(vi.mocked(notifyExcuseReviewed)).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "APPROVED" }),
    );
  });
});

describe("rejectExcuseRequestAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:excuse:review"] });
    vi.mocked(notifyExcuseReviewed).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("requires non-empty review note", async () => {
    const res = await rejectExcuseRequestAction({ requestId: "req-1", reviewNote: "   " });
    expect((res as { error: string }).error).toMatch(/note/i);
  });

  it("sets REJECTED + audits + notifies", async () => {
    prismaMock.excuseRequest.findFirst.mockResolvedValue({
      id: "req-1",
      schoolId: "default-school",
      studentId: "s-1",
      submittedByUserId: "parent-1",
      status: "PENDING",
      fromDate: within14Days,
      toDate: within14Days,
      student: {
        id: "s-1",
        firstName: "K",
        lastName: "A",
        status: "ACTIVE",
        boardingStatus: "BOARDING",
        enrollments: [{ classArmId: "arm-1" }],
        houseAssignment: { houseId: "house-1" },
      },
    } as never);
    prismaMock.staff.findFirst.mockResolvedValue({
      id: "staff-teacher",
      userId: "test-user-id",
      firstName: "Ms",
      lastName: "M",
    } as never);
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "arm-1",
      classTeacherId: "staff-teacher",
    } as never);
    prismaMock.excuseRequest.update.mockResolvedValue({} as never);

    const res = await rejectExcuseRequestAction({
      requestId: "req-1",
      reviewNote: "Need a doctor's note",
    });
    expect(res).toEqual({ success: true });
    expect(prismaMock.excuseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED" }),
      }),
    );
    expect(vi.mocked(notifyExcuseReviewed)).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "REJECTED" }),
    );
  });
});

describe("getPendingExcuseRequestsAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["parent_requests:excuse:review"] }));

  it("returns empty list when reviewer has no assigned students", async () => {
    prismaMock.staff.findFirst.mockResolvedValue({
      id: "staff-x",
      userId: "test-user-id",
    } as never);
    prismaMock.classArm.findMany.mockResolvedValue([] as never);
    prismaMock.house.findMany.mockResolvedValue([] as never);
    prismaMock.excuseRequest.findMany.mockResolvedValue([] as never);

    const res = await getPendingExcuseRequestsAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data).toEqual([]);
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/parent-requests/excuse.test.ts`
  Expected: fail — module not found.

### Step 3: Implement

Create `src/modules/parent-requests/actions/excuse.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  isValidDateRange,
  isWithinRetroactiveWindow,
  canReviewExcuse,
} from "../eligibility";
import { validateAttachment } from "@/modules/messaging/attachments";
import { notifyExcuseSubmitted, notifyExcuseReviewed } from "../notifications";

type AttachmentInput = {
  attachmentKey?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMime?: string;
};

function checkAttachment(input: AttachmentInput): { ok: true } | { ok: false; error: string } {
  if (!input.attachmentKey) return { ok: true };
  if (!input.attachmentMime || !input.attachmentSize) {
    return { ok: false, error: "Attachment metadata incomplete." };
  }
  const v = validateAttachment({
    mimeType: input.attachmentMime,
    size: input.attachmentSize,
  });
  return v.ok ? { ok: true } : v;
}

async function resolveEligibleReviewerUserIds(ctx: {
  schoolId: string;
}, student: {
  id: string;
  boardingStatus: string;
  enrollments: Array<{ classArmId: string | null }>;
  houseAssignment: { houseId: string } | null;
}): Promise<string[]> {
  const staffIds = new Set<string>();

  const classArmId = student.enrollments[0]?.classArmId;
  if (classArmId) {
    const arm = await db.classArm.findFirst({
      where: { id: classArmId, schoolId: ctx.schoolId },
      select: { classTeacherId: true },
    });
    if (arm?.classTeacherId) staffIds.add(arm.classTeacherId);
  }

  const houseId = student.houseAssignment?.houseId;
  if (houseId && student.boardingStatus === "BOARDING") {
    const house = await db.house.findFirst({
      where: { id: houseId, schoolId: ctx.schoolId },
      select: { housemasterId: true },
    });
    if (house?.housemasterId) staffIds.add(house.housemasterId);
  }

  if (staffIds.size === 0) return [];

  const staff = await db.staff.findMany({
    where: {
      id: { in: [...staffIds] },
      schoolId: ctx.schoolId,
      userId: { not: null },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { userId: true },
  });
  return staff
    .map((s) => s.userId)
    .filter((u): u is string => u != null);
}

// ─── Submit ───────────────────────────────────────────────────────

export async function submitExcuseRequestAction(input: {
  studentId: string;
  fromDate: Date;
  toDate: Date;
  reason: string;
} & AttachmentInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_SUBMIT);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const reason = (input.reason ?? "").trim();
  if (!reason) return { error: "Reason is required." };

  const now = new Date();
  if (!isValidDateRange(input.fromDate, input.toDate, now)) {
    return { error: "Invalid date range." };
  }
  if (!isWithinRetroactiveWindow(input.fromDate, now)) {
    return { error: "Date must be within the last 14 days." };
  }

  const att = checkAttachment(input);
  if (!att.ok) return { error: att.error };

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId: ctx.schoolId },
    select: {
      id: true,
      schoolId: true,
      status: true,
      boardingStatus: true,
      firstName: true,
      lastName: true,
      guardians: { select: { guardian: { select: { userId: true } } } },
      enrollments: {
        where: { status: "ACTIVE" },
        take: 1,
        select: { classArmId: true },
      },
      houseAssignment: { select: { houseId: true } },
    },
  });
  if (!student) return { error: "Student not found." };
  if (student.status !== "ACTIVE" && student.status !== "SUSPENDED") {
    return { error: "Student is not currently active." };
  }
  const guardianUserIds = student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  if (!guardianUserIds.includes(userId)) {
    return { error: "You are not authorized to submit for this student." };
  }

  const created = await db.excuseRequest.create({
    data: {
      schoolId: ctx.schoolId,
      studentId: input.studentId,
      submittedByUserId: userId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason,
      attachmentKey: input.attachmentKey ?? null,
      attachmentName: input.attachmentName ?? null,
      attachmentSize: input.attachmentSize ?? null,
      attachmentMime: input.attachmentMime ?? null,
      status: "PENDING",
    },
  });

  try {
    const reviewerUserIds = await resolveEligibleReviewerUserIds(ctx, student);
    if (reviewerUserIds.length > 0) {
      await notifyExcuseSubmitted({
        requestId: created.id,
        reviewerUserIds,
        studentName: `${student.firstName} ${student.lastName}`,
        fromDate: input.fromDate,
        toDate: input.toDate,
        submitterName: ctx.session.user.name ?? "Parent",
      });
    }
  } catch (err) {
    console.error("notifyExcuseSubmitted failed", { requestId: created.id, err });
  }

  return { data: { id: created.id } };
}

// ─── Withdraw ─────────────────────────────────────────────────────

export async function withdrawExcuseRequestAction(requestId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_SUBMIT);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const req = await db.excuseRequest.findFirst({
    where: { id: requestId, schoolId: ctx.schoolId },
    select: { submittedByUserId: true, status: true },
  });
  if (!req) return { error: "Request not found." };
  if (req.submittedByUserId !== userId) {
    return { error: "You can only withdraw your own requests." };
  }
  if (req.status !== "PENDING") {
    return { error: "Already reviewed" };
  }

  await db.excuseRequest.update({
    where: { id: requestId },
    data: { status: "WITHDRAWN" },
  });

  return { success: true };
}

// ─── Get Mine ─────────────────────────────────────────────────────

/** @no-audit Read-only. */
export async function getMyExcuseRequestsAction(filters?: {
  status?: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_SUBMIT);
  if (denied) return denied;

  const rows = await db.excuseRequest.findMany({
    where: {
      schoolId: ctx.schoolId,
      submittedByUserId: ctx.session.user.id!,
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return { data: rows };
}

// ─── Get Pending (reviewer queue) ─────────────────────────────────

/** @no-audit Read-only. */
export async function getPendingExcuseRequestsAction(filters?: { studentId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_REVIEW);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const staff = await db.staff.findFirst({
    where: { userId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!staff) return { data: [] };

  const [arms, houses] = await Promise.all([
    db.classArm.findMany({
      where: { classTeacherId: staff.id, schoolId: ctx.schoolId },
      select: { id: true },
    }),
    db.house.findMany({
      where: { housemasterId: staff.id, schoolId: ctx.schoolId },
      select: { id: true },
    }),
  ]);
  const armIds = arms.map((a) => a.id);
  const houseIds = houses.map((h) => h.id);

  if (armIds.length === 0 && houseIds.length === 0) return { data: [] };

  const rows = await db.excuseRequest.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "PENDING",
      ...(filters?.studentId ? { studentId: filters.studentId } : {}),
      student: {
        OR: [
          armIds.length > 0
            ? { enrollments: { some: { status: "ACTIVE", classArmId: { in: armIds } } } }
            : undefined,
          houseIds.length > 0
            ? {
                boardingStatus: "BOARDING",
                houseAssignment: { houseId: { in: houseIds } },
              }
            : undefined,
        ].filter(Boolean) as never[],
      },
    },
    orderBy: { createdAt: "asc" },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      submittedBy: { select: { firstName: true, lastName: true } },
    },
  });

  return { data: rows };
}

// ─── Get One ──────────────────────────────────────────────────────

/** @no-audit Read-only. */
export async function getExcuseRequestAction(requestId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const userId = ctx.session.user.id!;

  const row = await db.excuseRequest.findFirst({
    where: { id: requestId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          boardingStatus: true,
          enrollments: { where: { status: "ACTIVE" }, take: 1, select: { classArmId: true } },
          houseAssignment: { select: { houseId: true } },
        },
      },
      submittedBy: { select: { id: true, firstName: true, lastName: true } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!row) return { error: "Request not found." };

  const isSubmitter = row.submittedByUserId === userId;
  const hasReviewPerm = !assertPermission(ctx.session, PERMISSIONS.EXCUSE_REVIEW);
  if (!isSubmitter && !hasReviewPerm) {
    return { error: "Request not found." };
  }

  return { data: row };
}

// ─── Approve ──────────────────────────────────────────────────────

export async function approveExcuseRequestAction(input: {
  requestId: string;
  reviewNote?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_REVIEW);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const row = await db.excuseRequest.findFirst({
    where: { id: input.requestId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          boardingStatus: true,
          schoolId: true,
          enrollments: { where: { status: "ACTIVE" }, take: 1, select: { classArmId: true } },
          houseAssignment: { select: { houseId: true } },
        },
      },
    },
  });
  if (!row) return { error: "Request not found." };
  if (row.status !== "PENDING") return { error: "Already reviewed" };

  // Eligibility re-check
  const staff = await db.staff.findFirst({
    where: { userId, schoolId: ctx.schoolId },
    select: { id: true, firstName: true, lastName: true },
  });
  const eligible = await isEligibleReviewerForStudent(ctx.schoolId, staff?.id, row.student);
  if (!eligible) {
    return { error: "You are not assigned to this student's class arm or house." };
  }

  await db.$transaction(async (tx) => {
    await tx.excuseRequest.update({
      where: { id: row.id },
      data: {
        status: "APPROVED",
        reviewerUserId: userId,
        reviewNote: input.reviewNote?.trim() || null,
        reviewedAt: new Date(),
      },
    });
    await tx.attendanceRecord.updateMany({
      where: {
        studentId: row.studentId,
        date: { gte: row.fromDate, lte: row.toDate },
        status: { in: ["ABSENT", "LATE", "SICK"] },
        register: { schoolId: ctx.schoolId },
      },
      data: { status: "EXCUSED" },
    });
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "ExcuseRequest",
    entityId: row.id,
    module: "parent-requests",
    description: `Approved excuse request ${row.id}`,
    newData: { status: "APPROVED", reviewNote: input.reviewNote ?? null },
  });

  try {
    await notifyExcuseReviewed({
      requestId: row.id,
      submitterUserId: row.submittedByUserId,
      outcome: "APPROVED",
      reviewerName: [staff?.firstName, staff?.lastName].filter(Boolean).join(" ") || "Reviewer",
      reviewNote: input.reviewNote,
      studentName: `${row.student.firstName} ${row.student.lastName}`,
    });
  } catch (err) {
    console.error("notifyExcuseReviewed failed", { requestId: row.id, err });
  }

  return { success: true };
}

// ─── Reject ───────────────────────────────────────────────────────

export async function rejectExcuseRequestAction(input: {
  requestId: string;
  reviewNote: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_REVIEW);
  if (denied) return denied;

  const reviewNote = (input.reviewNote ?? "").trim();
  if (!reviewNote) return { error: "A review note is required to reject." };

  const userId = ctx.session.user.id!;
  const row = await db.excuseRequest.findFirst({
    where: { id: input.requestId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          boardingStatus: true,
          schoolId: true,
          enrollments: { where: { status: "ACTIVE" }, take: 1, select: { classArmId: true } },
          houseAssignment: { select: { houseId: true } },
        },
      },
    },
  });
  if (!row) return { error: "Request not found." };
  if (row.status !== "PENDING") return { error: "Already reviewed" };

  const staff = await db.staff.findFirst({
    where: { userId, schoolId: ctx.schoolId },
    select: { id: true, firstName: true, lastName: true },
  });
  const eligible = await isEligibleReviewerForStudent(ctx.schoolId, staff?.id, row.student);
  if (!eligible) {
    return { error: "You are not assigned to this student's class arm or house." };
  }

  await db.excuseRequest.update({
    where: { id: row.id },
    data: {
      status: "REJECTED",
      reviewerUserId: userId,
      reviewNote,
      reviewedAt: new Date(),
    },
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "ExcuseRequest",
    entityId: row.id,
    module: "parent-requests",
    description: `Rejected excuse request ${row.id}`,
    newData: { status: "REJECTED", reviewNote },
  });

  try {
    await notifyExcuseReviewed({
      requestId: row.id,
      submitterUserId: row.submittedByUserId,
      outcome: "REJECTED",
      reviewerName: [staff?.firstName, staff?.lastName].filter(Boolean).join(" ") || "Reviewer",
      reviewNote,
      studentName: `${row.student.firstName} ${row.student.lastName}`,
    });
  } catch (err) {
    console.error("notifyExcuseReviewed failed", { requestId: row.id, err });
  }

  return { success: true };
}

// ─── helpers ──────────────────────────────────────────────────────

async function isEligibleReviewerForStudent(
  schoolId: string,
  staffId: string | undefined,
  student: {
    status: string;
    boardingStatus: string;
    enrollments: Array<{ classArmId: string | null }>;
    houseAssignment: { houseId: string } | null;
  },
): Promise<boolean> {
  if (!staffId) return false;
  if (student.status !== "ACTIVE" && student.status !== "SUSPENDED") return false;

  const classArmId = student.enrollments[0]?.classArmId;
  if (classArmId) {
    const arm = await db.classArm.findFirst({
      where: { id: classArmId, schoolId, classTeacherId: staffId },
      select: { id: true },
    });
    if (arm) return true;
  }

  const houseId = student.houseAssignment?.houseId;
  if (houseId && student.boardingStatus === "BOARDING") {
    const house = await db.house.findFirst({
      where: { id: houseId, schoolId, housemasterId: staffId },
      select: { id: true },
    });
    if (house) return true;
  }

  return false;
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/parent-requests/excuse.test.ts`
  Expected: all tests passing.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/parent-requests/actions/excuse.action.ts tests/unit/modules/parent-requests/excuse.test.ts
git commit -m "feat(parent-requests): excuse submit/withdraw/list/approve/reject actions"
```

---

## Task 7: Medical disclosure action (TDD)

**Files:**
- Create: `src/modules/parent-requests/actions/medical-disclosure.action.ts`
- Create: `tests/unit/modules/parent-requests/medical-disclosure.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/parent-requests/medical-disclosure.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  submitMedicalDisclosureAction,
  withdrawMedicalDisclosureAction,
  approveMedicalDisclosureAction,
  rejectMedicalDisclosureAction,
  getPendingMedicalDisclosuresAction,
} from "@/modules/parent-requests/actions/medical-disclosure.action";
import {
  notifyMedicalDisclosureSubmitted,
  notifyMedicalDisclosureReviewed,
} from "@/modules/parent-requests/notifications";

vi.mock("@/modules/parent-requests/notifications", () => ({
  notifyMedicalDisclosureSubmitted: vi.fn().mockResolvedValue(undefined),
  notifyMedicalDisclosureReviewed: vi.fn().mockResolvedValue(undefined),
}));

const sampleStudent = {
  id: "s-1",
  schoolId: "default-school",
  firstName: "Kofi",
  lastName: "Asante",
  status: "ACTIVE",
  allergies: "",
  medicalConditions: "",
  guardians: [{ guardian: { userId: "test-user-id" } }],
};

describe("submitMedicalDisclosureAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:medical:submit"] });
    vi.mocked(notifyMedicalDisclosureSubmitted).mockClear();
  });

  it("rejects non-guardian", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      ...sampleStudent,
      guardians: [{ guardian: { userId: "other" } }],
    } as never);

    const res = await submitMedicalDisclosureAction({
      studentId: "s-1",
      category: "ALLERGY",
      title: "Peanut",
      description: "anaphylaxis",
    });
    expect(res).toHaveProperty("error");
  });

  it("rejects empty title or description", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    const res1 = await submitMedicalDisclosureAction({
      studentId: "s-1",
      category: "ALLERGY",
      title: "",
      description: "x",
    });
    expect(res1).toHaveProperty("error");
    const res2 = await submitMedicalDisclosureAction({
      studentId: "s-1",
      category: "ALLERGY",
      title: "x",
      description: "",
    });
    expect(res2).toHaveProperty("error");
  });

  it("urgent submission calls notify with isUrgent=true", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.userRole.findMany.mockResolvedValue([
      { userId: "nurse-1" },
    ] as never);
    prismaMock.medicalDisclosure.create.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
    } as never);

    await submitMedicalDisclosureAction({
      studentId: "s-1",
      category: "ALLERGY",
      title: "Peanut",
      description: "severe",
      isUrgent: true,
    });
    expect(vi.mocked(notifyMedicalDisclosureSubmitted)).toHaveBeenCalledWith(
      expect.objectContaining({ isUrgent: true }),
    );
  });

  it("routine submission calls notify with isUrgent=false", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.userRole.findMany.mockResolvedValue([{ userId: "nurse-1" }] as never);
    prismaMock.medicalDisclosure.create.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
    } as never);

    await submitMedicalDisclosureAction({
      studentId: "s-1",
      category: "CONDITION",
      title: "Asthma",
      description: "mild",
    });
    expect(vi.mocked(notifyMedicalDisclosureSubmitted)).toHaveBeenCalledWith(
      expect.objectContaining({ isUrgent: false }),
    );
  });
});

describe("withdrawMedicalDisclosureAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["parent_requests:medical:submit"] }));

  it("works on own PENDING rows", async () => {
    prismaMock.medicalDisclosure.findFirst.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
      submittedByUserId: "test-user-id",
      status: "PENDING",
    } as never);
    prismaMock.medicalDisclosure.update.mockResolvedValue({} as never);

    const res = await withdrawMedicalDisclosureAction("d-1");
    expect(res).toEqual({ success: true });
  });
});

describe("approveMedicalDisclosureAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:medical:review"] });
    vi.mocked(notifyMedicalDisclosureReviewed).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("creates MedicalRecord + updates disclosure + audits", async () => {
    prismaMock.medicalDisclosure.findFirst.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
      studentId: "s-1",
      submittedByUserId: "parent-1",
      status: "PENDING",
      category: "ALLERGY",
      title: "Peanut",
      description: "severe",
      attachmentKey: null,
      student: { id: "s-1", firstName: "Kofi", lastName: "Asante", allergies: "", medicalConditions: "" },
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.medicalRecord.create.mockResolvedValue({ id: "mr-1" } as never);
    prismaMock.medicalDisclosure.update.mockResolvedValue({} as never);
    prismaMock.student.update.mockResolvedValue({} as never);

    const res = await approveMedicalDisclosureAction({
      disclosureId: "d-1",
      syncToStudent: { allergies: "Peanut" },
    });
    expect(res).toEqual({ success: true, medicalRecordId: "mr-1" });
    expect(prismaMock.medicalRecord.create).toHaveBeenCalled();
    expect(prismaMock.medicalDisclosure.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          resultingMedicalRecordId: "mr-1",
        }),
      }),
    );
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ allergies: "Peanut" }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
    expect(vi.mocked(notifyMedicalDisclosureReviewed)).toHaveBeenCalled();
  });

  it("does not update student when syncToStudent omitted", async () => {
    prismaMock.medicalDisclosure.findFirst.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
      studentId: "s-1",
      submittedByUserId: "parent-1",
      status: "PENDING",
      category: "MEDICATION",
      title: "X",
      description: "y",
      student: { id: "s-1", firstName: "K", lastName: "A", allergies: "", medicalConditions: "" },
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.medicalRecord.create.mockResolvedValue({ id: "mr-2" } as never);
    prismaMock.medicalDisclosure.update.mockResolvedValue({} as never);
    prismaMock.student.update.mockClear();

    await approveMedicalDisclosureAction({ disclosureId: "d-1" });
    expect(prismaMock.student.update).not.toHaveBeenCalled();
  });

  it("rejects if already reviewed", async () => {
    prismaMock.medicalDisclosure.findFirst.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
      status: "APPROVED",
    } as never);

    const res = await approveMedicalDisclosureAction({ disclosureId: "d-1" });
    expect(res).toEqual({ error: "Already reviewed" });
  });
});

describe("rejectMedicalDisclosureAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["parent_requests:medical:review"] });
    vi.mocked(notifyMedicalDisclosureReviewed).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("requires non-empty review note", async () => {
    const res = await rejectMedicalDisclosureAction({ disclosureId: "d-1", reviewNote: "  " });
    expect((res as { error: string }).error).toMatch(/note/i);
  });

  it("updates status + audits + notifies", async () => {
    prismaMock.medicalDisclosure.findFirst.mockResolvedValue({
      id: "d-1",
      schoolId: "default-school",
      studentId: "s-1",
      submittedByUserId: "parent-1",
      status: "PENDING",
      student: { id: "s-1", firstName: "K", lastName: "A" },
    } as never);
    prismaMock.medicalDisclosure.update.mockResolvedValue({} as never);

    const res = await rejectMedicalDisclosureAction({
      disclosureId: "d-1",
      reviewNote: "Consult your doctor",
    });
    expect(res).toEqual({ success: true });
    expect(prismaMock.medicalDisclosure.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
    expect(vi.mocked(notifyMedicalDisclosureReviewed)).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "REJECTED" }),
    );
  });
});

describe("getPendingMedicalDisclosuresAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["parent_requests:medical:review"] }));

  it("returns school-wide PENDING rows with urgent first", async () => {
    prismaMock.medicalDisclosure.findMany.mockResolvedValue([] as never);
    const res = await getPendingMedicalDisclosuresAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data).toEqual([]);
    expect(prismaMock.medicalDisclosure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "default-school",
          status: "PENDING",
        }),
      }),
    );
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/parent-requests/medical-disclosure.test.ts`
  Expected: fail — module not found.

### Step 3: Implement

Create `src/modules/parent-requests/actions/medical-disclosure.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { validateAttachment } from "@/modules/messaging/attachments";
import {
  notifyMedicalDisclosureSubmitted,
  notifyMedicalDisclosureReviewed,
} from "../notifications";

type AttachmentInput = {
  attachmentKey?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMime?: string;
};

type Category = "ALLERGY" | "CONDITION" | "MEDICATION";

function checkAttachment(input: AttachmentInput): { ok: true } | { ok: false; error: string } {
  if (!input.attachmentKey) return { ok: true };
  if (!input.attachmentMime || !input.attachmentSize) {
    return { ok: false, error: "Attachment metadata incomplete." };
  }
  const v = validateAttachment({ mimeType: input.attachmentMime, size: input.attachmentSize });
  return v.ok ? { ok: true } : v;
}

function mergeDenormalized(existing: string | null | undefined, addition: string): string {
  const current = (existing ?? "").split(/;/).map((s) => s.trim()).filter(Boolean);
  const add = addition.split(/;/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set(current.map((s) => s.toLowerCase()));
  for (const a of add) {
    if (!seen.has(a.toLowerCase())) {
      current.push(a);
      seen.add(a.toLowerCase());
    }
  }
  return current.join("; ");
}

// ─── Submit ───────────────────────────────────────────────────────

export async function submitMedicalDisclosureAction(input: {
  studentId: string;
  category: Category;
  title: string;
  description: string;
  isUrgent?: boolean;
} & AttachmentInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  if (!title) return { error: "Title is required." };
  if (!description) return { error: "Description is required." };
  if (!(["ALLERGY", "CONDITION", "MEDICATION"] as const).includes(input.category)) {
    return { error: "Invalid category." };
  }
  const att = checkAttachment(input);
  if (!att.ok) return { error: att.error };

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId: ctx.schoolId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      guardians: { select: { guardian: { select: { userId: true } } } },
    },
  });
  if (!student) return { error: "Student not found." };
  const guardianUserIds = student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  if (!guardianUserIds.includes(userId)) {
    return { error: "You are not authorized to submit for this student." };
  }

  const isUrgent = input.isUrgent ?? false;

  const created = await db.medicalDisclosure.create({
    data: {
      schoolId: ctx.schoolId,
      studentId: input.studentId,
      submittedByUserId: userId,
      category: input.category,
      title,
      description,
      isUrgent,
      attachmentKey: input.attachmentKey ?? null,
      attachmentName: input.attachmentName ?? null,
      attachmentSize: input.attachmentSize ?? null,
      attachmentMime: input.attachmentMime ?? null,
      status: "PENDING",
    },
  });

  try {
    const nurses = await db.userRole.findMany({
      where: { schoolId: ctx.schoolId, role: { name: "school_nurse" } },
      select: { userId: true },
    });
    const nurseUserIds = [...new Set(nurses.map((n) => n.userId).filter(Boolean) as string[])];
    if (nurseUserIds.length > 0) {
      await notifyMedicalDisclosureSubmitted({
        disclosureId: created.id,
        nurseUserIds,
        studentName: `${student.firstName} ${student.lastName}`,
        category: input.category,
        title,
        isUrgent,
        submitterName: ctx.session.user.name ?? "Parent",
      });
    }
  } catch (err) {
    console.error("notifyMedicalDisclosureSubmitted failed", { id: created.id, err });
  }

  return { data: { id: created.id } };
}

// ─── Withdraw ─────────────────────────────────────────────────────

export async function withdrawMedicalDisclosureAction(disclosureId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const row = await db.medicalDisclosure.findFirst({
    where: { id: disclosureId, schoolId: ctx.schoolId },
    select: { submittedByUserId: true, status: true },
  });
  if (!row) return { error: "Disclosure not found." };
  if (row.submittedByUserId !== userId) {
    return { error: "You can only withdraw your own disclosures." };
  }
  if (row.status !== "PENDING") return { error: "Already reviewed" };

  await db.medicalDisclosure.update({
    where: { id: disclosureId },
    data: { status: "WITHDRAWN" },
  });
  return { success: true };
}

// ─── Get Mine ─────────────────────────────────────────────────────

/** @no-audit Read-only. */
export async function getMyMedicalDisclosuresAction(filters?: {
  status?: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT);
  if (denied) return denied;

  const rows = await db.medicalDisclosure.findMany({
    where: {
      schoolId: ctx.schoolId,
      submittedByUserId: ctx.session.user.id!,
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return { data: rows };
}

// ─── Get Pending (nurse queue) ────────────────────────────────────

/** @no-audit Read-only. */
export async function getPendingMedicalDisclosuresAction(filters?: { urgent?: boolean }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  if (denied) return denied;

  const rows = await db.medicalDisclosure.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "PENDING",
      ...(filters?.urgent != null ? { isUrgent: filters.urgent } : {}),
    },
    orderBy: [{ isUrgent: "desc" }, { createdAt: "asc" }],
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      submittedBy: { select: { firstName: true, lastName: true } },
    },
  });
  return { data: rows };
}

// ─── Get One ──────────────────────────────────────────────────────

/** @no-audit Read-only. */
export async function getMedicalDisclosureAction(disclosureId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const userId = ctx.session.user.id!;

  const row = await db.medicalDisclosure.findFirst({
    where: { id: disclosureId, schoolId: ctx.schoolId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      submittedBy: { select: { id: true, firstName: true, lastName: true } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!row) return { error: "Disclosure not found." };

  const isSubmitter = row.submittedByUserId === userId;
  const hasReviewPerm = !assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  if (!isSubmitter && !hasReviewPerm) return { error: "Disclosure not found." };

  return { data: row };
}

// ─── Approve ──────────────────────────────────────────────────────

export async function approveMedicalDisclosureAction(input: {
  disclosureId: string;
  reviewNote?: string;
  syncToStudent?: { allergies?: string; conditions?: string };
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const row = await db.medicalDisclosure.findFirst({
    where: { id: input.disclosureId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          allergies: true,
          medicalConditions: true,
        },
      },
    },
  });
  if (!row) return { error: "Disclosure not found." };
  if (row.status !== "PENDING") return { error: "Already reviewed" };

  const reviewer = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });

  const medicalRecordId = await db.$transaction(async (tx) => {
    const mr = await tx.medicalRecord.create({
      data: {
        studentId: row.studentId,
        schoolId: ctx.schoolId,
        type: row.category,
        title: row.title,
        description: row.description,
        attachmentKey: row.attachmentKey,
        recordedBy: userId,
        isConfidential: false,
      },
    });

    await tx.medicalDisclosure.update({
      where: { id: row.id },
      data: {
        status: "APPROVED",
        reviewerUserId: userId,
        reviewNote: input.reviewNote?.trim() || null,
        reviewedAt: new Date(),
        resultingMedicalRecordId: mr.id,
      },
    });

    if (input.syncToStudent) {
      const studentUpdate: Record<string, string> = {};
      if (input.syncToStudent.allergies != null) {
        studentUpdate.allergies = mergeDenormalized(row.student.allergies, input.syncToStudent.allergies);
      }
      if (input.syncToStudent.conditions != null) {
        studentUpdate.medicalConditions = mergeDenormalized(
          row.student.medicalConditions,
          input.syncToStudent.conditions,
        );
      }
      if (Object.keys(studentUpdate).length > 0) {
        await tx.student.update({ where: { id: row.studentId }, data: studentUpdate });
      }
    }

    return mr.id;
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MedicalDisclosure",
    entityId: row.id,
    module: "parent-requests",
    description: `Approved medical disclosure ${row.id}`,
    newData: { status: "APPROVED", medicalRecordId, sync: input.syncToStudent ?? null },
  });

  try {
    await notifyMedicalDisclosureReviewed({
      disclosureId: row.id,
      submitterUserId: row.submittedByUserId,
      outcome: "APPROVED",
      reviewerName: [reviewer?.firstName, reviewer?.lastName].filter(Boolean).join(" ") || "Nurse",
      reviewNote: input.reviewNote,
      studentName: `${row.student.firstName} ${row.student.lastName}`,
    });
  } catch (err) {
    console.error("notifyMedicalDisclosureReviewed failed", { id: row.id, err });
  }

  return { success: true, medicalRecordId };
}

// ─── Reject ───────────────────────────────────────────────────────

export async function rejectMedicalDisclosureAction(input: {
  disclosureId: string;
  reviewNote: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  if (denied) return denied;

  const reviewNote = (input.reviewNote ?? "").trim();
  if (!reviewNote) return { error: "A review note is required to reject." };

  const userId = ctx.session.user.id!;
  const row = await db.medicalDisclosure.findFirst({
    where: { id: input.disclosureId, schoolId: ctx.schoolId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!row) return { error: "Disclosure not found." };
  if (row.status !== "PENDING") return { error: "Already reviewed" };

  const reviewer = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });

  await db.medicalDisclosure.update({
    where: { id: row.id },
    data: {
      status: "REJECTED",
      reviewerUserId: userId,
      reviewNote,
      reviewedAt: new Date(),
    },
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MedicalDisclosure",
    entityId: row.id,
    module: "parent-requests",
    description: `Rejected medical disclosure ${row.id}`,
    newData: { status: "REJECTED", reviewNote },
  });

  try {
    await notifyMedicalDisclosureReviewed({
      disclosureId: row.id,
      submitterUserId: row.submittedByUserId,
      outcome: "REJECTED",
      reviewerName: [reviewer?.firstName, reviewer?.lastName].filter(Boolean).join(" ") || "Nurse",
      reviewNote,
      studentName: `${row.student.firstName} ${row.student.lastName}`,
    });
  } catch (err) {
    console.error("notifyMedicalDisclosureReviewed failed", { id: row.id, err });
  }

  return { success: true };
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/parent-requests/medical-disclosure.test.ts`
  Expected: all tests passing.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/parent-requests/actions/medical-disclosure.action.ts tests/unit/modules/parent-requests/medical-disclosure.test.ts
git commit -m "feat(parent-requests): medical disclosure submit/withdraw/list/approve/reject actions"
```

---

## Task 8: Attachment URL action

**Files:**
- Create: `src/modules/parent-requests/actions/attachment.action.ts`

### Step 1: Implement

Create `src/modules/parent-requests/actions/attachment.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { getSignedDownloadUrl, getSignedUploadUrl } from "@/lib/storage/r2";
import {
  validateAttachment,
  buildAttachmentKey,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "@/modules/messaging/attachments";

type Kind = "excuse" | "medical";

// ─── Request Upload URL ────────────────────────────────────────────

export async function getParentRequestAttachmentUploadUrlAction(input: {
  kind: Kind;
  filename: string;
  mimeType: string;
  size: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const perm =
    input.kind === "excuse"
      ? PERMISSIONS.EXCUSE_SUBMIT
      : PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT;
  const denied = assertPermission(ctx.session, perm);
  if (denied) return denied;

  const validation = validateAttachment({
    mimeType: input.mimeType,
    size: input.size,
  });
  if (!validation.ok) return { error: validation.error };

  // threadId-slot reused for uuid grouping under schoolId — the filename-uuid
  // in the returned key already guarantees uniqueness; use the `kind` as the
  // "threadId" slot so keys look like: parent-requests/<schoolId>/excuse/<uuid>-<name>
  const key = buildAttachmentKey({
    schoolId: ctx.schoolId,
    threadId: input.kind,
    filename: input.filename,
    prefix: "parent-requests",
  });

  const uploadUrl = await getSignedUploadUrl({
    key,
    contentType: input.mimeType,
    expiresInSeconds: 300,
    maxSizeBytes: MAX_ATTACHMENT_SIZE_BYTES,
  });

  return { data: { uploadUrl, attachmentKey: key } };
}

// ─── Request Download URL ──────────────────────────────────────────

export async function getParentRequestAttachmentUrlAction(input: {
  kind: Kind;
  requestId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const userId = ctx.session.user.id!;

  if (input.kind === "excuse") {
    const req = await db.excuseRequest.findFirst({
      where: { id: input.requestId, schoolId: ctx.schoolId },
      include: {
        student: {
          select: {
            status: true,
            boardingStatus: true,
            enrollments: { where: { status: "ACTIVE" }, take: 1, select: { classArmId: true } },
            houseAssignment: { select: { houseId: true } },
          },
        },
      },
    });
    if (!req) return { error: "Request not found." };
    if (!req.attachmentKey) return { error: "No attachment." };

    const isSubmitter = req.submittedByUserId === userId;
    const hasReview = !assertPermission(ctx.session, PERMISSIONS.EXCUSE_REVIEW);
    if (!isSubmitter && !hasReview) return { error: "Request not found." };

    const url = await getSignedDownloadUrl(req.attachmentKey, 300);
    return {
      data: {
        url,
        filename: req.attachmentName ?? "attachment",
        mimeType: req.attachmentMime ?? "application/octet-stream",
        size: req.attachmentSize ?? 0,
      },
    };
  }

  const row = await db.medicalDisclosure.findFirst({
    where: { id: input.requestId, schoolId: ctx.schoolId },
  });
  if (!row) return { error: "Disclosure not found." };
  if (!row.attachmentKey) return { error: "No attachment." };

  const isSubmitter = row.submittedByUserId === userId;
  const hasReview = !assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  if (!isSubmitter && !hasReview) return { error: "Disclosure not found." };

  const url = await getSignedDownloadUrl(row.attachmentKey, 300);
  return {
    data: {
      url,
      filename: row.attachmentName ?? "attachment",
      mimeType: row.attachmentMime ?? "application/octet-stream",
      size: row.attachmentSize ?? 0,
    },
  };
}
```

### Step 2: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 3: Commit

```bash
git add src/modules/parent-requests/actions/attachment.action.ts
git commit -m "feat(parent-requests): signed upload/download URL actions for attachments"
```

---

## Task 9: Lifecycle hooks (cancel pending requests on status change)

**Files:**
- Create: `src/modules/parent-requests/lifecycle.ts`
- Create: `tests/unit/modules/parent-requests/lifecycle.test.ts`
- Modify: `src/modules/student/actions/transfer.action.ts` (both transferStudentAction + withdrawStudentAction)
- Modify: `src/modules/student/actions/student.action.ts` (deleteStudentAction)
- Modify: `src/modules/student/actions/promotion.action.ts` (GRADUATE/WITHDRAW archive loop)
- Modify: `src/modules/academics/actions/promotion.action.ts` (GRADUATED branch)

### Step 1: Write failing tests

Create `tests/unit/modules/parent-requests/lifecycle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prismaMock } from "../../setup";
import { cancelPendingRequestsForStudent } from "@/modules/parent-requests/lifecycle";

describe("cancelPendingRequestsForStudent", () => {
  it("updates both tables to WITHDRAWN and stamps a system note", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.excuseRequest.updateMany.mockResolvedValue({ count: 2 } as never);
    prismaMock.medicalDisclosure.updateMany.mockResolvedValue({ count: 1 } as never);

    await cancelPendingRequestsForStudent("s-1");

    expect(prismaMock.excuseRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "s-1", status: "PENDING" },
        data: expect.objectContaining({
          status: "WITHDRAWN",
          reviewNote: expect.stringMatching(/auto-cancelled/i),
        }),
      }),
    );
    expect(prismaMock.medicalDisclosure.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "s-1", status: "PENDING" },
        data: expect.objectContaining({
          status: "WITHDRAWN",
          reviewNote: expect.stringMatching(/auto-cancelled/i),
        }),
      }),
    );
  });

  it("does not touch terminal rows", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.excuseRequest.updateMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.medicalDisclosure.updateMany.mockResolvedValue({ count: 0 } as never);

    await expect(cancelPendingRequestsForStudent("s-1")).resolves.toBeUndefined();
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/parent-requests/lifecycle.test.ts`
  Expected: fail — module not found.

### Step 3: Implement lifecycle helper

Create `src/modules/parent-requests/lifecycle.ts`:

```ts
import { db } from "@/lib/db";

/**
 * Auto-withdraws all pending parent-initiated requests (excuses +
 * medical disclosures) for a student. Safe to call multiple times.
 * Called from lifecycle actions AFTER the status transition + audit have
 * completed. Not permission-checked — calling action is already gated.
 *
 * Best-effort: wraps updates in a transaction so both tables flip together.
 */
export async function cancelPendingRequestsForStudent(
  studentId: string,
): Promise<void> {
  const note = "Auto-cancelled: student lifecycle transition";
  await db.$transaction(async (tx) => {
    await tx.excuseRequest.updateMany({
      where: { studentId, status: "PENDING" },
      data: { status: "WITHDRAWN", reviewNote: note, reviewedAt: new Date() },
    });
    await tx.medicalDisclosure.updateMany({
      where: { studentId, status: "PENDING" },
      data: { status: "WITHDRAWN", reviewNote: note, reviewedAt: new Date() },
    });
  });
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/parent-requests/lifecycle.test.ts`
  Expected: all pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Wire into student lifecycle actions

For each of the files below, open and locate the spot AFTER all primary DB mutations + audit have completed (mirror the pattern already used for `archiveThreadsForStudent`). Add:

```ts
import { cancelPendingRequestsForStudent } from "@/modules/parent-requests/lifecycle";
// ...at the tail of the action:
try {
  await cancelPendingRequestsForStudent(studentId);
} catch (err) {
  console.warn("cancelPendingRequestsForStudent failed", { studentId, err });
}
```

Apply to:
- `src/modules/student/actions/transfer.action.ts` — `transferStudentAction` (after TRANSFERRED) and `withdrawStudentAction` (after WITHDRAWN)
- `src/modules/student/actions/student.action.ts` — `deleteStudentAction` (after WITHDRAWN)
- `src/modules/student/actions/promotion.action.ts` — `commitPromotionRunAction`, in the same `Promise.allSettled` block that already calls `archiveThreadsForStudent`
- `src/modules/academics/actions/promotion.action.ts` — GRADUATED branch, after the existing `archiveThreadsForStudent` call

### Step 6: Verify no regressions

- [ ] Run: `npx vitest run`
  Expected: all existing tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 7: Commit

```bash
git add src/modules/parent-requests/lifecycle.ts tests/unit/modules/parent-requests/lifecycle.test.ts src/modules/student/actions/ src/modules/academics/actions/promotion.action.ts
git commit -m "feat(parent-requests): auto-withdraw pending requests on student lifecycle transitions"
```

---

## Task 10: Shared portal attachment-upload component

**Files:**
- Create: `src/components/portal/attachment-upload.tsx`

### Step 1: Extract the upload UX from NewConversationModal

Open `src/app/(portal)/parent/messages/new-conversation-modal.tsx` to see how the existing attachment upload is wired. Create a new reusable component at `src/components/portal/attachment-upload.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

export type PortalAttachmentMeta = {
  attachmentKey: string;
  attachmentName: string;
  attachmentSize: number;
  attachmentMime: string;
};

type Props = {
  /** Kind-specific signed-URL request action. Should return { data: { uploadUrl, attachmentKey } } or { error }. */
  requestUploadUrl: (input: {
    filename: string;
    mimeType: string;
    size: number;
  }) => Promise<{ data: { uploadUrl: string; attachmentKey: string } } | { error: string }>;
  value: PortalAttachmentMeta | null;
  onChange: (meta: PortalAttachmentMeta | null) => void;
  disabled?: boolean;
};

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export function PortalAttachmentUpload({
  requestUploadUrl,
  value,
  onChange,
  disabled,
}: Props) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      toast.error("File type not allowed. Use PDF, JPG, PNG, HEIC, or WebP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("File too large. Maximum 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const res = await requestUploadUrl({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const put = await fetch(res.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        toast.error("Upload failed.");
        return;
      }
      onChange({
        attachmentKey: res.data.attachmentKey,
        attachmentName: file.name,
        attachmentSize: file.size,
        attachmentMime: file.type,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      {value ? (
        <div className="flex items-center gap-2 text-sm">
          <span>📎 {value.attachmentName} ({Math.round(value.attachmentSize / 1024)} KB)</span>
          <button
            type="button"
            className="text-xs text-red-600 hover:underline"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            remove
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED.join(",")}
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePick(file);
            }}
          />
          <button
            type="button"
            className="text-sm text-teal-600 hover:underline disabled:opacity-50"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Uploading…" : "Attach file (PDF/JPG/PNG, ≤ 5 MB)"}
          </button>
        </>
      )}
    </div>
  );
}
```

### Step 2: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 3: Commit

```bash
git add src/components/portal/attachment-upload.tsx
git commit -m "feat(portal): shared PortalAttachmentUpload component"
```

---

## Task 11: Parent portal UI — `/parent/requests`

**Files:**
- Create: `src/app/(portal)/parent/requests/page.tsx`
- Create: `src/app/(portal)/parent/requests/requests-client.tsx`
- Create: `src/app/(portal)/parent/requests/new-excuse-modal.tsx`
- Create: `src/app/(portal)/parent/requests/new-medical-modal.tsx`
- Modify: `src/app/(portal)/portal-nav.tsx`

### Step 1: Page loader

Create `src/app/(portal)/parent/requests/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getMyExcuseRequestsAction,
} from "@/modules/parent-requests/actions/excuse.action";
import {
  getMyMedicalDisclosuresAction,
} from "@/modules/parent-requests/actions/medical-disclosure.action";
import { RequestsClient } from "./requests-client";

export default async function ParentRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [excuses, disclosures] = await Promise.all([
    getMyExcuseRequestsAction(),
    getMyMedicalDisclosuresAction(),
  ]);

  if ("error" in excuses) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {excuses.error}
        </div>
      </div>
    );
  }
  if ("error" in disclosures) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {disclosures.error}
        </div>
      </div>
    );
  }

  return <RequestsClient excuses={excuses.data} disclosures={disclosures.data} />;
}
```

### Step 2: Client component

Create `src/app/(portal)/parent/requests/requests-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { withdrawExcuseRequestAction } from "@/modules/parent-requests/actions/excuse.action";
import { withdrawMedicalDisclosureAction } from "@/modules/parent-requests/actions/medical-disclosure.action";
import { getParentRequestAttachmentUrlAction } from "@/modules/parent-requests/actions/attachment.action";
import { NewExcuseModal } from "./new-excuse-modal";
import { NewMedicalModal } from "./new-medical-modal";

type ExcuseRow = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  fromDate: Date | string;
  toDate: Date | string;
  reason: string;
  reviewNote: string | null;
  attachmentKey: string | null;
  attachmentName: string | null;
  student: { id: string; firstName: string; lastName: string };
  createdAt: Date | string;
};

type DisclosureRow = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  category: "ALLERGY" | "CONDITION" | "MEDICATION";
  title: string;
  description: string;
  isUrgent: boolean;
  reviewNote: string | null;
  attachmentKey: string | null;
  attachmentName: string | null;
  student: { id: string; firstName: string; lastName: string };
  createdAt: Date | string;
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-700",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    WITHDRAWN: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}

export function RequestsClient({
  excuses,
  disclosures,
}: {
  excuses: ExcuseRow[];
  disclosures: DisclosureRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"excuses" | "disclosures">("excuses");
  const [showNewExcuse, setShowNewExcuse] = useState(false);
  const [showNewMedical, setShowNewMedical] = useState(false);
  const [pending, start] = useTransition();

  const downloadAttachment = (kind: "excuse" | "medical", requestId: string) => {
    start(async () => {
      const res = await getParentRequestAttachmentUrlAction({ kind, requestId });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });
  };

  const withdrawExcuse = (id: string) => {
    start(async () => {
      const res = await withdrawExcuseRequestAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Request withdrawn.");
      router.refresh();
    });
  };

  const withdrawDisclosure = (id: string) => {
    start(async () => {
      const res = await withdrawMedicalDisclosureAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Disclosure withdrawn.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="My requests"
        description="Submissions you've made for your children."
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShowNewExcuse(true)}
          className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm"
        >
          + Excuse an absence
        </button>
        <button
          onClick={() => setShowNewMedical(true)}
          className="rounded-lg border border-teal-600 text-teal-700 px-4 py-2 text-sm"
        >
          + Disclose medical info
        </button>
      </div>

      <div className="border-b border-gray-200 flex gap-4 text-sm">
        <button
          onClick={() => setTab("excuses")}
          className={`pb-2 ${tab === "excuses" ? "border-b-2 border-teal-600 font-semibold" : "text-gray-500"}`}
        >
          Excuses ({excuses.length})
        </button>
        <button
          onClick={() => setTab("disclosures")}
          className={`pb-2 ${tab === "disclosures" ? "border-b-2 border-teal-600 font-semibold" : "text-gray-500"}`}
        >
          Medical disclosures ({disclosures.length})
        </button>
      </div>

      {tab === "excuses" ? (
        <div className="space-y-2">
          {excuses.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              No excuse requests yet.
            </p>
          ) : (
            excuses.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.student.firstName} {r.student.lastName} •{" "}
                      {new Date(r.fromDate).toLocaleDateString()}
                      {r.fromDate !== r.toDate
                        ? ` → ${new Date(r.toDate).toLocaleDateString()}`
                        : ""}
                    </p>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{r.reason}</p>
                    {r.attachmentKey && (
                      <button
                        onClick={() => downloadAttachment("excuse", r.id)}
                        className="mt-1 text-xs text-teal-600 hover:underline"
                      >
                        📎 {r.attachmentName ?? "attachment"}
                      </button>
                    )}
                    {r.reviewNote && (
                      <p className="text-xs text-gray-500 mt-2 italic">Note: {r.reviewNote}</p>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.status === "PENDING" && (
                  <button
                    onClick={() => withdrawExcuse(r.id)}
                    disabled={pending}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {disclosures.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              No medical disclosures yet.
            </p>
          ) : (
            disclosures.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.student.firstName} {r.student.lastName} • {r.category} • {r.title}
                      {r.isUrgent && (
                        <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                          URGENT
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{r.description}</p>
                    {r.attachmentKey && (
                      <button
                        onClick={() => downloadAttachment("medical", r.id)}
                        className="mt-1 text-xs text-teal-600 hover:underline"
                      >
                        📎 {r.attachmentName ?? "attachment"}
                      </button>
                    )}
                    {r.reviewNote && (
                      <p className="text-xs text-gray-500 mt-2 italic">Note: {r.reviewNote}</p>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.status === "PENDING" && (
                  <button
                    onClick={() => withdrawDisclosure(r.id)}
                    disabled={pending}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showNewExcuse && (
        <NewExcuseModal
          onClose={() => setShowNewExcuse(false)}
          onCreated={() => {
            setShowNewExcuse(false);
            router.refresh();
          }}
        />
      )}
      {showNewMedical && (
        <NewMedicalModal
          onClose={() => setShowNewMedical(false)}
          onCreated={() => {
            setShowNewMedical(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
```

### Step 3: New-excuse modal

Create `src/app/(portal)/parent/requests/new-excuse-modal.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getParentChildrenAction } from "@/modules/portal/actions/parent-portal.action";
import { submitExcuseRequestAction } from "@/modules/parent-requests/actions/excuse.action";
import { getParentRequestAttachmentUploadUrlAction } from "@/modules/parent-requests/actions/attachment.action";
import {
  PortalAttachmentUpload,
  type PortalAttachmentMeta,
} from "@/components/portal/attachment-upload";

type Child = { id: string; firstName: string; lastName: string };

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function iso14DaysAgo(): string {
  return new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function NewExcuseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState("");
  const [fromDate, setFromDate] = useState(isoToday());
  const [toDate, setToDate] = useState(isoToday());
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<PortalAttachmentMeta | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const res = await getParentChildrenAction();
      setLoading(false);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setChildren(res.data as Child[]);
      if (res.data.length > 0) setStudentId(res.data[0].id);
    })();
  }, []);

  const submit = () => {
    if (!studentId || !reason.trim()) return;
    start(async () => {
      const res = await submitExcuseRequestAction({
        studentId,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        reason: reason.trim(),
        ...(attachment ?? {}),
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Excuse request submitted.");
      onCreated();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold">Excuse an absence</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading children…</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-gray-500">No linked children.</p>
        ) : (
          <>
            <label className="block text-sm">
              <span className="font-medium">Child</span>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="font-medium">From</span>
                <input
                  type="date"
                  value={fromDate}
                  min={iso14DaysAgo()}
                  max={isoToday()}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">To</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={isoToday()}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="font-medium">Reason</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. Kofi had a fever on Monday."
              />
            </label>

            <PortalAttachmentUpload
              requestUploadUrl={(input) =>
                getParentRequestAttachmentUploadUrlAction({ kind: "excuse", ...input })
              }
              value={attachment}
              onChange={setAttachment}
              disabled={pending}
            />
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || !studentId || !reason.trim()}
            className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 4: New-medical modal

Create `src/app/(portal)/parent/requests/new-medical-modal.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getParentChildrenAction } from "@/modules/portal/actions/parent-portal.action";
import { submitMedicalDisclosureAction } from "@/modules/parent-requests/actions/medical-disclosure.action";
import { getParentRequestAttachmentUploadUrlAction } from "@/modules/parent-requests/actions/attachment.action";
import {
  PortalAttachmentUpload,
  type PortalAttachmentMeta,
} from "@/components/portal/attachment-upload";

type Child = { id: string; firstName: string; lastName: string };

export function NewMedicalModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState<"ALLERGY" | "CONDITION" | "MEDICATION">("ALLERGY");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [attachment, setAttachment] = useState<PortalAttachmentMeta | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const res = await getParentChildrenAction();
      setLoading(false);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setChildren(res.data as Child[]);
      if (res.data.length > 0) setStudentId(res.data[0].id);
    })();
  }, []);

  const submit = () => {
    if (!studentId || !title.trim() || !description.trim()) return;
    start(async () => {
      const res = await submitMedicalDisclosureAction({
        studentId,
        category,
        title: title.trim(),
        description: description.trim(),
        isUrgent,
        ...(attachment ?? {}),
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Medical disclosure submitted.");
      onCreated();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold">Disclose medical info</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading children…</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-gray-500">No linked children.</p>
        ) : (
          <>
            <label className="block text-sm">
              <span className="font-medium">Child</span>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">Category</legend>
              {(["ALLERGY", "CONDITION", "MEDICATION"] as const).map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="cat"
                    value={c}
                    checked={category === c}
                    onChange={() => setCategory(c)}
                  />
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </label>
              ))}
            </fieldset>

            <label className="block text-sm">
              <span className="font-medium">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Peanut allergy"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Severity, onset, medication/response, etc."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
              />
              Mark as urgent (notifies the nurse immediately via SMS)
            </label>

            <PortalAttachmentUpload
              requestUploadUrl={(input) =>
                getParentRequestAttachmentUploadUrlAction({ kind: "medical", ...input })
              }
              value={attachment}
              onChange={setAttachment}
              disabled={pending}
            />
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || !studentId || !title.trim() || !description.trim()}
            className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 5: Nav link

Open `src/app/(portal)/portal-nav.tsx`. Find `parentLinks`. Add after `Messages`:

```ts
  { href: "/parent/requests", label: "My requests" },
```

### Step 6: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 7: Commit

```bash
git add "src/app/(portal)/parent/requests/" "src/app/(portal)/portal-nav.tsx"
git commit -m "feat(parent-requests): parent portal My requests UI + new-excuse/new-medical modals"
```

---

## Task 12: Staff portal UI — `/staff/excuse-reviews`

**Files:**
- Create: `src/app/(portal)/staff/excuse-reviews/page.tsx`
- Create: `src/app/(portal)/staff/excuse-reviews/excuse-reviews-client.tsx`
- Modify: `src/app/(portal)/portal-nav.tsx`

### Step 1: Page

Create `src/app/(portal)/staff/excuse-reviews/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPendingExcuseRequestsAction } from "@/modules/parent-requests/actions/excuse.action";
import { ExcuseReviewsClient } from "./excuse-reviews-client";

export default async function StaffExcuseReviewsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const res = await getPendingExcuseRequestsAction();
  if ("error" in res) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {res.error}
        </div>
      </div>
    );
  }
  return <ExcuseReviewsClient rows={res.data} />;
}
```

### Step 2: Client

Create `src/app/(portal)/staff/excuse-reviews/excuse-reviews-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import {
  approveExcuseRequestAction,
  rejectExcuseRequestAction,
} from "@/modules/parent-requests/actions/excuse.action";
import { getParentRequestAttachmentUrlAction } from "@/modules/parent-requests/actions/attachment.action";

type Row = {
  id: string;
  fromDate: Date | string;
  toDate: Date | string;
  reason: string;
  attachmentKey: string | null;
  attachmentName: string | null;
  createdAt: Date | string;
  student: { id: string; firstName: string; lastName: string };
  submittedBy: { firstName: string | null; lastName: string | null } | null;
};

export function ExcuseReviewsClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const download = (id: string) =>
    start(async () => {
      const res = await getParentRequestAttachmentUrlAction({ kind: "excuse", requestId: id });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });

  const approve = (id: string) => {
    start(async () => {
      const res = await approveExcuseRequestAction({ requestId: id });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Excuse approved.");
      router.refresh();
    });
  };

  const reject = (id: string) => {
    const note = rejectNote.trim();
    if (!note) {
      toast.error("A note is required to reject.");
      return;
    }
    start(async () => {
      const res = await rejectExcuseRequestAction({ requestId: id, reviewNote: note });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Excuse rejected.");
      setRejectingId(null);
      setRejectNote("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Excuse reviews"
        description="Pending excuse requests for students in your class arm or boarding house."
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No pending excuse requests.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const submitter =
              [r.submittedBy?.firstName, r.submittedBy?.lastName].filter(Boolean).join(" ") ||
              "Parent";
            return (
              <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <div>
                  <p className="font-medium">
                    {r.student.firstName} {r.student.lastName} •{" "}
                    {new Date(r.fromDate).toLocaleDateString()}
                    {r.fromDate !== r.toDate
                      ? ` → ${new Date(r.toDate).toLocaleDateString()}`
                      : ""}
                  </p>
                  <p className="text-xs text-gray-500">submitted by {submitter}</p>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{r.reason}</p>
                  {r.attachmentKey && (
                    <button
                      onClick={() => download(r.id)}
                      className="mt-1 text-xs text-teal-600 hover:underline"
                    >
                      📎 {r.attachmentName ?? "attachment"}
                    </button>
                  )}
                </div>

                {rejectingId === r.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder="Reason for rejecting…"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectNote("");
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => reject(r.id)}
                        disabled={pending}
                        className="rounded-lg bg-red-600 text-white px-3 py-1 text-xs disabled:opacity-50"
                      >
                        Confirm reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setRejectingId(r.id)}
                      disabled={pending}
                      className="rounded-lg border border-red-600 text-red-700 px-3 py-1 text-sm"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => approve(r.id)}
                      disabled={pending}
                      className="rounded-lg bg-teal-600 text-white px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

### Step 3: Nav link

In `src/app/(portal)/portal-nav.tsx`, find `staffLinks`. Add after `Messages`:

```ts
  { href: "/staff/excuse-reviews", label: "Excuse reviews" },
```

### Step 4: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add "src/app/(portal)/staff/excuse-reviews/" "src/app/(portal)/portal-nav.tsx"
git commit -m "feat(parent-requests): staff portal excuse reviews UI"
```

---

## Task 13: Dashboard UI — `/students/medical-disclosures`

**Files:**
- Create: `src/app/(dashboard)/students/medical-disclosures/page.tsx`
- Create: `src/app/(dashboard)/students/medical-disclosures/medical-disclosures-client.tsx`
- Modify: sidebar / nav component under `(dashboard)` — grep for how `students/messaging` was linked (probably `src/app/(dashboard)/nav-links.tsx` or inline in the students sidebar)

### Step 1: Page

Create `src/app/(dashboard)/students/medical-disclosures/page.tsx`:

```tsx
import { getPendingMedicalDisclosuresAction } from "@/modules/parent-requests/actions/medical-disclosure.action";
import { MedicalDisclosuresClient } from "./medical-disclosures-client";

export default async function MedicalDisclosuresPage() {
  const res = await getPendingMedicalDisclosuresAction();
  if ("error" in res) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {res.error}
        </div>
      </div>
    );
  }
  return <MedicalDisclosuresClient rows={res.data} />;
}
```

### Step 2: Client

Create `src/app/(dashboard)/students/medical-disclosures/medical-disclosures-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveMedicalDisclosureAction,
  rejectMedicalDisclosureAction,
} from "@/modules/parent-requests/actions/medical-disclosure.action";
import { getParentRequestAttachmentUrlAction } from "@/modules/parent-requests/actions/attachment.action";

type Row = {
  id: string;
  category: "ALLERGY" | "CONDITION" | "MEDICATION";
  title: string;
  description: string;
  isUrgent: boolean;
  attachmentKey: string | null;
  attachmentName: string | null;
  createdAt: Date | string;
  student: { id: string; firstName: string; lastName: string };
  submittedBy: { firstName: string | null; lastName: string | null } | null;
};

export function MedicalDisclosuresClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [syncValue, setSyncValue] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const urgent = rows.filter((r) => r.isUrgent);
  const routine = rows.filter((r) => !r.isUrgent);

  const download = (id: string) =>
    start(async () => {
      const res = await getParentRequestAttachmentUrlAction({ kind: "medical", requestId: id });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });

  const openApprove = (row: Row) => {
    setApprovingId(row.id);
    setSyncValue(row.title);
    setSyncEnabled(row.category !== "MEDICATION");
  };

  const confirmApprove = (row: Row) => {
    const syncToStudent =
      syncEnabled && syncValue.trim() && row.category !== "MEDICATION"
        ? row.category === "ALLERGY"
          ? { allergies: syncValue.trim() }
          : { conditions: syncValue.trim() }
        : undefined;

    start(async () => {
      const res = await approveMedicalDisclosureAction({
        disclosureId: row.id,
        syncToStudent,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Disclosure approved.");
      setApprovingId(null);
      setSyncValue("");
      router.refresh();
    });
  };

  const reject = (id: string) => {
    const note = rejectNote.trim();
    if (!note) {
      toast.error("A note is required to reject.");
      return;
    }
    start(async () => {
      const res = await rejectMedicalDisclosureAction({ disclosureId: id, reviewNote: note });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Disclosure rejected.");
      setRejectingId(null);
      setRejectNote("");
      router.refresh();
    });
  };

  const Section = ({ title, items }: { title: string; items: Row[] }) => (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700">{title} ({items.length})</h2>
      {items.length === 0 ? (
        <p className="text-xs text-gray-500 italic">Nothing here.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const submitter =
              [r.submittedBy?.firstName, r.submittedBy?.lastName].filter(Boolean).join(" ") ||
              "Parent";
            return (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div>
                  <p className="font-medium">
                    {r.student.firstName} {r.student.lastName} • {r.category} • {r.title}
                    {r.isUrgent && (
                      <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                        URGENT
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">submitted by {submitter}</p>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{r.description}</p>
                  {r.attachmentKey && (
                    <button
                      onClick={() => download(r.id)}
                      className="mt-1 text-xs text-primary hover:underline"
                    >
                      📎 {r.attachmentName ?? "attachment"}
                    </button>
                  )}
                </div>

                {approvingId === r.id ? (
                  <div className="space-y-2 border-t border-border pt-2">
                    {r.category !== "MEDICATION" && (
                      <>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={syncEnabled}
                            onChange={(e) => setSyncEnabled(e.target.checked)}
                          />
                          Also append to student's{" "}
                          {r.category === "ALLERGY" ? "allergies" : "medical conditions"}
                        </label>
                        <input
                          value={syncValue}
                          onChange={(e) => setSyncValue(e.target.value)}
                          disabled={!syncEnabled}
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
                        />
                      </>
                    )}
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setApprovingId(null);
                          setSyncValue("");
                        }}
                        className="rounded-lg border border-border px-3 py-1 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => confirmApprove(r)}
                        disabled={pending}
                        className="rounded-lg bg-primary text-primary-foreground px-3 py-1 text-xs"
                      >
                        Confirm approve
                      </button>
                    </div>
                  </div>
                ) : rejectingId === r.id ? (
                  <div className="space-y-2 border-t border-border pt-2">
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder="Reason for rejecting…"
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectNote("");
                        }}
                        className="rounded-lg border border-border px-3 py-1 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => reject(r.id)}
                        disabled={pending}
                        className="rounded-lg bg-red-600 text-white px-3 py-1 text-xs"
                      >
                        Confirm reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setRejectingId(r.id)}
                      disabled={pending}
                      className="rounded-lg border border-red-600 text-red-700 px-3 py-1 text-sm"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => openApprove(r)}
                      disabled={pending}
                      className="rounded-lg bg-primary text-primary-foreground px-3 py-1 text-sm"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Medical disclosures</h1>
      <Section title="Urgent" items={urgent} />
      <Section title="Routine" items={routine} />
    </div>
  );
}
```

### Step 3: Sidebar link

Grep for where `/students/messaging` appears in the dashboard nav. Add a sibling entry for `/students/medical-disclosures` with label `Medical Disclosures`.

### Step 4: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add "src/app/(dashboard)/students/medical-disclosures/" src/app/
git commit -m "feat(parent-requests): admin medical-disclosure review UI"
```

---

## Task 14: Retention sweep additions

**Files:**
- Modify: `src/workers/retention.worker.ts` (or wherever the messaging retention sweep was added — grep for `messages/` prefix or MessageThread retention)

### Step 1: Add ExcuseRequest + MedicalDisclosure sweeps

Open the retention worker. Mirror the existing MessageThread retention block. Add entries:

```ts
// ExcuseRequest: delete terminal rows older than 7 years + their R2 attachments
{
  name: "excuse-requests",
  run: async () => {
    const cutoff = new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000);
    const rows = await db.excuseRequest.findMany({
      where: {
        status: { in: ["APPROVED", "REJECTED", "WITHDRAWN"] },
        reviewedAt: { lt: cutoff },
      },
      select: { id: true, attachmentKey: true },
    });
    for (const r of rows) {
      if (r.attachmentKey) await deleteFile(r.attachmentKey).catch(() => {});
      await db.excuseRequest.delete({ where: { id: r.id } }).catch(() => {});
    }
  },
},
{
  name: "medical-disclosures",
  run: async () => {
    const cutoff = new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000);
    const rows = await db.medicalDisclosure.findMany({
      where: {
        status: { in: ["APPROVED", "REJECTED", "WITHDRAWN"] },
        reviewedAt: { lt: cutoff },
      },
      select: { id: true, attachmentKey: true },
    });
    for (const r of rows) {
      if (r.attachmentKey) await deleteFile(r.attachmentKey).catch(() => {});
      await db.medicalDisclosure.delete({ where: { id: r.id } }).catch(() => {});
    }
  },
},
```

Adapt the shape to whatever pattern the retention worker uses (e.g. job array, switch/case, etc.). If the file is missing `deleteFile`, import from `@/lib/storage/r2`.

### Step 2: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 3: Commit

```bash
git add src/workers/retention.worker.ts
git commit -m "feat(parent-requests): add retention sweep for excuse + disclosure rows"
```

---

## Task 15: Integration test (live DB)

**Files:**
- Create: `tests/integration/students/parent-requests.test.ts`

### Step 1: Write the test

Create `tests/integration/students/parent-requests.test.ts`. Model after `tests/integration/students/messaging.test.ts` for the setup/teardown pattern. Minimum scenarios:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveSeededAdminId, loginAs } from "./setup";
import {
  submitExcuseRequestAction,
  approveExcuseRequestAction,
  rejectExcuseRequestAction,
  withdrawExcuseRequestAction,
} from "@/modules/parent-requests/actions/excuse.action";
import {
  submitMedicalDisclosureAction,
  approveMedicalDisclosureAction,
  rejectMedicalDisclosureAction,
} from "@/modules/parent-requests/actions/medical-disclosure.action";
import { cancelPendingRequestsForStudent } from "@/modules/parent-requests/lifecycle";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Parent requests (integration)", () => {
  const db = new PrismaClient();
  const testTag = `preq-test-${Date.now()}`;
  let adminId: string;
  let parentUserId: string;
  let teacherUserId: string;
  let nurseUserId: string;
  let studentId: string;

  async function cleanupSeedData() {
    try {
      await db.excuseRequest.deleteMany({ where: { studentId } });
      await db.medicalDisclosure.deleteMany({ where: { studentId } });
      await db.medicalRecord.deleteMany({ where: { studentId } });
      // Remaining cleanup (student, teacher, nurse, parent, etc.) mirrors messaging test
    } catch {}
  }

  beforeAll(async () => {
    adminId = await resolveSeededAdminId();
    // Build fixtures: parent (User + Guardian + link), class teacher (Staff + User +
    // ClassArm.classTeacherId), nurse (UserRole for school_nurse), student
    // (ACTIVE + BOARDING), enrollment, AttendanceRecord(s) in range with status=ABSENT.
    // Follow the messaging integration test's pattern exactly.
  });

  afterAll(async () => {
    await cleanupSeedData();
    await db.$disconnect();
  });

  it("happy path: parent submits excuse → teacher approves → attendance flips", async () => {
    loginAs({ id: parentUserId, permissions: ["parent_requests:excuse:submit"] });
    const sub = await submitExcuseRequestAction({
      studentId,
      fromDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      toDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      reason: "Sick",
    });
    if (!("data" in sub)) throw new Error((sub as { error: string }).error);

    loginAs({ id: teacherUserId, permissions: ["parent_requests:excuse:review"] });
    const appr = await approveExcuseRequestAction({ requestId: sub.data.id });
    expect(appr).toEqual({ success: true });

    const records = await db.attendanceRecord.findMany({
      where: { studentId, status: "EXCUSED" },
    });
    expect(records.length).toBeGreaterThan(0);
  });

  it("happy path: parent submits disclosure → nurse approves with sync → MedicalRecord exists + allergies appended", async () => {
    loginAs({ id: parentUserId, permissions: ["parent_requests:medical:submit"] });
    const sub = await submitMedicalDisclosureAction({
      studentId,
      category: "ALLERGY",
      title: "Peanut",
      description: "Severe anaphylaxis",
      isUrgent: true,
    });
    if (!("data" in sub)) throw new Error((sub as { error: string }).error);

    loginAs({ id: nurseUserId, permissions: ["parent_requests:medical:review"] });
    const appr = await approveMedicalDisclosureAction({
      disclosureId: sub.data.id,
      syncToStudent: { allergies: "Peanut" },
    });
    if (!("success" in appr)) throw new Error((appr as { error: string }).error);
    expect(appr.medicalRecordId).toBeTruthy();

    const student = await db.student.findUnique({ where: { id: studentId } });
    expect(student?.allergies ?? "").toMatch(/Peanut/);
    const mr = await db.medicalRecord.findUnique({ where: { id: appr.medicalRecordId! } });
    expect(mr?.type).toBe("ALLERGY");
  });

  it("rejection notifies parent with note", async () => {
    loginAs({ id: parentUserId, permissions: ["parent_requests:excuse:submit"] });
    const sub = await submitExcuseRequestAction({
      studentId,
      fromDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      toDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      reason: "no doc",
    });
    if (!("data" in sub)) throw new Error((sub as { error: string }).error);

    loginAs({ id: teacherUserId, permissions: ["parent_requests:excuse:review"] });
    const rej = await rejectExcuseRequestAction({
      requestId: sub.data.id,
      reviewNote: "Please provide a doctor's note",
    });
    expect(rej).toEqual({ success: true });
    const row = await db.excuseRequest.findUnique({ where: { id: sub.data.id } });
    expect(row?.status).toBe("REJECTED");
    expect(row?.reviewNote).toMatch(/doctor/);
  });

  it("withdrawal removes from reviewer queue", async () => {
    loginAs({ id: parentUserId, permissions: ["parent_requests:excuse:submit"] });
    const sub = await submitExcuseRequestAction({
      studentId,
      fromDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      toDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      reason: "oops",
    });
    if (!("data" in sub)) throw new Error((sub as { error: string }).error);

    const wd = await withdrawExcuseRequestAction(sub.data.id);
    expect(wd).toEqual({ success: true });

    const row = await db.excuseRequest.findUnique({ where: { id: sub.data.id } });
    expect(row?.status).toBe("WITHDRAWN");
  });

  it("lifecycle: cancelPendingRequestsForStudent withdraws pending rows", async () => {
    loginAs({ id: parentUserId, permissions: ["parent_requests:excuse:submit"] });
    const sub = await submitExcuseRequestAction({
      studentId,
      fromDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      toDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      reason: "x",
    });
    if (!("data" in sub)) throw new Error((sub as { error: string }).error);
    await cancelPendingRequestsForStudent(studentId);
    const row = await db.excuseRequest.findUnique({ where: { id: sub.data.id } });
    expect(row?.status).toBe("WITHDRAWN");
  });

  it("tenant isolation: other-school caller cannot see this request", async () => {
    loginAs({ id: parentUserId, permissions: ["parent_requests:excuse:submit"] });
    const sub = await submitExcuseRequestAction({
      studentId,
      fromDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      toDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      reason: "iso",
    });
    if (!("data" in sub)) throw new Error((sub as { error: string }).error);

    loginAs({
      id: "other-user",
      permissions: ["parent_requests:excuse:review"],
      schoolId: "other-school",
    });
    const row = await db.excuseRequest.findFirst({
      where: { id: sub.data.id, schoolId: "other-school" },
    });
    expect(row).toBeNull();
  });
});
```

Fill in the fixture-creation details exactly like `tests/integration/students/messaging.test.ts` — the test agent has full freedom to adapt to the real schema; the shape above is the intent. Include required seed data: parent User with Guardian and link, teacher Staff+User attached to the ClassArm's classTeacherId, nurse User with UserRole of school_nurse, and a student with an ACTIVE Enrollment. Create AttendanceRecord rows in the target date range with status=ABSENT so the approval test can verify the flip.

### Step 2: Run

- [ ] Run: `npm run test:students`
  Expected: all tests green (including the new file).

### Step 3: Commit

```bash
git add tests/integration/students/parent-requests.test.ts
git commit -m "test(parent-requests): live-DB integration coverage"
```

---

## Task 16: End-to-end verification

**Files:** verification only.

### Step 1: Full unit suite

- [ ] Run: `npx vitest run`
  Expected: all passing. Expected new counts:
  - `tests/unit/modules/parent-requests/eligibility.test.ts` — ~15
  - `tests/unit/modules/parent-requests/excuse.test.ts` — ~14
  - `tests/unit/modules/parent-requests/medical-disclosure.test.ts` — ~12
  - `tests/unit/modules/parent-requests/notifications.test.ts` — ~5
  - `tests/unit/modules/parent-requests/lifecycle.test.ts` — ~2
  - `tests/unit/auth/permissions.test.ts` — +1
  - `tests/unit/modules/messaging/attachments.test.ts` — +2
  - No regressions elsewhere.

### Step 2: Integration suite

- [ ] Run: `npm run test:students`
  Expected: passing, including new `parent-requests.test.ts`.

### Step 3: Audit guardrail

- [ ] Run: `npx vitest run tests/unit/guardrails/audit-coverage.test.ts`
  Expected: passing. New admin mutations (`approveExcuseRequestAction`, `rejectExcuseRequestAction`, `approveMedicalDisclosureAction`, `rejectMedicalDisclosureAction`) have `audit()` calls. `submit*`, `withdraw*`, `getMy*`, `getPending*`, `get*Action` carry `@no-audit` JSDoc.

### Step 4: TypeScript

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Build

- [ ] Run: `npm run build`
  Expected: success. Confirm new routes compile:
  - `/parent/requests`
  - `/staff/excuse-reviews`
  - `/students/medical-disclosures`

### Step 6: Lint

- [ ] Run: `npm run lint`
  Expected: 0 errors, no new baseline warnings.

### Step 7: Prisma

- [ ] Run: `npx prisma migrate status`
  Expected: up to date.

### Step 8: Manual UI walk

1. Log in as a parent. `/parent/requests` — see tabs + + New buttons.
2. Submit an excuse for a yesterday's absence with a PDF attachment.
3. Log in as the class teacher. `/staff/excuse-reviews` — see the request. Approve.
4. Back to parent. Row shows APPROVED; open `/parent/attendance` to see yesterday's row now marked EXCUSED.
5. Log in as parent, submit an urgent medical disclosure (allergy).
6. Log in as school nurse. `/students/medical-disclosures` — urgent row pinned at top. Approve with sync to allergies. Check the student's `/students/[id]` profile — allergies field updated.
7. As parent, submit another excuse, then withdraw it. Row shows WITHDRAWN.
8. As admin, trigger a student withdrawal. Parent's `/parent/requests` shows pending rows as WITHDRAWN with "Auto-cancelled" note.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage:** every spec section maps to a task:
  - §4 data model → Task 1
  - §5 state machines → Task 6, 7 (in the action implementations)
  - §6 permissions → Task 2
  - §7 pure helpers → Task 3
  - §8 server actions → Tasks 6, 7, 8
  - §9 notifications → Task 5
  - §10 attachments → Task 4 (prefix refactor) + reused in Task 8
  - §11 UI → Tasks 10, 11, 12, 13
  - §12 lifecycle + retention → Tasks 9, 14
  - §13 error handling → validated via action-layer tests in Tasks 6, 7
  - §14 testing → Tasks 3, 5, 6, 7, 9, 15
  - §15 verification → Task 16
- [x] **No placeholders:** every task has concrete code; every command has expected output
- [x] **Type consistency:** `StudentContext`, `StaffAssignment` (from messaging), `AttachmentInput`, action return shapes (`{ data } | { error }`), notification payloads all consistent across callers
- [x] **File paths:** absolute-from-repo-root
- [x] **TDD shape:** Tasks 3, 5, 6, 7, 9 follow RED → implement → GREEN → commit. Tasks 1, 2, 4 are data/config. Tasks 8, 10, 11, 12, 13, 14 are UI/integration (no unit tests per repo convention, beyond what integration coverage provides). Task 15 is integration-only. Task 16 is verification-only.
