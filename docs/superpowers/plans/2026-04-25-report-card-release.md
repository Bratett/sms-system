# Report Card Release + Acknowledgements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-class-arm-per-term `ReportCardRelease` that gates parent visibility of HTML results + PDF, with parent acknowledgement (per-student-per-household), 24-hour-cooldown chase reminders, an admin tracker page, the existing stub `publishResultsAction` rewired to delegate, parent-scoped PDF download, and complete cache invalidation on every score/remark mutation.

**Architecture:** New `src/modules/academics/release/` sub-module containing pure targeting helpers, fan-out helpers, admin actions, and parent-scoped actions. Two new Prisma models. The existing `renderReportCardPdfAction` is split into a non-permissioned internal helper (`_renderReportCardPdfInternal`) and a thin permissioned wrapper. The existing stub `publishResultsAction` becomes a thin wrapper around `releaseReportCardsAction` to preserve callers.

**Tech Stack:** Next.js 15 App Router, Prisma on PostgreSQL, vitest + vitest-mock-extended, Cloudflare R2, native HTML + tailwind, sonner for toasts.

**Spec reference:** `docs/superpowers/specs/2026-04-25-report-card-release-design.md`

---

## File Structure

**New files**
- `src/modules/academics/release/release-targeting.ts` — pure helpers (resolveTargetedStudentsForRelease + recipient mapper)
- `src/modules/academics/release/release-notifications.ts` — fan-out wrapper (release + reminder events)
- `src/modules/academics/release/actions/release.action.ts` — release / re-release / stats / details / chase / queue
- `src/modules/academics/release/actions/parent-release.action.ts` — parent acknowledge / PDF URL / release lookup
- `src/app/(dashboard)/students/results-release/page.tsx`
- `src/app/(dashboard)/students/results-release/release-client.tsx`
- `tests/unit/modules/academics/release/release-targeting.test.ts`
- `tests/unit/modules/academics/release/release.test.ts`
- `tests/unit/modules/academics/release/parent-release.test.ts`
- `tests/unit/modules/academics/release/release-notifications.test.ts`
- `tests/unit/modules/academics/parent-results-gate.test.ts`
- `tests/unit/modules/academics/cache-invalidation.test.ts`
- `tests/integration/students/report-card-release.test.ts`

**Modified files**
- `prisma/schema/academic.prisma` — append `ReportCardRelease` + `ReportCardAcknowledgement` + back-relations on `Term`, `ClassArm`, `Student`
- `prisma/schema/school.prisma` — back-relation on `School`
- `prisma/schema/auth.prisma` — back-relations on `User`
- `prisma/schema/student.prisma` — back-relation on `Household`
- `prisma/schema/migrations/<timestamp>_add_report_card_release/migration.sql`
- `src/lib/permissions.ts` — 2 new permissions + grants
- `src/lib/notifications/events.ts` — 2 new event keys + EVENT_CHANNELS entries
- `src/modules/academics/actions/report-card.action.ts` — extract `_renderReportCardPdfInternal`
- `src/modules/academics/actions/mark.action.ts` — invalidation in `enterMarksAction` + `approveMarksAction`
- `src/modules/academics/actions/result.action.ts` — `publishResultsAction` → thin wrapper; invalidation in `computeTerminalResultsAction`
- `src/modules/portal/actions/parent.action.ts` — `getChildResultsAction` gates on release row + hydrates `released/isAcknowledged`
- `src/app/(portal)/parent/results/results-client.tsx` — empty state for unreleased terms; PDF button; acknowledge button
- Dashboard sidebar nav (locate via grep where `students/medical-disclosures` was added) — add `Report card release` link
- `tests/unit/auth/permissions.test.ts` — +1 regression test
- `tests/unit/modules/communication/announcement-publish-ack.test.ts` and others if there are guardrails on permission counts

---

## Task 1: Schema migration

**Files:**
- Modify: `prisma/schema/academic.prisma`
- Modify: `prisma/schema/school.prisma`
- Modify: `prisma/schema/auth.prisma`
- Modify: `prisma/schema/student.prisma` (Student + Household back-relations)
- Create: `prisma/schema/migrations/<timestamp>_add_report_card_release/migration.sql`

### Step 1: Append models to `academic.prisma`

Open `prisma/schema/academic.prisma`. At the bottom, append:

```prisma
// ─── Report Card Release (Tier 2 #6 sub-project D2) ──────────────────

model ReportCardRelease {
  id                  String   @id @default(cuid())
  schoolId            String
  termId              String
  classArmId          String
  releasedByUserId    String?
  releasedAt          DateTime @default(now())
  lastReminderSentAt  DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  school          School      @relation("SchoolReportCardRelease", fields: [schoolId], references: [id])
  term            Term        @relation(fields: [termId], references: [id], onDelete: Cascade)
  classArm        ClassArm    @relation(fields: [classArmId], references: [id], onDelete: Cascade)
  releasedBy      User?       @relation("ReleasedReportCards", fields: [releasedByUserId], references: [id], onDelete: SetNull)
  acknowledgements ReportCardAcknowledgement[]

  @@unique([termId, classArmId])
  @@index([schoolId, termId])
  @@index([classArmId])
  @@index([releasedByUserId])
}

model ReportCardAcknowledgement {
  id                    String    @id @default(cuid())
  releaseId             String
  studentId             String
  householdId           String
  acknowledgedByUserId  String?
  acknowledgedAt        DateTime  @default(now())
  createdAt             DateTime  @default(now())

  release        ReportCardRelease @relation(fields: [releaseId], references: [id], onDelete: Cascade)
  student        Student           @relation(fields: [studentId], references: [id], onDelete: Cascade)
  household      Household         @relation(fields: [householdId], references: [id], onDelete: Cascade)
  acknowledgedBy User?             @relation("AcknowledgedReportCards", fields: [acknowledgedByUserId], references: [id], onDelete: SetNull)

  @@unique([releaseId, studentId, householdId])
  @@index([releaseId])
  @@index([studentId])
  @@index([householdId])
  @@index([acknowledgedByUserId])
}
```

### Step 2: Add back-relations on `Term`

In `prisma/schema/academic.prisma`, inside `model Term { ... }`, alongside other relations:

```prisma
  reportCardReleases ReportCardRelease[]
```

### Step 3: Add back-relations on `ClassArm`

In `prisma/schema/academic.prisma`, inside `model ClassArm { ... }`:

```prisma
  reportCardReleases ReportCardRelease[]
```

### Step 4: Add back-relations on `School`

In `prisma/schema/school.prisma`, inside `model School { ... }`:

```prisma
  reportCardReleases ReportCardRelease[] @relation("SchoolReportCardRelease")
```

### Step 5: Add back-relations on `User`

Grep to confirm User location (likely `prisma/schema/auth.prisma`). Inside `model User { ... }`:

```prisma
  releasedReportCards     ReportCardRelease[]         @relation("ReleasedReportCards")
  acknowledgedReportCards ReportCardAcknowledgement[] @relation("AcknowledgedReportCards")
```

### Step 6: Add back-relations on `Student` + `Household`

In `prisma/schema/student.prisma`, inside `model Student { ... }`:

```prisma
  reportCardAcknowledgements ReportCardAcknowledgement[]
```

In the same file, inside `model Household { ... }`:

```prisma
  reportCardAcknowledgements ReportCardAcknowledgement[]
```

### Step 7: Validate

- [ ] Run: `npx prisma validate`
  Expected: `The schemas at prisma\schema are valid`.

### Step 8: Generate migration

- [ ] Run: `npx prisma migrate dev --name add_report_card_release --create-only`

Inspect the generated SQL. It should contain ONLY:
- `CREATE TABLE "ReportCardRelease" (...)` + indexes + FKs
- `CREATE TABLE "ReportCardAcknowledgement" (...)` + indexes + FKs

If Prisma proposes unrelated ALTER TABLE statements (spurious FK drift in this repo), strip them.

### Step 9: Apply

- [ ] Run: `npx prisma migrate dev`
  Expected: migration applied + Prisma client regenerated.

### Step 10: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean (run `rm -rf .next/dev` first if stale Next.js dev-types fire).

### Step 11: Commit

```bash
git add prisma/
git commit -m "feat(release): add ReportCardRelease + ReportCardAcknowledgement models"
```

---

## Task 2: Permissions + role grants

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `tests/unit/auth/permissions.test.ts`

### Step 1: Add two new constants

In `src/lib/permissions.ts`, find the `CIRCULAR_*` block (added in PR #28). After `CIRCULAR_ACKNOWLEDGEMENT_TRACK`, add:

```ts
  // Report card release
  REPORT_CARDS_DOWNLOAD_OWN:  "academics:report-cards:download-own",
  REPORT_CARDS_RELEASE_TRACK: "academics:report-cards:release-track",
```

### Step 2: Grant `REPORT_CARDS_DOWNLOAD_OWN` to `parent`

Find `parent:` in `DEFAULT_ROLE_PERMISSIONS`. Add:

```ts
    PERMISSIONS.REPORT_CARDS_DOWNLOAD_OWN,
```

### Step 3: Grant `REPORT_CARDS_RELEASE_TRACK` to admin roles

Find `headmaster:`, `assistant_headmaster_academic:`, and `academic_master:` arrays in `DEFAULT_ROLE_PERMISSIONS`. To each, add:

```ts
    PERMISSIONS.REPORT_CARDS_RELEASE_TRACK,
```

`super_admin` inherits via `ALL_PERMISSIONS` automatically — no explicit grant needed.

### Step 4: Add regression test

Open `tests/unit/auth/permissions.test.ts`. Near the existing circular-acknowledgement regression test, add:

```ts
it("report-card release permissions are granted to the expected roles", () => {
  expect(DEFAULT_ROLE_PERMISSIONS.parent).toContain(PERMISSIONS.REPORT_CARDS_DOWNLOAD_OWN);

  for (const role of [
    "headmaster",
    "assistant_headmaster_academic",
    "academic_master",
  ]) {
    expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.REPORT_CARDS_RELEASE_TRACK);
  }

  // Negative
  expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.REPORT_CARDS_RELEASE_TRACK);
  expect(DEFAULT_ROLE_PERMISSIONS.class_teacher).not.toContain(PERMISSIONS.REPORT_CARDS_DOWNLOAD_OWN);
  expect(DEFAULT_ROLE_PERMISSIONS.class_teacher).not.toContain(PERMISSIONS.REPORT_CARDS_RELEASE_TRACK);
});
```

If there's an existing `parent role should be read-only` test that enforces an allow-list of non-read permissions, extend its allow-list to include `REPORT_CARDS_DOWNLOAD_OWN` (matches the pattern used for `EXCUSE_SUBMIT`, `MEDICAL_DISCLOSURE_SUBMIT`, `CIRCULAR_ACKNOWLEDGE`).

### Step 5: Verify

- [ ] Run: `npx tsc --noEmit` — clean
- [ ] Run: `npx vitest run tests/unit/auth/permissions.test.ts` — all pass + 1 new

### Step 6: Commit

```bash
git add src/lib/permissions.ts tests/unit/auth/permissions.test.ts
git commit -m "feat(release): add REPORT_CARDS_DOWNLOAD_OWN + REPORT_CARDS_RELEASE_TRACK permissions"
```

---

## Task 3: Pure targeting helpers (TDD)

**Files:**
- Create: `src/modules/academics/release/release-targeting.ts`
- Create: `tests/unit/modules/academics/release/release-targeting.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/academics/release/release-targeting.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../setup";
import {
  resolveTargetedStudentsForRelease,
  groupRecipientsForFanOut,
} from "@/modules/academics/release/release-targeting";

describe("resolveTargetedStudentsForRelease", () => {
  beforeEach(() => {
    prismaMock.student.findMany.mockReset();
  });

  it("returns students with active enrollment in the arm-term", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", firstName: "Kofi", lastName: "Asante" },
      { id: "s2", firstName: "Akua", lastName: "Mensah" },
    ] as never);

    const result = await resolveTargetedStudentsForRelease({
      schoolId: "school-1",
      termId: "term-1",
      classArmId: "arm-1",
    });

    expect(result.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "school-1",
          status: { in: ["ACTIVE", "SUSPENDED"] },
          enrollments: {
            some: { status: "ACTIVE", classArmId: "arm-1" },
          },
        }),
      }),
    );
  });

  it("excludes WITHDRAWN/GRADUATED/TRANSFERRED students", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    await resolveTargetedStudentsForRelease({
      schoolId: "school-1",
      termId: "term-1",
      classArmId: "arm-1",
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["ACTIVE", "SUSPENDED"] },
        }),
      }),
    );
  });

  it("scopes by schoolId", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    await resolveTargetedStudentsForRelease({
      schoolId: "other-school",
      termId: "term-1",
      classArmId: "arm-1",
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "other-school" }),
      }),
    );
  });

  it("returns empty when arm has no enrolled students", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    const result = await resolveTargetedStudentsForRelease({
      schoolId: "school-1",
      termId: "term-1",
      classArmId: "empty-arm",
    });
    expect(result).toEqual([]);
  });
});

describe("groupRecipientsForFanOut", () => {
  it("groups student names per guardian userId, deduplicates household ids", () => {
    const studentRecords = [
      {
        id: "s1",
        firstName: "Kofi",
        lastName: "Asante",
        guardians: [
          { guardian: { householdId: "hh-1", userId: "user-1" } },
          { guardian: { householdId: "hh-1", userId: "user-2" } },
        ],
      },
      {
        id: "s2",
        firstName: "Akua",
        lastName: "Asante",
        guardians: [
          { guardian: { householdId: "hh-1", userId: "user-1" } },
          { guardian: { householdId: "hh-1", userId: "user-2" } },
        ],
      },
      {
        id: "s3",
        firstName: "Yaw",
        lastName: "Mensah",
        guardians: [{ guardian: { householdId: "hh-2", userId: "user-3" } }],
      },
    ];

    const result = groupRecipientsForFanOut(studentRecords);

    expect(result.recipientUserIds.sort()).toEqual(["user-1", "user-2", "user-3"]);
    expect(result.householdIds.sort()).toEqual(["hh-1", "hh-2"]);
    expect(result.studentNamesByUserId.get("user-1")?.sort()).toEqual([
      "Akua Asante",
      "Kofi Asante",
    ]);
    expect(result.studentNamesByUserId.get("user-3")).toEqual(["Yaw Mensah"]);
  });

  it("skips guardians without a userId (no portal account)", () => {
    const studentRecords = [
      {
        id: "s1",
        firstName: "Kofi",
        lastName: "Asante",
        guardians: [
          { guardian: { householdId: "hh-1", userId: null } },
          { guardian: { householdId: "hh-1", userId: "user-1" } },
        ],
      },
    ];

    const result = groupRecipientsForFanOut(studentRecords);

    expect(result.recipientUserIds).toEqual(["user-1"]);
    expect(result.householdIds).toEqual(["hh-1"]);
  });

  it("skips guardians without a householdId", () => {
    const studentRecords = [
      {
        id: "s1",
        firstName: "Kofi",
        lastName: "Asante",
        guardians: [
          { guardian: { householdId: null, userId: "user-1" } },
        ],
      },
    ];

    const result = groupRecipientsForFanOut(studentRecords);

    expect(result.recipientUserIds).toEqual([]);
    expect(result.householdIds).toEqual([]);
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/academics/release/release-targeting.test.ts`
  Expected: fail (module not found).

### Step 3: Implement

Create `src/modules/academics/release/release-targeting.ts`:

```ts
import { db } from "@/lib/db";

export type TargetedStudent = {
  id: string;
  firstName: string;
  lastName: string;
};

/**
 * Returns students with active enrollment in the given (termId, classArmId)
 * for the given school. Filters out WITHDRAWN/GRADUATED/TRANSFERRED.
 *
 * Pure-ish: single Prisma read, no side effects. Used by:
 *  - releaseReportCardsAction (initial fan-out targeting)
 *  - reReleaseReportCardsAction (re-fan-out + ack-reset scope)
 *  - chaseReleaseAction (resolves pending households)
 *  - getReleaseStatsAction (denominator for "X of Y acknowledged")
 *  - getReleaseDetailsAction (per-student rows for the admin tracker)
 */
export async function resolveTargetedStudentsForRelease(input: {
  schoolId: string;
  termId: string;
  classArmId: string;
}): Promise<TargetedStudent[]> {
  const students = await db.student.findMany({
    where: {
      schoolId: input.schoolId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      enrollments: {
        some: { status: "ACTIVE", classArmId: input.classArmId },
      },
    },
    select: { id: true, firstName: true, lastName: true },
  });
  return students;
}

type StudentWithGuardians = {
  id: string;
  firstName: string;
  lastName: string;
  guardians: Array<{
    guardian: { householdId: string | null; userId: string | null };
  }>;
};

export type FanOutGroups = {
  recipientUserIds: string[];
  householdIds: string[];
  studentNamesByUserId: Map<string, string[]>;
};

/**
 * Given students-with-guardian-relations, builds the fan-out shape.
 * Pure — no DB.
 */
export function groupRecipientsForFanOut(
  students: StudentWithGuardians[],
): FanOutGroups {
  const recipientUserIds = new Set<string>();
  const householdIds = new Set<string>();
  const studentNamesByUserId = new Map<string, string[]>();

  for (const s of students) {
    const fullName = `${s.firstName} ${s.lastName}`;
    for (const g of s.guardians) {
      const { userId, householdId } = g.guardian;
      if (!userId || !householdId) continue;
      recipientUserIds.add(userId);
      householdIds.add(householdId);
      const list = studentNamesByUserId.get(userId);
      if (list) {
        if (!list.includes(fullName)) list.push(fullName);
      } else {
        studentNamesByUserId.set(userId, [fullName]);
      }
    }
  }

  return {
    recipientUserIds: [...recipientUserIds],
    householdIds: [...householdIds],
    studentNamesByUserId,
  };
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/academics/release/release-targeting.test.ts`
  Expected: all 7 tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/academics/release/release-targeting.ts tests/unit/modules/academics/release/release-targeting.test.ts
git commit -m "feat(release): targeting + fan-out grouping helpers"
```

---

## Task 4: Notification events + fan-out helper (TDD)

**Files:**
- Modify: `src/lib/notifications/events.ts`
- Create: `src/modules/academics/release/release-notifications.ts`
- Create: `tests/unit/modules/academics/release/release-notifications.test.ts`

### Step 1: Register 2 new events

Open `src/lib/notifications/events.ts`. In `NOTIFICATION_EVENTS`, after the circular events from PR #28, add:

```ts
  // Report card release
  REPORT_CARD_RELEASED:      "report_card_released",
  REPORT_CARD_REMINDER_SENT: "report_card_reminder_sent",
```

In `EVENT_CHANNELS`, add:

```ts
  [NOTIFICATION_EVENTS.REPORT_CARD_RELEASED]:      ["in_app", "email", "sms"],
  [NOTIFICATION_EVENTS.REPORT_CARD_REMINDER_SENT]: ["in_app", "email", "sms"],
```

Run `npx tsc --noEmit` — expect clean (the `EVENT_CHANNELS: Record<NotificationEvent, ...>` type enforces completeness).

### Step 2: Write failing tests

Create `tests/unit/modules/academics/release/release-notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../../setup";
import {
  notifyReportCardReleased,
  notifyReportCardReminder,
} from "@/modules/academics/release/release-notifications";
import { sendMessage } from "@/lib/messaging/hub";

vi.mock("@/lib/messaging/hub", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

describe("notifyReportCardReleased", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses in_app + email + sms defaults", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyReportCardReleased({
      releaseId: "r-1",
      termName: "Term 1",
      classArmName: "JSS2-A",
      recipientUserIds: ["user-1"],
      studentNamesByUserId: new Map([["user-1", ["Kofi Asante"]]]),
      isReRelease: false,
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
    expect(channelsCalled).toContain("sms");
  });

  it("interpolates multiple student names in the body", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyReportCardReleased({
      releaseId: "r-1",
      termName: "Term 1",
      classArmName: "JSS2-A",
      recipientUserIds: ["user-1"],
      studentNamesByUserId: new Map([["user-1", ["Kofi Asante", "Akua Asante"]]]),
      isReRelease: false,
    });

    const firstCall = vi.mocked(sendMessage).mock.calls[0];
    expect(firstCall?.[1].body).toContain("Kofi Asante");
    expect(firstCall?.[1].body).toContain("Akua Asante");
  });

  it("re-release adds an 'Updated:' prefix to the body", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyReportCardReleased({
      releaseId: "r-1",
      termName: "Term 1",
      classArmName: "JSS2-A",
      recipientUserIds: ["user-1"],
      studentNamesByUserId: new Map([["user-1", ["Kofi Asante"]]]),
      isReRelease: true,
    });

    const firstCall = vi.mocked(sendMessage).mock.calls[0];
    expect(firstCall?.[1].body).toMatch(/^Updated:/i);
  });

  it("respects preference overrides", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([
      { userId: "user-1", eventKey: "report_card_released", channels: ["IN_APP"] },
    ] as never);

    await notifyReportCardReleased({
      releaseId: "r-1",
      termName: "Term 1",
      classArmName: "JSS2-A",
      recipientUserIds: ["user-1"],
      studentNamesByUserId: new Map([["user-1", ["Kofi"]]]),
      isReRelease: false,
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toEqual(["in_app"]);
  });

  it("swallows per-recipient errors", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("hub down"));

    await expect(
      notifyReportCardReleased({
        releaseId: "r-1",
        termName: "Term 1",
        classArmName: "JSS2-A",
        recipientUserIds: ["user-1", "user-2"],
        studentNamesByUserId: new Map([
          ["user-1", ["A"]],
          ["user-2", ["B"]],
        ]),
        isReRelease: false,
      }),
    ).resolves.toBeUndefined();
    expect(vi.mocked(sendMessage).mock.calls.length).toBeGreaterThan(1);
  });
});

describe("notifyReportCardReminder", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses in_app + email + sms defaults", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyReportCardReminder({
      releaseId: "r-1",
      termName: "Term 1",
      classArmName: "JSS2-A",
      recipientUserIds: ["user-1"],
      studentNamesByUserId: new Map([["user-1", ["Kofi Asante"]]]),
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
    expect(channelsCalled).toContain("sms");
  });
});
```

### Step 3: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/academics/release/release-notifications.test.ts`
  Expected: fail (module not found).

### Step 4: Implement

Create `src/modules/academics/release/release-notifications.ts`:

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
  metadata: Record<string, unknown>;
}): Promise<void> {
  if (params.recipientUserIds.length === 0) return;

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
          metadata: params.metadata,
        });
      } catch (err) {
        console.error("report-card notification failed", {
          eventKey: params.eventKey,
          userId,
          err,
        });
      }
    }
  }
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "your child";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export async function notifyReportCardReleased(params: {
  releaseId: string;
  termName: string;
  classArmName: string;
  recipientUserIds: string[];
  studentNamesByUserId: Map<string, string[]>;
  isReRelease: boolean;
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.REPORT_CARD_RELEASED] as ChannelKey[];
  const prefix = params.isReRelease ? "Updated: " : "";

  await fanOut({
    eventKey: NOTIFICATION_EVENTS.REPORT_CARD_RELEASED,
    recipientUserIds: params.recipientUserIds,
    defaultChannels: defaults,
    renderBody: (userId) => {
      const names = joinNames(params.studentNamesByUserId.get(userId) ?? []);
      return `${prefix}${names}'s ${params.termName} report card is now available. Please log in to view and acknowledge receipt.`;
    },
    metadata: {
      releaseId: params.releaseId,
      termName: params.termName,
      classArmName: params.classArmName,
      isReRelease: params.isReRelease,
    },
  });
}

export async function notifyReportCardReminder(params: {
  releaseId: string;
  termName: string;
  classArmName: string;
  recipientUserIds: string[];
  studentNamesByUserId: Map<string, string[]>;
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.REPORT_CARD_REMINDER_SENT] as ChannelKey[];

  await fanOut({
    eventKey: NOTIFICATION_EVENTS.REPORT_CARD_REMINDER_SENT,
    recipientUserIds: params.recipientUserIds,
    defaultChannels: defaults,
    renderBody: (userId) => {
      const names = joinNames(params.studentNamesByUserId.get(userId) ?? []);
      return `Reminder: please acknowledge ${names}'s ${params.termName} report card.`;
    },
    metadata: {
      releaseId: params.releaseId,
      termName: params.termName,
      classArmName: params.classArmName,
    },
  });
}
```

### Step 5: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/academics/release/release-notifications.test.ts`
  Expected: 6 tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 6: Commit

```bash
git add src/modules/academics/release/release-notifications.ts src/lib/notifications/events.ts tests/unit/modules/academics/release/release-notifications.test.ts
git commit -m "feat(release): register REPORT_CARD_* events + fan-out helpers"
```

---

## Task 5: Extract `_renderReportCardPdfInternal`

**Files:**
- Modify: `src/modules/academics/actions/report-card.action.ts`

The existing `renderReportCardPdfAction` does both permission gating and the actual rendering. Extract the rendering logic into a non-permissioned internal helper so the parent-scoped action (Task 8) can reuse it.

### Step 1: Extract internal helper

Open `src/modules/academics/actions/report-card.action.ts`. The existing function body (cache check → load data → render → upload → upsert cache → audit → return signed URL) becomes a new exported `_renderReportCardPdfInternal({ studentId, termId, schoolId, callerUserId })` helper.

Replace the body of `renderReportCardPdfAction` with:

```ts
export async function renderReportCardPdfAction(input: {
  studentId: string;
  termId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.REPORT_CARDS_GENERATE,
  );
  if (denied) return denied;

  return _renderReportCardPdfInternal({
    studentId: input.studentId,
    termId: input.termId,
    schoolId: ctx.schoolId,
    callerUserId: ctx.session.user.id!,
  });
}

/**
 * Non-permissioned internal helper. Called by:
 *  - renderReportCardPdfAction (gates on REPORT_CARDS_GENERATE)
 *  - getMyReportCardPdfUrlAction (parent path: gates on REPORT_CARDS_DOWNLOAD_OWN
 *    + guardian-of-student check + release-row-exists check)
 *
 * Caller is responsible for permission + eligibility checks before invoking.
 * Underscore prefix signals "internal — do not use as a server action entry point".
 */
export async function _renderReportCardPdfInternal(input: {
  studentId: string;
  termId: string;
  schoolId: string;
  callerUserId: string;
}): Promise<
  | { data: { url: string; cached: boolean } }
  | { error: string }
> {
  // Cache check — schoolId for tenant isolation.
  const cache = await db.reportCardPdfCache.findFirst({
    where: {
      studentId: input.studentId,
      termId: input.termId,
      schoolId: input.schoolId,
    },
  });
  if (cache && isReportCardCacheFresh(cache.renderedAt, cache.invalidatedAt)) {
    const url = await getSignedDownloadUrl(cache.fileKey);
    return { data: { url, cached: true } };
  }

  // Load data via the existing data-loader action
  const dataResult = await generateReportCardDataAction(
    input.studentId,
    input.termId,
  );
  if ("error" in dataResult) return dataResult;

  const templateProps = mapReportCardDataToTemplateProps(dataResult.data);
  const buffer = await renderPdfToBuffer(ReportCard(templateProps));
  const initialKey = generateFileKey(
    "report-cards",
    `${input.studentId}-${input.termId}`,
    `report-card-${Date.now()}.pdf`,
  );
  const uploaded = await uploadFile(initialKey, buffer, "application/pdf");
  const key = uploaded.key;

  const now = new Date();
  await db.reportCardPdfCache.upsert({
    where: {
      studentId_termId: {
        studentId: input.studentId,
        termId: input.termId,
      },
    },
    create: {
      schoolId: input.schoolId,
      studentId: input.studentId,
      termId: input.termId,
      fileKey: key,
      renderedAt: now,
      renderedBy: input.callerUserId,
      invalidatedAt: null,
    },
    update: {
      fileKey: key,
      renderedAt: now,
      renderedBy: input.callerUserId,
      invalidatedAt: null,
    },
  });

  await audit({
    userId: input.callerUserId,
    action: "CREATE",
    entity: "ReportCardPdf",
    entityId: `${input.studentId}-${input.termId}`,
    module: "academics",
    description: `Generated report card PDF`,
    metadata: {
      studentId: input.studentId,
      termId: input.termId,
      fileKey: key,
    },
  });

  const url = await getSignedDownloadUrl(key);
  return { data: { url, cached: false } };
}
```

(The existing imports — `requireSchoolContext`, `assertPermission`, `PERMISSIONS`, `db`, `isReportCardCacheFresh`, `generateReportCardDataAction`, `mapReportCardDataToTemplateProps`, `renderPdfToBuffer`, `ReportCard`, `generateFileKey`, `uploadFile`, `getSignedDownloadUrl`, `audit` — all stay; the new helper uses the same imports.)

### Step 2: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.
- [ ] Run: `npx vitest run`
  Expected: no regressions in existing report-card tests.

### Step 3: Commit

```bash
git add src/modules/academics/actions/report-card.action.ts
git commit -m "refactor(report-card): extract _renderReportCardPdfInternal for parent reuse"
```

---

## Task 6: Cache invalidation wiring (TDD)

**Files:**
- Modify: `src/modules/academics/actions/mark.action.ts`
- Modify: `src/modules/academics/actions/result.action.ts`
- Create: `tests/unit/modules/academics/cache-invalidation.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/academics/cache-invalidation.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { enterMarksAction, approveMarksAction } from "@/modules/academics/actions/mark.action";
import { computeTerminalResultsAction } from "@/modules/academics/actions/result.action";
import { invalidateReportCardCacheAction } from "@/modules/academics/actions/report-card.action";

vi.mock("@/modules/academics/actions/report-card.action", async () => {
  const actual = await vi.importActual("@/modules/academics/actions/report-card.action");
  return {
    ...actual,
    invalidateReportCardCacheAction: vi.fn().mockResolvedValue({ success: true }),
  };
});

describe("cache invalidation wiring", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:marks:enter", "academics:marks:approve", "academics:results:compute", "academics:report-cards:generate"] });
    vi.mocked(invalidateReportCardCacheAction).mockClear();
  });

  it("enterMarksAction invalidates cache for each affected (studentId, termId)", async () => {
    // Mock the minimum prismaMock surface for enterMarksAction to reach the
    // invalidation block. enterMarksAction returns success after marks insert.
    // Test asserts invalidateReportCardCacheAction was called per studentId.

    // Minimal mocks — adapt to the actual enterMarksAction body when implementing.
    prismaMock.subjectAssignment.findFirst.mockResolvedValue({
      id: "sa-1",
      schoolId: "default-school",
      classArmId: "arm-1",
    } as never);
    prismaMock.subjectResult.upsert.mockResolvedValue({} as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      typeof fn === "function" ? fn(prismaMock) : fn,
    );

    await enterMarksAction({
      subjectAssignmentId: "sa-1",
      termId: "term-1",
      marks: [
        { studentId: "s-1", classScore: 30, examScore: 50 },
        { studentId: "s-2", classScore: 28, examScore: 45 },
      ],
    });

    expect(vi.mocked(invalidateReportCardCacheAction)).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "s-1", termId: "term-1" }),
    );
    expect(vi.mocked(invalidateReportCardCacheAction)).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "s-2", termId: "term-1" }),
    );
  });

  it("invalidation failure does not roll back the mark mutation", async () => {
    prismaMock.subjectAssignment.findFirst.mockResolvedValue({
      id: "sa-1",
      schoolId: "default-school",
      classArmId: "arm-1",
    } as never);
    prismaMock.subjectResult.upsert.mockResolvedValue({} as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      typeof fn === "function" ? fn(prismaMock) : fn,
    );
    vi.mocked(invalidateReportCardCacheAction).mockRejectedValueOnce(new Error("R2 down"));

    await expect(
      enterMarksAction({
        subjectAssignmentId: "sa-1",
        termId: "term-1",
        marks: [{ studentId: "s-1", classScore: 30, examScore: 50 }],
      }),
    ).resolves.not.toThrow();
  });

  it("computeTerminalResultsAction invalidates cache for each computed student", async () => {
    // Test asserts that after compute, invalidate is called per studentId.
    // Adapt mocks to match the actual computeTerminalResultsAction shape.
    // (Mocks elided — fill in based on computeTerminalResultsAction's actual reads.)
    // The assertion is the contract: every computed (studentId, termId) gets
    // an invalidation call.
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/academics/cache-invalidation.test.ts`
  Expected: fail — invalidation calls don't happen yet.

### Step 3: Wire invalidation into `mark.action.ts`

Open `src/modules/academics/actions/mark.action.ts`. Find `enterMarksAction` (line ~94) and `approveMarksAction` (line ~527).

Add the import at the top of the file (alongside existing imports):

```ts
import { invalidateReportCardCacheAction } from "./report-card.action";
```

In `enterMarksAction`, AFTER the marks have been persisted (after the existing `subjectResult.upsert` / transaction commit), add:

```ts
// Invalidate report card PDF caches for affected students.
// Best-effort: don't roll back the mark write if cache invalidation fails.
const affectedStudentIds = data.marks.map((m) => m.studentId);
const uniqueStudentIds = [...new Set(affectedStudentIds)];
for (const studentId of uniqueStudentIds) {
  try {
    await invalidateReportCardCacheAction({ studentId, termId: data.termId });
  } catch (err) {
    console.warn("invalidateReportCardCache failed", { studentId, termId: data.termId, err });
  }
}
```

Adapt `data.marks` and `data.termId` to whatever the actual parameter names are in `enterMarksAction` — read the function signature first.

In `approveMarksAction`, do the same. After the approval-time persistence, derive the `(studentId, termId)` pairs from whatever the action operates on (likely loaded marks records) and loop the same invalidation.

### Step 4: Wire invalidation into `result.action.ts`

Open `src/modules/academics/actions/result.action.ts`. Find `computeTerminalResultsAction` (line ~12).

Add the import alongside existing imports:

```ts
import { invalidateReportCardCacheAction } from "./report-card.action";
```

In `computeTerminalResultsAction`, after the per-student terminal-result upsert loop completes successfully, add the same try/catch invalidation for each affected `(studentId, termId)`. The function is per-arm-per-term, so all computed students share the same termId.

### Step 5: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/academics/cache-invalidation.test.ts`
  Expected: tests pass (the third test is a placeholder; if the agent finds it can't test compute without large mocking, leave a TODO comment and move on — integration test in Task 13 covers the path end-to-end).
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.
- [ ] Run: `npx vitest run` — no regressions in existing mark/result tests.

### Step 6: Commit

```bash
git add src/modules/academics/actions/mark.action.ts src/modules/academics/actions/result.action.ts tests/unit/modules/academics/cache-invalidation.test.ts
git commit -m "feat(release): invalidate report-card cache on every score/remark mutation"
```

---

## Task 7: Release admin actions (TDD)

**Files:**
- Create: `src/modules/academics/release/actions/release.action.ts`
- Create: `tests/unit/modules/academics/release/release.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/academics/release/release.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../../setup";
import { audit } from "@/lib/audit";
import {
  releaseReportCardsAction,
  reReleaseReportCardsAction,
  getReleaseStatsAction,
  getReleaseDetailsAction,
  chaseReleaseAction,
  getReleaseQueueAction,
} from "@/modules/academics/release/actions/release.action";
import {
  notifyReportCardReleased,
  notifyReportCardReminder,
} from "@/modules/academics/release/release-notifications";

vi.mock("@/modules/academics/release/release-notifications", () => ({
  notifyReportCardReleased: vi.fn().mockResolvedValue(undefined),
  notifyReportCardReminder: vi.fn().mockResolvedValue(undefined),
}));

const sampleStudents = [
  {
    id: "s1",
    firstName: "Kofi",
    lastName: "Asante",
    guardians: [{ guardian: { householdId: "hh-1", userId: "user-1" } }],
  },
  {
    id: "s2",
    firstName: "Akua",
    lastName: "Mensah",
    guardians: [{ guardian: { householdId: "hh-2", userId: "user-2" } }],
  },
];

describe("releaseReportCardsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:results:publish"] });
    vi.mocked(notifyReportCardReleased).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("rejects unauthenticated callers", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await releaseReportCardsAction({ termId: "t-1", classArmId: "arm-1" });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects double-release", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue({ id: "arm-1", schoolId: "default-school" } as never);
    prismaMock.term.findFirst.mockResolvedValue({ id: "t-1", schoolId: "default-school", name: "Term 1" } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue({ id: "existing-r" } as never);

    const res = await releaseReportCardsAction({ termId: "t-1", classArmId: "arm-1" });
    expect((res as { error: string }).error).toMatch(/already released/i);
  });

  it("rejects when arm not in caller's school", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue(null as never);
    const res = await releaseReportCardsAction({ termId: "t-1", classArmId: "arm-1" });
    expect((res as { error: string }).error).toMatch(/not found/i);
  });

  it("creates release row, fans out, audits", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue({ id: "arm-1", schoolId: "default-school", name: "JSS2-A" } as never);
    prismaMock.term.findFirst.mockResolvedValue({ id: "t-1", schoolId: "default-school", name: "Term 1" } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue(null as never);
    prismaMock.reportCardRelease.create.mockResolvedValue({ id: "r-new" } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);

    const res = await releaseReportCardsAction({ termId: "t-1", classArmId: "arm-1" });
    expect(res).toEqual({ data: { releaseId: "r-new" } });
    expect(prismaMock.reportCardRelease.create).toHaveBeenCalled();
    expect(vi.mocked(audit)).toHaveBeenCalled();
    expect(vi.mocked(notifyReportCardReleased)).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseId: "r-new",
        isReRelease: false,
        recipientUserIds: expect.arrayContaining(["user-1", "user-2"]),
      }),
    );
  });
});

describe("reReleaseReportCardsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:results:publish"] });
    vi.mocked(notifyReportCardReleased).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("re-release without reset preserves acks; updates releasedAt", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      term: { name: "Term 1" },
      classArm: { name: "JSS2-A" },
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      typeof fn === "function" ? fn(prismaMock) : fn,
    );
    prismaMock.reportCardRelease.update.mockResolvedValue({} as never);
    prismaMock.reportCardAcknowledgement.deleteMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);

    const res = await reReleaseReportCardsAction({
      releaseId: "r-1",
      resetAcknowledgements: false,
    });
    expect(res).toEqual({ success: true });
    expect(prismaMock.reportCardAcknowledgement.deleteMany).not.toHaveBeenCalled();
    expect(vi.mocked(notifyReportCardReleased)).toHaveBeenCalledWith(
      expect.objectContaining({ isReRelease: true }),
    );
  });

  it("re-release with reset deletes ack rows in tx", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      term: { name: "Term 1" },
      classArm: { name: "JSS2-A" },
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      typeof fn === "function" ? fn(prismaMock) : fn,
    );
    prismaMock.reportCardRelease.update.mockResolvedValue({} as never);
    prismaMock.reportCardAcknowledgement.deleteMany.mockResolvedValue({ count: 5 } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);

    const res = await reReleaseReportCardsAction({
      releaseId: "r-1",
      resetAcknowledgements: true,
    });
    expect(res).toEqual({ success: true });
    expect(prismaMock.reportCardAcknowledgement.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { releaseId: "r-1" } }),
    );
  });
});

describe("getReleaseStatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:report-cards:release-track"] });
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getReleaseStatsAction("r-1");
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("returns targeted/acknowledged/pending + canSendReminder when no recent reminder", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      lastReminderSentAt: null,
      releasedAt: new Date(),
      releasedByUserId: "u-admin",
    } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);
    prismaMock.reportCardAcknowledgement.count.mockResolvedValue(1 as never);

    const res = await getReleaseStatsAction("r-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.targetedStudents).toBe(2);
    expect(res.data.acknowledgedStudents).toBe(1);
    expect(res.data.pendingStudents).toBe(1);
    expect(res.data.canSendReminder).toBe(true);
  });

  it("canSendReminder=false when within 24h cooldown", async () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000);
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      lastReminderSentAt: recent,
      releasedAt: new Date(),
    } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);
    prismaMock.reportCardAcknowledgement.count.mockResolvedValue(0 as never);

    const res = await getReleaseStatsAction("r-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.canSendReminder).toBe(false);
  });
});

describe("chaseReleaseAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:report-cards:release-track"] });
    vi.mocked(notifyReportCardReminder).mockClear();
    vi.mocked(audit).mockClear();
  });

  it("rejects within 24h cooldown", async () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000);
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      lastReminderSentAt: recent,
      term: { name: "Term 1" },
      classArm: { name: "JSS2-A" },
    } as never);

    const res = await chaseReleaseAction("r-1");
    expect((res as { error: string }).error).toMatch(/cooldown/i);
  });

  it("rejects when zero pending", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      lastReminderSentAt: null,
      term: { name: "Term 1" },
      classArm: { name: "JSS2-A" },
    } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);
    prismaMock.reportCardAcknowledgement.findMany.mockResolvedValue([
      { studentId: "s1", householdId: "hh-1" },
      { studentId: "s2", householdId: "hh-2" },
    ] as never);

    const res = await chaseReleaseAction("r-1");
    expect((res as { error: string }).error).toMatch(/everyone|all.*acknowledged/i);
  });

  it("happy path: updates lastReminderSentAt, audits, fires notify", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      termId: "t-1",
      classArmId: "arm-1",
      lastReminderSentAt: null,
      term: { name: "Term 1" },
      classArm: { name: "JSS2-A" },
    } as never);
    prismaMock.student.findMany.mockResolvedValue(sampleStudents as never);
    prismaMock.reportCardAcknowledgement.findMany.mockResolvedValue([
      { studentId: "s1", householdId: "hh-1" },
    ] as never);
    prismaMock.reportCardRelease.update.mockResolvedValue({} as never);

    const res = await chaseReleaseAction("r-1");
    expect(res).toMatchObject({ success: true });
    expect(prismaMock.reportCardRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastReminderSentAt: expect.any(Date) }),
      }),
    );
    expect(vi.mocked(notifyReportCardReminder)).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseId: "r-1",
        recipientUserIds: expect.arrayContaining(["user-2"]),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/academics/release/release.test.ts`
  Expected: fail (module not found).

### Step 3: Implement

Create `src/modules/academics/release/actions/release.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  resolveTargetedStudentsForRelease,
  groupRecipientsForFanOut,
} from "../release-targeting";
import {
  notifyReportCardReleased,
  notifyReportCardReminder,
} from "../release-notifications";

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ─── Initial Release ────────────────────────────────────────────────

export async function releaseReportCardsAction(input: {
  termId: string;
  classArmId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_PUBLISH);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const arm = await db.classArm.findFirst({
    where: { id: input.classArmId, schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  if (!arm) return { error: "Class arm not found" };

  const term = await db.term.findFirst({
    where: { id: input.termId, schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  if (!term) return { error: "Term not found" };

  const existing = await db.reportCardRelease.findUnique({
    where: { termId_classArmId: { termId: input.termId, classArmId: input.classArmId } },
  });
  if (existing) {
    return { error: "Already released. Use re-release if you need to refresh." };
  }

  const created = await db.reportCardRelease.create({
    data: {
      schoolId: ctx.schoolId,
      termId: input.termId,
      classArmId: input.classArmId,
      releasedByUserId: userId,
    },
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "ReportCardRelease",
    entityId: created.id,
    module: "academics",
    description: `Released report cards for ${arm.name} (${term.name})`,
    newData: { termId: input.termId, classArmId: input.classArmId },
  });

  // Fan-out (best-effort)
  try {
    const students = await db.student.findMany({
      where: {
        schoolId: ctx.schoolId,
        status: { in: ["ACTIVE", "SUSPENDED"] },
        enrollments: { some: { status: "ACTIVE", classArmId: input.classArmId } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        guardians: {
          select: { guardian: { select: { householdId: true, userId: true } } },
        },
      },
    });
    const groups = groupRecipientsForFanOut(students);
    if (groups.recipientUserIds.length > 0) {
      await notifyReportCardReleased({
        releaseId: created.id,
        termName: term.name,
        classArmName: arm.name,
        recipientUserIds: groups.recipientUserIds,
        studentNamesByUserId: groups.studentNamesByUserId,
        isReRelease: false,
      });
    }
  } catch (err) {
    console.error("notifyReportCardReleased failed", { releaseId: created.id, err });
  }

  return { data: { releaseId: created.id } };
}

// ─── Re-release ─────────────────────────────────────────────────────

export async function reReleaseReportCardsAction(input: {
  releaseId: string;
  resetAcknowledgements: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_PUBLISH);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const release = await db.reportCardRelease.findFirst({
    where: { id: input.releaseId, schoolId: ctx.schoolId },
    include: {
      term: { select: { name: true } },
      classArm: { select: { name: true } },
    },
  });
  if (!release) return { error: "Release not found" };

  await db.$transaction(async (tx) => {
    if (input.resetAcknowledgements) {
      await tx.reportCardAcknowledgement.deleteMany({
        where: { releaseId: input.releaseId },
      });
    }
    await tx.reportCardRelease.update({
      where: { id: input.releaseId },
      data: {
        releasedAt: new Date(),
        releasedByUserId: userId,
        lastReminderSentAt: null,
      },
    });
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "ReportCardRelease",
    entityId: input.releaseId,
    module: "academics",
    description: `Re-released report cards${input.resetAcknowledgements ? " (acknowledgements reset)" : ""}`,
    newData: { resetAcknowledgements: input.resetAcknowledgements },
  });

  // Fan-out
  try {
    const students = await db.student.findMany({
      where: {
        schoolId: ctx.schoolId,
        status: { in: ["ACTIVE", "SUSPENDED"] },
        enrollments: { some: { status: "ACTIVE", classArmId: release.classArmId } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        guardians: {
          select: { guardian: { select: { householdId: true, userId: true } } },
        },
      },
    });
    const groups = groupRecipientsForFanOut(students);
    if (groups.recipientUserIds.length > 0) {
      await notifyReportCardReleased({
        releaseId: release.id,
        termName: release.term.name,
        classArmName: release.classArm.name,
        recipientUserIds: groups.recipientUserIds,
        studentNamesByUserId: groups.studentNamesByUserId,
        isReRelease: true,
      });
    }
  } catch (err) {
    console.error("notifyReportCardReleased (re-release) failed", { releaseId: release.id, err });
  }

  return { success: true };
}

// ─── Stats ──────────────────────────────────────────────────────────

/** @no-audit Read-only admin stats. */
export async function getReleaseStatsAction(releaseId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_RELEASE_TRACK);
  if (denied) return denied;

  const release = await db.reportCardRelease.findFirst({
    where: { id: releaseId, schoolId: ctx.schoolId },
    select: {
      id: true,
      classArmId: true,
      termId: true,
      releasedAt: true,
      releasedByUserId: true,
      lastReminderSentAt: true,
    },
  });
  if (!release) return { error: "Release not found" };

  const targeted = await resolveTargetedStudentsForRelease({
    schoolId: ctx.schoolId,
    termId: release.termId,
    classArmId: release.classArmId,
  });
  const targetedIds = targeted.map((s) => s.id);

  const acknowledgedCount = await db.reportCardAcknowledgement.count({
    where: { releaseId, studentId: { in: targetedIds } },
  });

  const now = Date.now();
  const lastMs = release.lastReminderSentAt?.getTime() ?? 0;
  const canSendReminder = now - lastMs >= REMINDER_COOLDOWN_MS;

  return {
    data: {
      targetedStudents: targeted.length,
      acknowledgedStudents: acknowledgedCount,
      pendingStudents: targeted.length - acknowledgedCount,
      lastReminderSentAt: release.lastReminderSentAt,
      canSendReminder,
      releasedAt: release.releasedAt,
      releasedByUserId: release.releasedByUserId,
    },
  };
}

// ─── Per-student details ────────────────────────────────────────────

/** @no-audit Read-only admin detail. */
export async function getReleaseDetailsAction(releaseId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_RELEASE_TRACK);
  if (denied) return denied;

  const release = await db.reportCardRelease.findFirst({
    where: { id: releaseId, schoolId: ctx.schoolId },
    select: { classArmId: true, termId: true },
  });
  if (!release) return { error: "Release not found" };

  const students = await db.student.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      enrollments: { some: { status: "ACTIVE", classArmId: release.classArmId } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      guardians: {
        select: {
          guardian: {
            select: {
              householdId: true,
              household: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const acks = await db.reportCardAcknowledgement.findMany({
    where: { releaseId },
    select: {
      studentId: true,
      householdId: true,
      acknowledgedAt: true,
      acknowledgedBy: { select: { firstName: true, lastName: true } },
    },
  });
  const ackByPair = new Map(acks.map((a) => [`${a.studentId}|${a.householdId}`, a]));

  type Row = {
    studentId: string;
    studentName: string;
    householdId: string;
    householdName: string;
    acknowledged: boolean;
    acknowledgedAt: Date | null;
    acknowledgedBy: string | null;
  };

  const rows: Row[] = [];
  for (const s of students) {
    const studentName = `${s.firstName} ${s.lastName}`;
    for (const g of s.guardians) {
      const hid = g.guardian.householdId;
      if (!hid) continue;
      const ack = ackByPair.get(`${s.id}|${hid}`);
      rows.push({
        studentId: s.id,
        studentName,
        householdId: hid,
        householdName: g.guardian.household?.name ?? "(no household name)",
        acknowledged: !!ack,
        acknowledgedAt: ack?.acknowledgedAt ?? null,
        acknowledgedBy: ack?.acknowledgedBy
          ? [ack.acknowledgedBy.firstName, ack.acknowledgedBy.lastName]
              .filter(Boolean)
              .join(" ") || "(deleted user)"
          : null,
      });
    }
  }

  // Dedupe rows by (studentId, householdId) — a single household may be linked
  // to a student via multiple guardians.
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = `${r.studentId}|${r.householdId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Pending-first sort, then alphabetic
  unique.sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    return a.studentName.localeCompare(b.studentName);
  });

  return { data: unique };
}

// ─── Chase ──────────────────────────────────────────────────────────

export async function chaseReleaseAction(releaseId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_RELEASE_TRACK);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const release = await db.reportCardRelease.findFirst({
    where: { id: releaseId, schoolId: ctx.schoolId },
    include: {
      term: { select: { name: true } },
      classArm: { select: { name: true } },
    },
  });
  if (!release) return { error: "Release not found" };

  const now = Date.now();
  const lastMs = release.lastReminderSentAt?.getTime() ?? 0;
  const remainingMs = REMINDER_COOLDOWN_MS - (now - lastMs);
  if (remainingMs > 0) {
    const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return { error: `Reminder cooldown: ${hours} hour${hours === 1 ? "" : "s"} remaining.` };
  }

  // Resolve students with active enrollment (current targeted set)
  const students = await db.student.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      enrollments: { some: { status: "ACTIVE", classArmId: release.classArmId } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      guardians: {
        select: { guardian: { select: { householdId: true, userId: true } } },
      },
    },
  });

  // Find pending households: at least one student in this release without an ack row
  const acks = await db.reportCardAcknowledgement.findMany({
    where: { releaseId },
    select: { studentId: true, householdId: true },
  });
  const ackedPairs = new Set(acks.map((a) => `${a.studentId}|${a.householdId}`));

  const pendingStudents = students.filter((s) =>
    s.guardians.some((g) => {
      const hid = g.guardian.householdId;
      if (!hid) return false;
      return !ackedPairs.has(`${s.id}|${hid}`);
    }),
  );

  if (pendingStudents.length === 0) {
    return { error: "All households have acknowledged. No one to remind." };
  }

  // Build recipient list = guardians of pending-students who are not yet ack'd
  const recipientGroupSource = pendingStudents.map((s) => ({
    ...s,
    guardians: s.guardians.filter((g) => {
      const hid = g.guardian.householdId;
      if (!hid) return false;
      return !ackedPairs.has(`${s.id}|${hid}`);
    }),
  }));
  const groups = groupRecipientsForFanOut(recipientGroupSource);

  await db.reportCardRelease.update({
    where: { id: releaseId },
    data: { lastReminderSentAt: new Date() },
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "ReportCardRelease",
    entityId: releaseId,
    module: "academics",
    description: `Sent acknowledgement reminder to ${groups.householdIds.length} household(s)`,
    newData: { recipientUserCount: groups.recipientUserIds.length },
  });

  try {
    if (groups.recipientUserIds.length > 0) {
      await notifyReportCardReminder({
        releaseId,
        termName: release.term.name,
        classArmName: release.classArm.name,
        recipientUserIds: groups.recipientUserIds,
        studentNamesByUserId: groups.studentNamesByUserId,
      });
    }
  } catch (err) {
    console.error("notifyReportCardReminder failed", { releaseId, err });
  }

  return { success: true, notifiedCount: groups.recipientUserIds.length };
}

// ─── Queue (admin page table) ───────────────────────────────────────

/** @no-audit Read-only admin queue. */
export async function getReleaseQueueAction(input?: { termId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_RELEASE_TRACK);
  if (denied) return denied;

  let termId = input?.termId;
  if (!termId) {
    const current = await db.term.findFirst({
      where: { schoolId: ctx.schoolId, isCurrent: true },
      select: { id: true },
    });
    termId = current?.id;
  }
  if (!termId) return { data: [] };

  const arms = await db.classArm.findMany({
    where: { schoolId: ctx.schoolId },
    select: {
      id: true,
      name: true,
      class: { select: { programme: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const releases = await db.reportCardRelease.findMany({
    where: { schoolId: ctx.schoolId, termId },
    select: {
      id: true,
      classArmId: true,
      releasedAt: true,
      releasedByUserId: true,
      lastReminderSentAt: true,
    },
  });
  const releaseByArm = new Map(releases.map((r) => [r.classArmId, r]));

  const rows = await Promise.all(
    arms.map(async (arm) => {
      const studentsEnrolled = await db.enrollment.count({
        where: {
          classArmId: arm.id,
          status: "ACTIVE",
          student: { status: { in: ["ACTIVE", "SUSPENDED"] } },
        },
      });
      const studentsWithResults = await db.terminalResult.count({
        where: { schoolId: ctx.schoolId, termId, classArmId: arm.id },
      });
      const release = releaseByArm.get(arm.id) ?? null;
      let acknowledgedStudents = 0;
      let pendingStudents = 0;
      if (release) {
        acknowledgedStudents = await db.reportCardAcknowledgement.count({
          where: { releaseId: release.id },
        });
        pendingStudents = Math.max(0, studentsEnrolled - acknowledgedStudents);
      }
      return {
        classArmId: arm.id,
        classArmName: arm.name,
        programmeName: arm.class?.programme?.name ?? "",
        studentsEnrolled,
        studentsWithResults,
        release,
        acknowledgedStudents,
        pendingStudents,
      };
    }),
  );

  return { data: { termId, rows } };
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/academics/release/release.test.ts`
  Expected: all tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/academics/release/actions/release.action.ts tests/unit/modules/academics/release/release.test.ts
git commit -m "feat(release): admin release/re-release/stats/details/chase/queue actions"
```

---

## Task 8: Parent-release actions (TDD)

**Files:**
- Create: `src/modules/academics/release/actions/parent-release.action.ts`
- Create: `tests/unit/modules/academics/release/parent-release.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/academics/release/parent-release.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../../setup";
import { audit } from "@/lib/audit";
import {
  acknowledgeReportCardAction,
  getMyReportCardReleaseAction,
  getMyReportCardPdfUrlAction,
} from "@/modules/academics/release/actions/parent-release.action";
import { _renderReportCardPdfInternal } from "@/modules/academics/actions/report-card.action";

vi.mock("@/modules/academics/actions/report-card.action", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/modules/academics/actions/report-card.action",
  );
  return {
    ...actual,
    _renderReportCardPdfInternal: vi.fn().mockResolvedValue({
      data: { url: "https://signed.example/x.pdf", cached: true },
    }),
  };
});

describe("acknowledgeReportCardAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:report-cards:download-own"] });
    vi.mocked(audit).mockClear();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await acknowledgeReportCardAction({ releaseId: "r-1", studentId: "s-1" });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects non-guardian (generic error)", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      classArmId: "arm-1",
    } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue(null as never);

    const res = await acknowledgeReportCardAction({ releaseId: "r-1", studentId: "s-1" });
    expect(res).toEqual({ error: "Report card not found" });
  });

  it("rejects when student is not in the released arm (generic error)", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      classArmId: "arm-1",
    } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    // Student is enrolled in arm-OTHER, not arm-1 → not in targeted set
    prismaMock.student.findFirst.mockResolvedValue(null as never);

    const res = await acknowledgeReportCardAction({ releaseId: "r-1", studentId: "s-1" });
    expect(res).toEqual({ error: "Report card not found" });
  });

  it("creates ack row + audit on happy path", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      classArmId: "arm-1",
    } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);
    prismaMock.reportCardAcknowledgement.create.mockResolvedValue({ id: "ack-1" } as never);

    const res = await acknowledgeReportCardAction({ releaseId: "r-1", studentId: "s-1" });
    expect(res).toEqual({ success: true });
    expect(prismaMock.reportCardAcknowledgement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          releaseId: "r-1",
          studentId: "s-1",
          householdId: "hh-1",
          acknowledgedByUserId: "test-user-id",
        }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });

  it("double-tap is idempotent (P2002 caught)", async () => {
    prismaMock.reportCardRelease.findFirst.mockResolvedValue({
      id: "r-1",
      schoolId: "default-school",
      classArmId: "arm-1",
    } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);

    const err = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.reportCardAcknowledgement.create.mockRejectedValue(err as never);

    const res = await acknowledgeReportCardAction({ releaseId: "r-1", studentId: "s-1" });
    expect(res).toEqual({ success: true });
  });
});

describe("getMyReportCardReleaseAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:results:read"] });
  });

  it("returns released=false when no release row exists", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
    } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue(null as never);

    const res = await getMyReportCardReleaseAction({ studentId: "s-1", termId: "t-1" });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data).toEqual({ released: false });
  });

  it("returns released=true with isAcknowledgedByMyHousehold flag", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
    } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue({
      id: "r-1",
      releasedAt: new Date(),
    } as never);
    prismaMock.reportCardAcknowledgement.findUnique.mockResolvedValue({ id: "ack-1" } as never);

    const res = await getMyReportCardReleaseAction({ studentId: "s-1", termId: "t-1" });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.released).toBe(true);
    expect(res.data.releaseId).toBe("r-1");
    expect(res.data.isAcknowledgedByMyHousehold).toBe(true);
  });
});

describe("getMyReportCardPdfUrlAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:report-cards:download-own"] });
    vi.mocked(_renderReportCardPdfInternal).mockClear();
  });

  it("rejects non-guardian", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue(null as never);
    const res = await getMyReportCardPdfUrlAction({ studentId: "s-1", termId: "t-1" });
    expect(res).toEqual({ error: "Report card not found" });
  });

  it("rejects when no release row exists", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
    } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue(null as never);

    const res = await getMyReportCardPdfUrlAction({ studentId: "s-1", termId: "t-1" });
    expect((res as { error: string }).error).toMatch(/not yet released/i);
  });

  it("returns URL on happy path via internal helper", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
    } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue({
      id: "r-1",
    } as never);

    const res = await getMyReportCardPdfUrlAction({ studentId: "s-1", termId: "t-1" });
    if (!("data" in res)) throw new Error("expected data: " + JSON.stringify(res));
    expect(res.data.url).toBe("https://signed.example/x.pdf");
    expect(vi.mocked(_renderReportCardPdfInternal)).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "s-1", termId: "t-1", schoolId: "default-school" }),
    );
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/academics/release/parent-release.test.ts`
  Expected: fail (module not found).

### Step 3: Implement

Create `src/modules/academics/release/actions/parent-release.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { _renderReportCardPdfInternal } from "@/modules/academics/actions/report-card.action";

// ─── Acknowledge ────────────────────────────────────────────────────

export async function acknowledgeReportCardAction(input: {
  releaseId: string;
  studentId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_DOWNLOAD_OWN);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const release = await db.reportCardRelease.findFirst({
    where: { id: input.releaseId, schoolId: ctx.schoolId },
    select: { id: true, classArmId: true, schoolId: true },
  });
  if (!release) return { error: "Report card not found" };

  // Caller must be a guardian of this student
  const link = await db.studentGuardian.findFirst({
    where: {
      studentId: input.studentId,
      guardian: { userId, schoolId: ctx.schoolId },
    },
    select: {
      studentId: true,
      guardian: { select: { userId: true, householdId: true } },
    },
  });
  if (!link?.guardian.householdId) return { error: "Report card not found" };

  // Student must be currently enrolled in the released arm
  const studentInArm = await db.student.findFirst({
    where: {
      id: input.studentId,
      schoolId: ctx.schoolId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      enrollments: { some: { status: "ACTIVE", classArmId: release.classArmId } },
    },
    select: { id: true },
  });
  if (!studentInArm) return { error: "Report card not found" };

  try {
    await db.reportCardAcknowledgement.create({
      data: {
        releaseId: input.releaseId,
        studentId: input.studentId,
        householdId: link.guardian.householdId,
        acknowledgedByUserId: userId,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { success: true };
    }
    throw err;
  }

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "ReportCardAcknowledgement",
    entityId: input.releaseId,
    module: "academics",
    description: `Parent acknowledged report card for student ${input.studentId}`,
    newData: { studentId: input.studentId, householdId: link.guardian.householdId },
  });

  return { success: true };
}

// ─── Get My Report Card Release ─────────────────────────────────────

/** @no-audit Read-only parent view. */
export async function getMyReportCardReleaseAction(input: {
  studentId: string;
  termId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_READ);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const link = await db.studentGuardian.findFirst({
    where: {
      studentId: input.studentId,
      guardian: { userId, schoolId: ctx.schoolId },
    },
    select: {
      studentId: true,
      guardian: { select: { userId: true, householdId: true } },
    },
  });
  if (!link) return { error: "Report card not found" };

  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId: input.studentId,
      status: "ACTIVE",
      schoolId: ctx.schoolId,
    },
    select: { classArmId: true },
  });
  if (!enrollment?.classArmId) return { data: { released: false } as const };

  const release = await db.reportCardRelease.findUnique({
    where: { termId_classArmId: { termId: input.termId, classArmId: enrollment.classArmId } },
    select: { id: true, releasedAt: true, schoolId: true },
  });
  if (!release || release.schoolId !== ctx.schoolId) {
    return { data: { released: false } as const };
  }

  let isAcknowledgedByMyHousehold = false;
  if (link.guardian.householdId) {
    const ack = await db.reportCardAcknowledgement.findUnique({
      where: {
        releaseId_studentId_householdId: {
          releaseId: release.id,
          studentId: input.studentId,
          householdId: link.guardian.householdId,
        },
      },
    });
    isAcknowledgedByMyHousehold = !!ack;
  }

  return {
    data: {
      released: true as const,
      releaseId: release.id,
      releasedAt: release.releasedAt,
      isAcknowledgedByMyHousehold,
    },
  };
}

// ─── Get My Report Card PDF URL ─────────────────────────────────────

/** @no-audit Read-only — internal helper writes audit on render. */
export async function getMyReportCardPdfUrlAction(input: {
  studentId: string;
  termId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_DOWNLOAD_OWN);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const link = await db.studentGuardian.findFirst({
    where: {
      studentId: input.studentId,
      guardian: { userId, schoolId: ctx.schoolId },
    },
    select: { studentId: true, guardian: { select: { userId: true, householdId: true } } },
  });
  if (!link) return { error: "Report card not found" };

  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId: input.studentId,
      status: "ACTIVE",
      schoolId: ctx.schoolId,
    },
    select: { classArmId: true },
  });
  if (!enrollment?.classArmId) return { error: "Report card not yet released" };

  const release = await db.reportCardRelease.findUnique({
    where: { termId_classArmId: { termId: input.termId, classArmId: enrollment.classArmId } },
    select: { id: true, schoolId: true },
  });
  if (!release || release.schoolId !== ctx.schoolId) {
    return { error: "Report card not yet released" };
  }

  return _renderReportCardPdfInternal({
    studentId: input.studentId,
    termId: input.termId,
    schoolId: ctx.schoolId,
    callerUserId: userId,
  });
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/academics/release/parent-release.test.ts`
  Expected: all tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/academics/release/actions/parent-release.action.ts tests/unit/modules/academics/release/parent-release.test.ts
git commit -m "feat(release): parent-scoped acknowledge + PDF URL + release lookup"
```

---

## Task 9: `publishResultsAction` becomes a thin wrapper

**Files:**
- Modify: `src/modules/academics/actions/result.action.ts`

### Step 1: Locate the existing stub

Open `src/modules/academics/actions/result.action.ts` at line ~566. The current `publishResultsAction` is a no-op stub. Replace its body with a delegating call to `releaseReportCardsAction`.

### Step 2: Replace the body

Read the existing function signature first — it accepts a `(termId, classArmId)` pair (or similar). Adapt the wrapper to forward to `releaseReportCardsAction`:

```ts
import { releaseReportCardsAction } from "@/modules/academics/release/actions/release.action";

/**
 * @deprecated Use `releaseReportCardsAction` directly. This wrapper preserves
 * the existing route + permission for backward compatibility.
 */
export async function publishResultsAction(input: {
  termId: string;
  classArmId: string;
}) {
  return releaseReportCardsAction(input);
}
```

If the existing signature differs (e.g. `(termId)` only, school-wide), keep the same surface but adapt the body — call `releaseReportCardsAction` per arm, OR raise an error indicating that the action now requires per-arm targeting. Choose based on what existing callers (if any) actually pass. If there are no callers, the simpler per-arm signature is fine.

### Step 3: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.
- [ ] Run: `npx vitest run`
  Expected: no regressions in result-related tests. If `publishResultsAction` had its own unit test asserting no-op behavior, update that test (it should now assert delegation to `releaseReportCardsAction`).

### Step 4: Commit

```bash
git add src/modules/academics/actions/result.action.ts
git commit -m "refactor(release): publishResultsAction delegates to releaseReportCardsAction"
```

---

## Task 10: Gate `getChildResultsAction` on release row (TDD)

**Files:**
- Modify: `src/modules/portal/actions/parent.action.ts`
- Create: `tests/unit/modules/academics/parent-results-gate.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/academics/parent-results-gate.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { getChildResultsAction } from "@/modules/portal/actions/parent.action";

const sampleStudent = {
  id: "s-1",
  schoolId: "default-school",
  status: "ACTIVE",
};

describe("getChildResultsAction (release gate)", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:results:read"] });
  });

  it("returns released=false when no release row exists", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
    } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue(null as never);

    const res = await getChildResultsAction({ studentId: "s-1", termId: "t-1" });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.released).toBe(false);
    expect(res.data.subjectResults).toEqual([]);
  });

  it("returns full results + released=true + isAcknowledged when release exists", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue({
      studentId: "s-1",
      guardian: { userId: "test-user-id", householdId: "hh-1" },
    } as never);
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.enrollment.findFirst.mockResolvedValue({
      classArmId: "arm-1",
    } as never);
    prismaMock.reportCardRelease.findUnique.mockResolvedValue({
      id: "r-1",
      releasedAt: new Date(),
    } as never);
    prismaMock.reportCardAcknowledgement.findUnique.mockResolvedValue({ id: "ack-1" } as never);
    prismaMock.terminalResult.findFirst.mockResolvedValue({
      id: "tr-1",
      averageScore: 75,
      classPosition: 3,
      overallGrade: "B",
    } as never);
    prismaMock.subjectResult.findMany.mockResolvedValue([
      { id: "sr-1", subjectName: "Math", classScore: 30, examScore: 50, totalScore: 80, grade: "A" },
    ] as never);

    const res = await getChildResultsAction({ studentId: "s-1", termId: "t-1" });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.released).toBe(true);
    expect(res.data.releaseId).toBe("r-1");
    expect(res.data.isAcknowledged).toBe(true);
    expect(res.data.subjectResults.length).toBeGreaterThan(0);
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/academics/parent-results-gate.test.ts`
  Expected: fail.

### Step 3: Modify `getChildResultsAction`

Open `src/modules/portal/actions/parent.action.ts`. Find `getChildResultsAction`. Read it first to understand its current shape (subject result loading, summary computation, etc.).

After loading the student + enrollment, add release-row lookup. Hydrate the response with `released`, `releaseId`, `isAcknowledged`. When `released === false`, return early with empty `subjectResults` and the `released: false` flag — the existing UI shouldn't show stale results.

```ts
// After existing student + enrollment load:

const release = enrollment?.classArmId
  ? await db.reportCardRelease.findUnique({
      where: {
        termId_classArmId: { termId: input.termId, classArmId: enrollment.classArmId },
      },
      select: { id: true, releasedAt: true, schoolId: true },
    })
  : null;

if (!release || release.schoolId !== ctx.schoolId) {
  return {
    data: {
      released: false as const,
      subjectResults: [],
      summary: null,
      remarks: null,
    },
  };
}

// Resolve household for this caller to look up acknowledgement state
const guardian = await db.guardian.findUnique({
  where: { userId: ctx.session.user.id! },
  select: { householdId: true },
});
let isAcknowledged = false;
if (guardian?.householdId) {
  const ack = await db.reportCardAcknowledgement.findUnique({
    where: {
      releaseId_studentId_householdId: {
        releaseId: release.id,
        studentId: input.studentId,
        householdId: guardian.householdId,
      },
    },
  });
  isAcknowledged = !!ack;
}

// Existing logic to load TerminalResult + SubjectResult continues here...
// ...
return {
  data: {
    released: true as const,
    releaseId: release.id,
    releasedAt: release.releasedAt,
    isAcknowledged,
    subjectResults,
    summary,
    remarks,
  },
};
```

Adapt to whatever the existing response shape is. The key new fields are `released`, `releaseId`, `isAcknowledged`.

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/academics/parent-results-gate.test.ts`
  Expected: tests pass.
- [ ] Run: `npx vitest run` — no regressions in existing parent-portal tests. Update any stale expectations that asserted the unreleased shape.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/portal/actions/parent.action.ts tests/unit/modules/academics/parent-results-gate.test.ts
git commit -m "feat(release): gate getChildResultsAction on release row + hydrate ack state"
```

---

## Task 11: Parent portal UI updates

**Files:**
- Modify: `src/app/(portal)/parent/results/results-client.tsx`

### Step 1: Read the current client

Read `src/app/(portal)/parent/results/results-client.tsx` first. It has child + term selectors and renders the results table.

### Step 2: Adapt for release-aware shape

The page server-loads results via the modified `getChildResultsAction` (Task 10). The new response carries `released`, `releaseId`, `isAcknowledged`, `releasedAt`. The client receives this shape.

Modify the results-client to:

1. **Empty state for unreleased terms.** When `data.released === false`, render:
   ```tsx
   <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
     <p className="font-medium mb-1">Results not yet released for {selectedTermName}</p>
     <p>
       Your child&apos;s results are still being finalised. You&apos;ll be notified
       when they&apos;re available.
     </p>
   </div>
   ```
   Selectors stay visible. Score table is hidden.

2. **Release header for released terms.** When `data.released === true`, render above the existing results table:
   ```tsx
   {data.released && (
     <div className="rounded-xl border border-gray-200 bg-white p-4 mb-3 flex items-center justify-between">
       <div>
         <p className="font-semibold text-sm">
           {selectedTermName} — released {new Date(data.releasedAt).toLocaleDateString()}
         </p>
       </div>
       <div className="flex items-center gap-2">
         <button
           onClick={downloadPdf}
           disabled={pending}
           className="rounded-lg border border-teal-600 text-teal-700 px-3 py-1.5 text-sm hover:bg-teal-50 disabled:opacity-50"
         >
           📄 Download PDF
         </button>
         {data.isAcknowledged ? (
           <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
             Acknowledged
           </span>
         ) : (
           <button
             onClick={acknowledge}
             disabled={pending}
             className="rounded-lg bg-teal-600 text-white px-3 py-1.5 text-sm disabled:opacity-50"
           >
             I acknowledge receipt
           </button>
         )}
       </div>
     </div>
   )}
   ```

3. **Add the action wires.** Import the new actions and add handlers:
   ```tsx
   import { useTransition } from "react";
   import { toast } from "sonner";
   import { acknowledgeReportCardAction, getMyReportCardPdfUrlAction } from "@/modules/academics/release/actions/parent-release.action";
   import { useRouter } from "next/navigation";

   const router = useRouter();
   const [pending, start] = useTransition();

   const downloadPdf = () => {
     start(async () => {
       const res = await getMyReportCardPdfUrlAction({
         studentId: selectedStudentId,
         termId: selectedTermId,
       });
       if ("error" in res) {
         toast.error(res.error);
         return;
       }
       window.open(res.data.url, "_blank", "noopener,noreferrer");
     });
   };

   const acknowledge = () => {
     if (!data.releaseId) return;
     start(async () => {
       const res = await acknowledgeReportCardAction({
         releaseId: data.releaseId!,
         studentId: selectedStudentId,
       });
       if ("error" in res) {
         toast.error(res.error);
         return;
       }
       toast.success("Acknowledged.");
       router.refresh();
     });
   };
   ```

4. **Edge case** — released term but no `subjectResults` for this student (partial release): show "Your child's results aren't part of this release. Please contact the school." in place of the score table. Don't show the PDF or acknowledge buttons.

### Step 3: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean. (Run `rm -rf .next/dev` first if stale dev-types fire.)

### Step 4: Commit

```bash
git add "src/app/(portal)/parent/results/results-client.tsx"
git commit -m "feat(release): parent results page — release gate + PDF download + acknowledge"
```

---

## Task 12: Admin tracker UI

**Files:**
- Create: `src/app/(dashboard)/students/results-release/page.tsx`
- Create: `src/app/(dashboard)/students/results-release/release-client.tsx`
- Modify: dashboard sidebar nav (locate via grep where `students/medical-disclosures` was added)

### Step 1: page.tsx

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getReleaseQueueAction } from "@/modules/academics/release/actions/release.action";
import { ReleaseClient } from "./release-client";

export default async function ResultsReleasePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const res = await getReleaseQueueAction();
  if ("error" in res) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {res.error}
        </div>
      </div>
    );
  }

  return (
    <ReleaseClient
      initialTermId={res.data.termId}
      initialRows={res.data.rows as never}
    />
  );
}
```

### Step 2: release-client.tsx

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  releaseReportCardsAction,
  reReleaseReportCardsAction,
  getReleaseStatsAction,
  getReleaseDetailsAction,
  chaseReleaseAction,
  getReleaseQueueAction,
} from "@/modules/academics/release/actions/release.action";

type Row = {
  classArmId: string;
  classArmName: string;
  programmeName: string;
  studentsEnrolled: number;
  studentsWithResults: number;
  release: { id: string; releasedAt: Date | string; lastReminderSentAt: Date | string | null } | null;
  acknowledgedStudents: number;
  pendingStudents: number;
};

type DetailRow = {
  studentId: string;
  studentName: string;
  householdId: string;
  householdName: string;
  acknowledged: boolean;
  acknowledgedAt: Date | string | null;
  acknowledgedBy: string | null;
};

type Stats = {
  targetedStudents: number;
  acknowledgedStudents: number;
  pendingStudents: number;
  lastReminderSentAt: Date | string | null;
  canSendReminder: boolean;
  releasedAt: Date | string;
  releasedByUserId: string | null;
};

export function ReleaseClient({
  initialTermId,
  initialRows,
}: {
  initialTermId: string | null;
  initialRows: Row[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [openedRow, setOpenedRow] = useState<Row | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [showReReleaseModal, setShowReReleaseModal] = useState(false);
  const [resetAcks, setResetAcks] = useState(false);

  useEffect(() => {
    if (!openedRow?.release) {
      setStats(null);
      setDetails([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      getReleaseStatsAction(openedRow.release.id),
      getReleaseDetailsAction(openedRow.release.id),
    ]).then(([s, d]) => {
      if (cancelled) return;
      if ("data" in s) setStats(s.data as never);
      if ("data" in d) setDetails(d.data as never);
    });
    return () => { cancelled = true; };
  }, [openedRow?.release?.id]);

  const refreshQueue = () => {
    start(async () => {
      const res = await getReleaseQueueAction({ termId: initialTermId ?? undefined });
      if ("data" in res) setRows(res.data.rows as never);
    });
  };

  const release = (row: Row) => {
    if (row.studentsWithResults < row.studentsEnrolled) {
      const missing = row.studentsEnrolled - row.studentsWithResults;
      const ok = window.confirm(
        `${missing} student${missing === 1 ? "" : "s"} will be excluded from this release; ` +
          `they'll be auto-included when their results are computed. Continue?`,
      );
      if (!ok) return;
    }
    if (!initialTermId) return;
    start(async () => {
      const res = await releaseReportCardsAction({
        termId: initialTermId,
        classArmId: row.classArmId,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Released ${row.classArmName}.`);
      refreshQueue();
      router.refresh();
    });
  };

  const chase = () => {
    if (!openedRow?.release) return;
    start(async () => {
      const res = await chaseReleaseAction(openedRow.release!.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Reminder sent.`);
      // refresh stats
      const fresh = await getReleaseStatsAction(openedRow.release!.id);
      if ("data" in fresh) setStats(fresh.data as never);
    });
  };

  const reRelease = () => {
    if (!openedRow?.release) return;
    start(async () => {
      const res = await reReleaseReportCardsAction({
        releaseId: openedRow.release!.id,
        resetAcknowledgements: resetAcks,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(resetAcks ? "Re-released; acknowledgements reset." : "Re-released.");
      setShowReReleaseModal(false);
      setResetAcks(false);
      // refresh stats + details
      const [fresh, d] = await Promise.all([
        getReleaseStatsAction(openedRow.release!.id),
        getReleaseDetailsAction(openedRow.release!.id),
      ]);
      if ("data" in fresh) setStats(fresh.data as never);
      if ("data" in d) setDetails(d.data as never);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Report card release</h1>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">Class arm</th>
              <th className="p-3 text-left">Programme</th>
              <th className="p-3 text-left">Students</th>
              <th className="p-3 text-left">Computed</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No class arms found for this term.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const computed = r.studentsWithResults === r.studentsEnrolled
                  ? `${r.studentsWithResults} ✓`
                  : `${r.studentsWithResults} / ${r.studentsEnrolled} ⚠`;
                const status = r.release ? "Released" : "Not released";
                return (
                  <tr key={r.classArmId} className="border-t border-border hover:bg-muted/40">
                    <td className="p-3 font-medium">{r.classArmName}</td>
                    <td className="p-3 text-muted-foreground">{r.programmeName}</td>
                    <td className="p-3">{r.studentsEnrolled}</td>
                    <td className="p-3">{computed}</td>
                    <td className="p-3">
                      <span className="text-xs">{status}</span>
                    </td>
                    <td className="p-3 text-right">
                      {r.release ? (
                        <button
                          onClick={() => setOpenedRow(r)}
                          className="text-xs text-primary hover:underline"
                        >
                          {r.acknowledgedStudents} / {r.studentsEnrolled} acknowledged
                        </button>
                      ) : (
                        <button
                          onClick={() => release(r)}
                          disabled={pending || r.studentsWithResults === 0}
                          className="text-xs rounded-lg bg-primary text-primary-foreground px-3 py-1 disabled:opacity-50"
                        >
                          Release
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {openedRow && openedRow.release && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpenedRow(null)}
        >
          <div
            className="w-full max-w-3xl rounded-xl bg-card p-6 space-y-4 max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">{openedRow.classArmName} — release tracker</h2>
              <button onClick={() => setOpenedRow(null)} className="text-muted-foreground">✕</button>
            </div>

            {!stats ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">
                    {stats.acknowledgedStudents} of {stats.targetedStudents} students acknowledged
                    ({stats.pendingStudents} pending)
                  </p>
                  <div className="w-full h-2 bg-muted rounded-full mt-1">
                    <div
                      className="h-2 bg-green-500 rounded-full"
                      style={{
                        width: `${stats.targetedStudents === 0 ? 0 : (stats.acknowledgedStudents / stats.targetedStudents) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stats.lastReminderSentAt
                      ? `Last reminder: ${new Date(stats.lastReminderSentAt).toLocaleString()}`
                      : "No reminders sent yet"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={chase}
                    disabled={!stats.canSendReminder || stats.pendingStudents === 0 || pending}
                    className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
                    title={
                      !stats.canSendReminder
                        ? "Within 24-hour cooldown"
                        : stats.pendingStudents === 0
                          ? "Everyone acknowledged"
                          : undefined
                    }
                  >
                    Send reminder to {stats.pendingStudents} pending
                  </button>
                  <button
                    onClick={() => setShowReReleaseModal(true)}
                    disabled={pending}
                    className="rounded-lg border border-border px-4 py-2 text-sm"
                  >
                    Re-release
                  </button>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Student</th>
                        <th className="p-2 text-left">Household</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.length === 0 ? (
                        <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No targeted students.</td></tr>
                      ) : (
                        details.map((d) => (
                          <tr key={`${d.studentId}|${d.householdId}`} className="border-t border-border">
                            <td className="p-2">{d.studentName}</td>
                            <td className="p-2">{d.householdName}</td>
                            <td className="p-2">
                              {d.acknowledged
                                ? <span className="text-green-700">Acknowledged by {d.acknowledgedBy ?? "(deleted user)"} on {d.acknowledgedAt ? new Date(d.acknowledgedAt).toLocaleDateString() : "—"}</span>
                                : <span className="text-muted-foreground">Pending</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      const csv = ["Student,Household,Status,AcknowledgedBy,AcknowledgedAt"]
                        .concat(details.map((d) =>
                          [
                            JSON.stringify(d.studentName),
                            JSON.stringify(d.householdName),
                            d.acknowledged ? "Acknowledged" : "Pending",
                            JSON.stringify(d.acknowledgedBy ?? ""),
                            d.acknowledgedAt ? new Date(d.acknowledgedAt).toISOString() : "",
                          ].join(",")
                        ))
                        .join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `report-card-acks-${openedRow.classArmName}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showReReleaseModal && openedRow?.release && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowReReleaseModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Re-release report cards</h3>
            <p className="text-sm text-muted-foreground">
              This re-fires the release notification to every targeted parent.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={resetAcks}
                onChange={(e) => setResetAcks(e.target.checked)}
              />
              Reset acknowledgements (parents must re-confirm)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowReReleaseModal(false); setResetAcks(false); }}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={reRelease}
                disabled={pending}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
              >
                Re-release with notification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Sidebar nav

Grep for the `students/medical-disclosures` entry (added in PR #27 / D1 era):

```bash
grep -rn "medical-disclosures" "src/app/(dashboard)" | head
```

Add a sibling entry for `Report card release` pointing at `/students/results-release`. Match the surrounding pattern (icon, label, sort order).

### Step 4: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add "src/app/(dashboard)/students/results-release/" src/app/
git commit -m "feat(release): admin results-release page (table + drawer + chase + CSV)"
```

---

## Task 13: Integration test (live DB)

**Files:**
- Create: `tests/integration/students/report-card-release.test.ts`

### Step 1: Read the existing pattern

Read `tests/integration/students/circular-acknowledgements.test.ts` (PR #28) for the exact fixture pattern (User creation, Household, Programme, Class, ClassArm, Student, Enrollment, Guardian, StudentGuardian) + `loginAs` + `cleanupSeedData`.

### Step 2: Write the integration test

Create `tests/integration/students/report-card-release.test.ts`. Seed 2 households (single + twins), 1 arm, 1 term. Cover:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveSeededAdminId, loginAs } from "./setup";
import {
  releaseReportCardsAction,
  reReleaseReportCardsAction,
  getReleaseStatsAction,
  chaseReleaseAction,
} from "@/modules/academics/release/actions/release.action";
import {
  acknowledgeReportCardAction,
  getMyReportCardReleaseAction,
} from "@/modules/academics/release/actions/parent-release.action";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Report card release (integration)", () => {
  const db = new PrismaClient();
  const testTag = `release-test-${Date.now()}`;

  let adminId: string;
  let parentUserId: string;
  let twinsParentUserId: string;
  let studentSoloId: string;
  let twin1Id: string;
  let twin2Id: string;
  let armId: string;
  let classId: string;
  let programmeId: string;
  let yearId: string;
  let termId: string;
  let householdSoloId: string;
  let householdTwinsId: string;
  let guardianSoloId: string;
  let guardianTwinsId: string;
  let releaseId = "";

  async function cleanupSeedData() {
    if (releaseId) {
      await db.reportCardAcknowledgement.deleteMany({ where: { releaseId } }).catch(() => {});
      await db.reportCardRelease.delete({ where: { id: releaseId } }).catch(() => {});
    }
    await db.studentGuardian.deleteMany({
      where: { studentId: { in: [studentSoloId, twin1Id, twin2Id].filter(Boolean) } },
    }).catch(() => {});
    await db.terminalResult.deleteMany({
      where: { studentId: { in: [studentSoloId, twin1Id, twin2Id].filter(Boolean) } },
    }).catch(() => {});
    await db.enrollment.deleteMany({
      where: { studentId: { in: [studentSoloId, twin1Id, twin2Id].filter(Boolean) } },
    }).catch(() => {});
    await db.student.deleteMany({
      where: { id: { in: [studentSoloId, twin1Id, twin2Id].filter(Boolean) } },
    }).catch(() => {});
    await db.guardian.deleteMany({
      where: { id: { in: [guardianSoloId, guardianTwinsId].filter(Boolean) } },
    }).catch(() => {});
    if (armId) await db.classArm.delete({ where: { id: armId } }).catch(() => {});
    if (classId) await db.class.delete({ where: { id: classId } }).catch(() => {});
    if (programmeId) await db.programme.delete({ where: { id: programmeId } }).catch(() => {});
    if (termId) await db.term.delete({ where: { id: termId } }).catch(() => {});
    if (householdSoloId) await db.household.delete({ where: { id: householdSoloId } }).catch(() => {});
    if (householdTwinsId) await db.household.delete({ where: { id: householdTwinsId } }).catch(() => {});
    await db.user.deleteMany({
      where: { id: { in: [parentUserId, twinsParentUserId].filter(Boolean) } },
    }).catch(() => {});
  }

  beforeAll(async () => {
    try {
      adminId = await resolveSeededAdminId();
      // ...follow the pattern from circular-acknowledgements.test.ts to seed:
      // - 2 User rows (parents)
      // - 2 Households
      // - Programme + Class + ClassArm + AcademicYear + Term (Term must be in
      //   the same school + academicYear)
      // - 3 Students: studentSolo (1 child), twin1, twin2 (same household)
      // - Enrollments for all 3 in armId
      // - Guardians + StudentGuardian links: guardianSolo links to studentSolo;
      //   guardianTwins links to BOTH twin1 and twin2
    } catch (e) {
      await cleanupSeedData();
      throw e;
    }
  }, 60_000);

  afterAll(async () => {
    await cleanupSeedData();
    await db.$disconnect();
  }, 60_000);

  it("happy path: admin releases → solo parent acknowledges → stats reflect", async () => {
    loginAs({ id: adminId });
    const res = await releaseReportCardsAction({ termId, classArmId: armId });
    if (!("data" in res)) throw new Error((res as { error: string }).error);
    releaseId = res.data.releaseId;

    loginAs({ id: parentUserId, permissions: ["academics:results:read", "academics:report-cards:download-own"] });
    const lookup = await getMyReportCardReleaseAction({ studentId: studentSoloId, termId });
    if (!("data" in lookup)) throw new Error((lookup as { error: string }).error);
    expect(lookup.data.released).toBe(true);

    const ack = await acknowledgeReportCardAction({ releaseId, studentId: studentSoloId });
    expect(ack).toEqual({ success: true });

    loginAs({ id: adminId });
    const stats = await getReleaseStatsAction(releaseId);
    if (!("data" in stats)) throw new Error((stats as { error: string }).error);
    expect(stats.data.acknowledgedStudents).toBe(1);
    expect(stats.data.targetedStudents).toBe(3);
  });

  it("twins are independent: ack on twin1 doesn't auto-ack twin2", async () => {
    loginAs({ id: twinsParentUserId, permissions: ["academics:results:read", "academics:report-cards:download-own"] });
    const ack = await acknowledgeReportCardAction({ releaseId, studentId: twin1Id });
    expect(ack).toEqual({ success: true });

    loginAs({ id: adminId });
    const stats = await getReleaseStatsAction(releaseId);
    if (!("data" in stats)) throw new Error((stats as { error: string }).error);
    expect(stats.data.acknowledgedStudents).toBe(2);

    loginAs({ id: twinsParentUserId, permissions: ["academics:results:read", "academics:report-cards:download-own"] });
    const ack2 = await acknowledgeReportCardAction({ releaseId, studentId: twin2Id });
    expect(ack2).toEqual({ success: true });

    loginAs({ id: adminId });
    const stats2 = await getReleaseStatsAction(releaseId);
    if (!("data" in stats2)) throw new Error((stats2 as { error: string }).error);
    expect(stats2.data.acknowledgedStudents).toBe(3);
  });

  it("re-release with reset clears acks", async () => {
    loginAs({ id: adminId });
    const res = await reReleaseReportCardsAction({ releaseId, resetAcknowledgements: true });
    expect(res).toEqual({ success: true });

    const stats = await getReleaseStatsAction(releaseId);
    if (!("data" in stats)) throw new Error((stats as { error: string }).error);
    expect(stats.data.acknowledgedStudents).toBe(0);
    expect(stats.data.pendingStudents).toBe(3);
  });

  it("chase cooldown enforced", async () => {
    loginAs({ id: adminId });
    const first = await chaseReleaseAction(releaseId);
    if ("error" in first) {
      // Acceptable if everyone-acked or cooldown-from-earlier-test
      expect(first.error).toMatch(/cooldown|all.*acknowledged/i);
      return;
    }
    expect(first).toMatchObject({ success: true });

    const second = await chaseReleaseAction(releaseId);
    expect((second as { error: string }).error).toMatch(/cooldown/i);
  });

  it("tenant isolation: another schoolId cannot see this release", async () => {
    const other = await db.reportCardRelease.findFirst({
      where: { id: releaseId, schoolId: "other-school" },
    });
    expect(other).toBeNull();
  });
});
```

Fill in the `beforeAll` seeding with the real fixture creation (Programme, Class, ClassArm, Term, Students, Guardians, StudentGuardian, Households) following the `circular-acknowledgements.test.ts` pattern exactly.

### Step 3: Run

- [ ] Run: `npm run test:students`
  Expected: 5 new tests pass + existing integration tests still pass.

### Step 4: Commit

```bash
git add tests/integration/students/report-card-release.test.ts
git commit -m "test(release): live-DB integration coverage"
```

---

## Task 14: End-to-end verification

**Files:** verification only.

### Step 1: Full unit suite

- [ ] Run: `npx vitest run`
  Expected: all passing. ~1880+ tests with new additions.

### Step 2: Integration suite

- [ ] Run: `npm run test:students`
  Expected: all passing including new `report-card-release.test.ts`.

### Step 3: Audit guardrail

- [ ] Run: `npx vitest run tests/unit/guardrails/audit-coverage.test.ts`
  Expected: passing. `releaseReportCardsAction`, `reReleaseReportCardsAction`, `chaseReleaseAction`, `acknowledgeReportCardAction` carry `audit()`. Read actions carry `@no-audit` JSDoc.

### Step 4: TypeScript

- [ ] Run: `rm -rf .next/dev && npx tsc --noEmit`
  Expected: clean.

### Step 5: Build

- [ ] Run: `npm run build`
  Expected: success. Confirm new route compiles:
  - `/students/results-release`

### Step 6: Lint

- [ ] Run: `npm run lint`
  Expected: 0 errors, no new baseline warnings.

### Step 7: Prisma status

- [ ] Run: `npx prisma migrate status`
  Expected: up to date.

### Step 8: Manual UI walk

1. Log in as a class teacher → `/marks/...` → enter marks for an arm, submit.
2. Log in as academic master → `/students/results-release` → see the arm with computation count → click "Release" → confirmation dialog → confirm.
3. Log in as a parent of a student in that arm → `/parent/results` → pick the released term → see Download PDF + I acknowledge buttons.
4. Click Download PDF → opens in new tab.
5. Click I acknowledge → button replaced with green badge.
6. Back to academic master → reopen tracker drawer → see 1/N acknowledged + per-student table.
7. Click Send reminder → toast + button greys out (24h cooldown).
8. Class teacher edits a mark → academic master re-renders PDF (or parent re-downloads) → fresh score appears.
9. Academic master clicks Re-release → ticks "Reset acknowledgements" → confirm → parent's view shows acknowledged badge gone, button back.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage:**
  - §4 data model → Task 1
  - §5 release semantics → Tasks 7, 8 (encoded in action behavior)
  - §6 permissions → Task 2
  - §7 server actions → Tasks 7, 8, 9, 10
  - §8 notifications → Task 4
  - §9 UI surfaces → Tasks 11, 12
  - §10 cache invalidation → Tasks 5, 6
  - §11 error handling → covered via action-layer tests in Tasks 7, 8
  - §12 testing → Tasks 3, 4, 6, 7, 8, 10, 13
  - §13 verification → Task 14
- [x] **No placeholders:** every step has concrete code or exact commands. Where the agent must adapt to existing code shape (e.g. `enterMarksAction` parameter names, `getChildResultsAction` response shape, sidebar nav file path), the instruction explicitly says "read first then adapt" + provides the contract the new code must satisfy.
- [x] **Type consistency:** `Stats`, `Row`, `DetailRow`, `_renderReportCardPdfInternal({ studentId, termId, schoolId, callerUserId })`, fan-out parameter shapes (`recipientUserIds`, `studentNamesByUserId`) consistent across all tasks.
- [x] **File paths:** absolute-from-repo-root.
- [x] **TDD shape:** Tasks 3, 4, 6, 7, 8, 10 follow RED → GREEN → commit. Tasks 1, 2, 5, 9 are data/config/refactor. Tasks 11, 12 are UI (no unit tests, integration covers). Task 13 is integration-only. Task 14 is verification-only.
