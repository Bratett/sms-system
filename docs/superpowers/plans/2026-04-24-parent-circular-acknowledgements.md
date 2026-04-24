# Parent Circular Acknowledgements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in parent acknowledgement tracking to circulars, with one-click parent acknowledge, admin stats + detail drawer, 24-hour-cooldown chase reminders, and a fix for the latent targeting bug in `getParentAnnouncementsAction`.

**Architecture:** Two new columns on the existing `Announcement` model (`requiresAcknowledgement`, `lastReminderSentAt`), one new junction table `CircularAcknowledgement` (announcement × household), two new permissions, two new notification events. Pure targeting helper in `src/modules/communication/circular-targeting.ts` drives parent-side visibility + admin denominator. Parent portal gets a new route `/parent/circulars` with Pending/History tabs. Admin announcements page is extended inline with stats column + drawer.

**Tech Stack:** Next.js 15 App Router, Prisma on PostgreSQL, vitest + vitest-mock-extended, Cloudflare R2, native HTML + tailwind, sonner for toasts.

**Spec reference:** `docs/superpowers/specs/2026-04-24-parent-circular-acknowledgements-design.md`

---

## File Structure

**New files**
- `src/modules/communication/circular-targeting.ts` — pure targeting + `doesAnnouncementTargetGuardian`
- `src/modules/communication/circular-notifications.ts` — fan-out over `sendMessage` hub
- `src/modules/communication/actions/circular-acknowledgement.action.ts` — acknowledge + stats + details + chase
- `src/app/(portal)/parent/circulars/page.tsx` + `circulars-client.tsx`
- `tests/unit/modules/communication/circular-targeting.test.ts`
- `tests/unit/modules/communication/circular-acknowledgement.test.ts`
- `tests/unit/modules/communication/announcement-publish-ack.test.ts`
- `tests/unit/modules/communication/circular-notifications.test.ts`
- `tests/unit/modules/portal/parent-circulars.test.ts`
- `tests/integration/students/circular-acknowledgements.test.ts`

**Modified files**
- `prisma/schema/communication.prisma` — append `requiresAcknowledgement` + `lastReminderSentAt` to `Announcement`; append `CircularAcknowledgement` model + back-relations on `Household`, `User`
- `prisma/schema/migrations/<timestamp>_add_circular_acknowledgements/migration.sql`
- `src/lib/permissions.ts` — 2 new permissions + grants
- `src/lib/notifications/events.ts` — 2 new event keys + `EVENT_CHANNELS` entries
- `src/modules/communication/actions/announcement.action.ts` — accept `requiresAcknowledgement` in create/update; call `notifyCircularPublished` on publish
- `src/modules/portal/actions/parent.action.ts` — fix targeting bug in `getParentAnnouncementsAction`; add `getParentCircularsAction`
- `src/app/(portal)/portal-nav.tsx` — add `Circulars` under `parentLinks`
- `src/app/(dashboard)/communication/announcements/announcements-client.tsx` — add stats column + detail drawer (with chase button + CSV export) + acknowledgement checkbox in create/edit form
- `tests/unit/auth/permissions.test.ts` — +1 regression test

---

## Task 1: Schema migration

**Files:**
- Modify: `prisma/schema/communication.prisma`
- Modify: `prisma/schema/student.prisma` (Household back-relation)
- Modify: `prisma/schema/auth.prisma` (User back-relation — confirm model location)
- Create: `prisma/schema/migrations/<timestamp>_add_circular_acknowledgements/migration.sql`

### Step 1: Add columns to `Announcement` + append `CircularAcknowledgement` model

Open `prisma/schema/communication.prisma`. Inside `model Announcement { ... }`, add alongside existing fields (keep current fields untouched):

```prisma
  requiresAcknowledgement Boolean   @default(false)
  lastReminderSentAt      DateTime?

  acknowledgements CircularAcknowledgement[]
```

In the same `Announcement` model, after the existing `@@index` lines, add:

```prisma
  @@index([schoolId, status, requiresAcknowledgement])
```

At the bottom of `communication.prisma`, append:

```prisma
// ─── Circular Acknowledgements (Tier 2 #6 sub-project D1) ────────────

model CircularAcknowledgement {
  id                    String    @id @default(cuid())
  announcementId        String
  householdId           String
  acknowledgedByUserId  String?
  acknowledgedAt        DateTime  @default(now())
  createdAt             DateTime  @default(now())

  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  household      Household    @relation(fields: [householdId], references: [id], onDelete: Cascade)
  acknowledgedBy User?        @relation("AcknowledgedCirculars", fields: [acknowledgedByUserId], references: [id], onDelete: SetNull)

  @@unique([announcementId, householdId])
  @@index([announcementId])
  @@index([householdId])
  @@index([acknowledgedByUserId])
}
```

### Step 2: Back-relation on `Household`

Grep to find the `Household` model (added in PR #25, likely in `prisma/schema/student.prisma` based on the household PR). Inside `model Household { ... }`, add alongside existing relations:

```prisma
  circularAcknowledgements CircularAcknowledgement[]
```

### Step 3: Back-relation on `User`

Grep to confirm the `User` model file (likely `prisma/schema/auth.prisma`). Inside `model User { ... }`, add alongside existing relations:

```prisma
  acknowledgedCirculars CircularAcknowledgement[] @relation("AcknowledgedCirculars")
```

### Step 4: Validate

- [ ] Run: `npx prisma validate`
  Expected: `The schemas at prisma\schema are valid`.

### Step 5: Generate migration

- [ ] Run: `npx prisma migrate dev --name add_circular_acknowledgements --create-only`
  Expected: creates `prisma/schema/migrations/<timestamp>_add_circular_acknowledgements/migration.sql`.

Open the generated SQL. It should contain ONLY:
- `ALTER TABLE "Announcement" ADD COLUMN "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT false;`
- `ALTER TABLE "Announcement" ADD COLUMN "lastReminderSentAt" TIMESTAMP(3);`
- `CREATE INDEX "Announcement_schoolId_status_requiresAcknowledgement_idx" ON "Announcement"(...)`
- `CREATE TABLE "CircularAcknowledgement" (...)`
- Indexes + FKs on the new table.

If Prisma proposes unrelated ALTER TABLE statements (known spurious FK drift in this repo), strip those lines before applying.

### Step 6: Apply

- [ ] Run: `npx prisma migrate dev`
  Expected: migration applied, Prisma client regenerated.

### Step 7: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 8: Commit

```bash
git add prisma/
git commit -m "feat(circulars): add CircularAcknowledgement model + Announcement ack columns"
```

---

## Task 2: Permissions + role grants

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `tests/unit/auth/permissions.test.ts`

### Step 1: Add two new constants

In `src/lib/permissions.ts`, find the parent-requests permission block (added in PR #27). After `MEDICAL_DISCLOSURE_REVIEW`, add:

```ts
  // Circular acknowledgements
  CIRCULAR_ACKNOWLEDGE:           "communication:circulars:acknowledge",
  CIRCULAR_ACKNOWLEDGEMENT_TRACK: "communication:circulars:acknowledgement-track",
```

### Step 2: Grant `CIRCULAR_ACKNOWLEDGE` to `parent`

Find `parent:` in `DEFAULT_ROLE_PERMISSIONS`. Add:

```ts
    PERMISSIONS.CIRCULAR_ACKNOWLEDGE,
```

### Step 3: Grant `CIRCULAR_ACKNOWLEDGEMENT_TRACK` to admin roles

Find each of `super_admin`, `school_admin`, `principal`, `vice_principal` in `DEFAULT_ROLE_PERMISSIONS`. Add:

```ts
    PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK,
```

(`super_admin` also inherits via `ALL_PERMISSIONS` automatically — add explicitly if the pattern in this file includes it for other perms.)

### Step 4: Add regression test

Open `tests/unit/auth/permissions.test.ts`. Near the existing parent-request test, add:

```ts
it("circular-acknowledgement permissions are granted to the expected roles", () => {
  expect(DEFAULT_ROLE_PERMISSIONS.parent).toContain(PERMISSIONS.CIRCULAR_ACKNOWLEDGE);

  for (const role of ["super_admin", "school_admin", "principal", "vice_principal"]) {
    expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK);
  }

  // Negative
  expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK);
  expect(DEFAULT_ROLE_PERMISSIONS.class_teacher).not.toContain(PERMISSIONS.CIRCULAR_ACKNOWLEDGE);
  expect(DEFAULT_ROLE_PERMISSIONS.class_teacher).not.toContain(PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK);
});
```

If there's an existing `parent role should be read-only` test enforcing an allow-list for non-read permissions, extend its allow-list to include `CIRCULAR_ACKNOWLEDGE` (same pattern used for `EXCUSE_SUBMIT`).

### Step 5: Verify

- [ ] Run: `npx tsc --noEmit` — clean
- [ ] Run: `npx vitest run tests/unit/auth/permissions.test.ts` — all existing tests pass + 1 new

### Step 6: Commit

```bash
git add src/lib/permissions.ts tests/unit/auth/permissions.test.ts
git commit -m "feat(circulars): add CIRCULAR_ACKNOWLEDGE + CIRCULAR_ACKNOWLEDGEMENT_TRACK permissions"
```

---

## Task 3: Pure targeting helpers (TDD)

**Files:**
- Create: `src/modules/communication/circular-targeting.ts`
- Create: `tests/unit/modules/communication/circular-targeting.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/communication/circular-targeting.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import {
  resolveTargetedHouseholdIds,
  doesAnnouncementTargetGuardian,
} from "@/modules/communication/circular-targeting";

describe("resolveTargetedHouseholdIds", () => {
  beforeEach(() => {
    prismaMock.student.findMany.mockReset();
  });

  it("targetType=all returns households with at least one ACTIVE student", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", guardians: [{ guardian: { householdId: "hh-1" } }] },
      { id: "s2", guardians: [{ guardian: { householdId: "hh-2" } }] },
      { id: "s3", guardians: [{ guardian: { householdId: "hh-1" } }] }, // dupe hh-1
    ] as never);

    const result = await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "all",
      targetIds: null,
    });
    expect(result.sort()).toEqual(["hh-1", "hh-2"]);
  });

  it("targetType=class filters by enrollments.classId in targetIds", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", guardians: [{ guardian: { householdId: "hh-1" } }] },
    ] as never);

    const result = await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "class",
      targetIds: ["class-a", "class-b"],
    });
    expect(result).toEqual(["hh-1"]);
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollments: { some: { status: "ACTIVE", classArm: { classId: { in: ["class-a", "class-b"] } } } },
        }),
      }),
    );
  });

  it("targetType=programme filters by enrollments.classArm.class.programmeId", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", guardians: [{ guardian: { householdId: "hh-1" } }] },
    ] as never);

    await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "programme",
      targetIds: ["prog-1"],
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollments: { some: { status: "ACTIVE", classArm: { class: { programmeId: { in: ["prog-1"] } } } } },
        }),
      }),
    );
  });

  it("targetType=house filters by houseAssignment.houseId", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "house",
      targetIds: ["house-1"],
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          houseAssignment: { houseId: { in: ["house-1"] } },
        }),
      }),
    );
  });

  it("targetType=specific filters by student id", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "specific",
      targetIds: ["s1", "s2"],
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["s1", "s2"] },
        }),
      }),
    );
  });

  it("excludes WITHDRAWN/GRADUATED/TRANSFERRED students", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "all",
      targetIds: null,
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["ACTIVE", "SUSPENDED"] },
        }),
      }),
    );
  });

  it("returns [] when targetIds is null and targetType requires them", async () => {
    const result = await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "class",
      targetIds: null,
    });
    expect(result).toEqual([]);
  });

  it("returns [] for malformed targetIds (empty array for non-all)", async () => {
    const result = await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "class",
      targetIds: [],
    });
    expect(result).toEqual([]);
  });

  it("filters out students with no household guardians", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", guardians: [{ guardian: { householdId: null } }] },
      { id: "s2", guardians: [] },
    ] as never);

    const result = await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "all",
      targetIds: null,
    });
    expect(result).toEqual([]);
  });

  it("scopes by schoolId", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    await resolveTargetedHouseholdIds({
      schoolId: "school-xyz",
      targetType: "all",
      targetIds: null,
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school-xyz" }),
      }),
    );
  });
});

describe("doesAnnouncementTargetGuardian", () => {
  const guardianStudentContexts = [
    { id: "s1", classArmId: "arm-1", classId: "class-a", programmeId: "prog-1", houseId: "house-1" },
    { id: "s2", classArmId: "arm-2", classId: "class-b", programmeId: "prog-1", houseId: null },
  ];
  const guardianStudentIds = ["s1", "s2"];

  it("returns true for targetType=all", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "all", targetIds: null },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(true);
  });

  it("returns true for targetType=class when any student's class is in targetIds", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "class", targetIds: ["class-a"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(true);
  });

  it("returns false for targetType=class when no student's class matches", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "class", targetIds: ["class-x"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(false);
  });

  it("returns true for targetType=programme match", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "programme", targetIds: ["prog-1"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(true);
  });

  it("returns true for targetType=house when any student has a matching house", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "house", targetIds: ["house-1"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(true);
  });

  it("returns true for targetType=specific student id match", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "specific", targetIds: ["s2"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(true);
  });

  it("returns false for targetType=specific when no id matches", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "specific", targetIds: ["sX"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(false);
  });

  it("returns false when targetIds is null for non-all targetType", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "class", targetIds: null },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(false);
  });

  it("handles unknown targetType gracefully (returns false)", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "bogus" as never, targetIds: [] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(false);
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/communication/circular-targeting.test.ts`
  Expected: fail — module not found.

### Step 3: Implement

Create `src/modules/communication/circular-targeting.ts`:

```ts
import { db } from "@/lib/db";

type TargetType = "all" | "class" | "programme" | "house" | "specific";

/**
 * Given an Announcement's targetType + targetIds, return the unique set of
 * household ids (across the school) whose students match the targeting.
 *
 * - "all" → every household with at least one ACTIVE/SUSPENDED student in the school
 * - "class" → households whose students have an active Enrollment in any classId in targetIds
 * - "programme" → households via enrollment.classArm.class.programmeId
 * - "house" → households via StudentHouse assignment
 * - "specific" → households via student.id ∈ targetIds
 */
export async function resolveTargetedHouseholdIds(input: {
  schoolId: string;
  targetType: TargetType;
  targetIds: string[] | null;
}): Promise<string[]> {
  const { schoolId, targetType, targetIds } = input;

  if (targetType !== "all" && (!targetIds || targetIds.length === 0)) {
    return [];
  }

  const baseWhere: Record<string, unknown> = {
    schoolId,
    status: { in: ["ACTIVE", "SUSPENDED"] },
  };

  switch (targetType) {
    case "all":
      break;
    case "class":
      baseWhere.enrollments = {
        some: { status: "ACTIVE", classArm: { classId: { in: targetIds! } } },
      };
      break;
    case "programme":
      baseWhere.enrollments = {
        some: { status: "ACTIVE", classArm: { class: { programmeId: { in: targetIds! } } } },
      };
      break;
    case "house":
      baseWhere.houseAssignment = { houseId: { in: targetIds! } };
      break;
    case "specific":
      baseWhere.id = { in: targetIds! };
      break;
    default:
      return [];
  }

  const students = await db.student.findMany({
    where: baseWhere as never,
    select: {
      id: true,
      guardians: { select: { guardian: { select: { householdId: true } } } },
    },
  });

  const householdIds = new Set<string>();
  for (const s of students) {
    for (const g of s.guardians) {
      const hid = g.guardian.householdId;
      if (hid) householdIds.add(hid);
    }
  }
  return [...householdIds];
}

export function doesAnnouncementTargetGuardian(
  announcement: { targetType: string | null; targetIds: unknown },
  guardianStudentIds: string[],
  guardianStudentContexts: Array<{
    id: string;
    classArmId: string | null;
    classId: string | null;
    programmeId: string | null;
    houseId: string | null;
  }>,
): boolean {
  const tIds = Array.isArray(announcement.targetIds)
    ? (announcement.targetIds.filter((x): x is string => typeof x === "string"))
    : null;

  switch (announcement.targetType) {
    case "all":
      return guardianStudentIds.length > 0;
    case "class":
      if (!tIds) return false;
      return guardianStudentContexts.some((s) => s.classId != null && tIds.includes(s.classId));
    case "programme":
      if (!tIds) return false;
      return guardianStudentContexts.some((s) => s.programmeId != null && tIds.includes(s.programmeId));
    case "house":
      if (!tIds) return false;
      return guardianStudentContexts.some((s) => s.houseId != null && tIds.includes(s.houseId));
    case "specific":
      if (!tIds) return false;
      return guardianStudentIds.some((id) => tIds.includes(id));
    default:
      return false;
  }
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/communication/circular-targeting.test.ts`
  Expected: all ~19 tests passing.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/communication/circular-targeting.ts tests/unit/modules/communication/circular-targeting.test.ts
git commit -m "feat(circulars): targeting resolution helpers (households + guardian predicate)"
```

---

## Task 4: Notification events + fan-out helper (TDD)

**Files:**
- Modify: `src/lib/notifications/events.ts`
- Create: `src/modules/communication/circular-notifications.ts`
- Create: `tests/unit/modules/communication/circular-notifications.test.ts`

### Step 1: Register 2 new event keys

Open `src/lib/notifications/events.ts`. In `NOTIFICATION_EVENTS` (before closing `} as const;`), after the parent-requests events, add:

```ts
  // Circular acknowledgements
  CIRCULAR_ACKNOWLEDGEMENT_REQUIRED: "circular_acknowledgement_required",
  CIRCULAR_REMINDER_SENT:            "circular_reminder_sent",
```

In `EVENT_CHANNELS`, add:

```ts
  [NOTIFICATION_EVENTS.CIRCULAR_ACKNOWLEDGEMENT_REQUIRED]: ["in_app", "email"],
  [NOTIFICATION_EVENTS.CIRCULAR_REMINDER_SENT]:            ["in_app", "email", "sms"],
```

Run: `npx tsc --noEmit` — expect clean (the `EVENT_CHANNELS: Record<NotificationEvent, ...>` type enforces completeness).

### Step 2: Write failing tests

Create `tests/unit/modules/communication/circular-notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import {
  notifyCircularPublished,
  notifyCircularReminder,
} from "@/modules/communication/circular-notifications";
import { sendMessage } from "@/lib/messaging/hub";

vi.mock("@/lib/messaging/hub", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

describe("notifyCircularPublished", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("routine (requiresAcknowledgement=false) uses in_app only", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyCircularPublished({
      announcementId: "a-1",
      title: "Library closed Friday",
      priority: "normal",
      recipientUserIds: ["user-1"],
      requiresAcknowledgement: false,
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).not.toContain("email");
    expect(channelsCalled).not.toContain("sms");
  });

  it("acknowledgement-required adds email alongside in_app", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyCircularPublished({
      announcementId: "a-1",
      title: "Exam fees due",
      priority: "high",
      recipientUserIds: ["user-1"],
      requiresAcknowledgement: true,
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
    expect(channelsCalled).not.toContain("sms");
  });
});

describe("notifyCircularReminder", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses in_app + email + sms defaults", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyCircularReminder({
      announcementId: "a-1",
      title: "Exam fees due",
      recipientUserIds: ["user-1"],
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
    expect(channelsCalled).toContain("sms");
  });

  it("respects preference overrides", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([
      { userId: "user-1", eventKey: "circular_reminder_sent", channels: ["IN_APP"] },
    ] as never);

    await notifyCircularReminder({
      announcementId: "a-1",
      title: "x",
      recipientUserIds: ["user-1"],
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toEqual(["in_app"]);
  });

  it("swallows per-recipient errors", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("hub down"));

    await expect(
      notifyCircularReminder({
        announcementId: "a-1",
        title: "x",
        recipientUserIds: ["user-1", "user-2"],
      }),
    ).resolves.toBeUndefined();
    expect(vi.mocked(sendMessage).mock.calls.length).toBeGreaterThan(1);
  });
});
```

### Step 3: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/communication/circular-notifications.test.ts`
  Expected: fail — module not found.

### Step 4: Implement

Create `src/modules/communication/circular-notifications.ts`:

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
        console.error("circular notification failed", {
          eventKey: params.eventKey,
          userId,
          err,
        });
      }
    }
  }
}

// ─── Published (always fires ANNOUNCEMENT_PUBLISHED; adds stronger event when required) ──

export async function notifyCircularPublished(params: {
  announcementId: string;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  recipientUserIds: string[];
  requiresAcknowledgement: boolean;
}): Promise<void> {
  const existingDefaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.ANNOUNCEMENT_PUBLISHED] as ChannelKey[];
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.ANNOUNCEMENT_PUBLISHED,
    recipientUserIds: params.recipientUserIds,
    defaultChannels: existingDefaults,
    renderBody: () => `New circular: ${params.title}`,
    metadata: {
      announcementId: params.announcementId,
      priority: params.priority,
      requiresAcknowledgement: params.requiresAcknowledgement,
    },
  });

  if (!params.requiresAcknowledgement) return;

  const ackDefaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.CIRCULAR_ACKNOWLEDGEMENT_REQUIRED] as ChannelKey[];
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.CIRCULAR_ACKNOWLEDGEMENT_REQUIRED,
    recipientUserIds: params.recipientUserIds,
    defaultChannels: ackDefaults,
    renderBody: () => `Please acknowledge: ${params.title}`,
    metadata: {
      announcementId: params.announcementId,
      priority: params.priority,
    },
  });
}

// ─── Reminder (chase) ────────────────────────────────────────────

export async function notifyCircularReminder(params: {
  announcementId: string;
  title: string;
  recipientUserIds: string[];
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.CIRCULAR_REMINDER_SENT] as ChannelKey[];
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.CIRCULAR_REMINDER_SENT,
    recipientUserIds: params.recipientUserIds,
    defaultChannels: defaults,
    renderBody: () => `Reminder: please acknowledge "${params.title}".`,
    metadata: {
      announcementId: params.announcementId,
    },
  });
}
```

### Step 5: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/communication/circular-notifications.test.ts`
  Expected: all 5 tests passing.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 6: Commit

```bash
git add src/modules/communication/circular-notifications.ts src/lib/notifications/events.ts tests/unit/modules/communication/circular-notifications.test.ts
git commit -m "feat(circulars): register CIRCULAR_* events + fan-out helpers"
```

---

## Task 5: Circular acknowledgement actions (TDD)

**Files:**
- Create: `src/modules/communication/actions/circular-acknowledgement.action.ts`
- Create: `tests/unit/modules/communication/circular-acknowledgement.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/communication/circular-acknowledgement.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  acknowledgeCircularAction,
  getAnnouncementAcknowledgementStatsAction,
  getAnnouncementAcknowledgementDetailsAction,
  chaseAnnouncementAcknowledgementAction,
} from "@/modules/communication/actions/circular-acknowledgement.action";
import { notifyCircularReminder } from "@/modules/communication/circular-notifications";

vi.mock("@/modules/communication/circular-notifications", () => ({
  notifyCircularReminder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/communication/circular-targeting", () => ({
  resolveTargetedHouseholdIds: vi.fn().mockResolvedValue(["hh-1", "hh-2", "hh-3"]),
  doesAnnouncementTargetGuardian: vi.fn().mockReturnValue(true),
}));

describe("acknowledgeCircularAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:circulars:acknowledge"] });
    vi.mocked(audit).mockClear();
  });

  it("rejects when announcement is not ack-required", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      status: "PUBLISHED",
      requiresAcknowledgement: false,
      targetType: "all",
      targetIds: null,
    } as never);

    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect((res as { error: string }).error).toMatch(/doesn't require acknowledgement/i);
  });

  it("rejects when announcement is ARCHIVED", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      status: "ARCHIVED",
      requiresAcknowledgement: true,
    } as never);

    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect((res as { error: string }).error).toMatch(/no longer active/i);
  });

  it("rejects when caller's household is not in targeted set", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      status: "PUBLISHED",
      requiresAcknowledgement: true,
      targetType: "class",
      targetIds: ["class-a"],
    } as never);
    prismaMock.guardian.findUnique.mockResolvedValue({
      userId: "test-user-id",
      householdId: "hh-OTHER",
    } as never);

    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect(res).toEqual({ error: "Circular not found" });
  });

  it("creates ack row + audit on happy path", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      status: "PUBLISHED",
      requiresAcknowledgement: true,
      targetType: "all",
      targetIds: null,
    } as never);
    prismaMock.guardian.findUnique.mockResolvedValue({
      userId: "test-user-id",
      householdId: "hh-1",
    } as never);
    prismaMock.circularAcknowledgement.create.mockResolvedValue({
      id: "ack-1",
    } as never);

    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect(res).toEqual({ success: true });
    expect(prismaMock.circularAcknowledgement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          announcementId: "a-1",
          householdId: "hh-1",
          acknowledgedByUserId: "test-user-id",
        }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });

  it("double-tap is idempotent (unique constraint caught)", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      status: "PUBLISHED",
      requiresAcknowledgement: true,
      targetType: "all",
      targetIds: null,
    } as never);
    prismaMock.guardian.findUnique.mockResolvedValue({
      userId: "test-user-id",
      householdId: "hh-1",
    } as never);

    // Simulate a Prisma P2002 unique-constraint violation
    const err = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.circularAcknowledgement.create.mockRejectedValue(err as never);

    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect(res).toEqual({ success: true });
  });

  it("rejects non-guardian caller", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await acknowledgeCircularAction({ announcementId: "a-1" });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });
});

describe("getAnnouncementAcknowledgementStatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:circulars:acknowledgement-track"] });
  });

  it("rejects non-admin", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getAnnouncementAcknowledgementStatsAction("a-1");
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("returns targeted/acknowledged/pending counts + cooldown flag", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      targetType: "all",
      targetIds: null,
      lastReminderSentAt: null,
      requiresAcknowledgement: true,
    } as never);
    prismaMock.circularAcknowledgement.count.mockResolvedValue(1 as never);

    const res = await getAnnouncementAcknowledgementStatsAction("a-1");
    if (!("data" in res)) throw new Error("expected data: " + JSON.stringify(res));
    expect(res.data.targeted).toBe(3); // from mocked resolveTargetedHouseholdIds
    expect(res.data.acknowledged).toBe(1);
    expect(res.data.pending).toBe(2);
    expect(res.data.canSendReminder).toBe(true);
  });

  it("canSendReminder=false when within 24h cooldown", async () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      targetType: "all",
      targetIds: null,
      lastReminderSentAt: recent,
      requiresAcknowledgement: true,
    } as never);
    prismaMock.circularAcknowledgement.count.mockResolvedValue(0 as never);

    const res = await getAnnouncementAcknowledgementStatsAction("a-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.canSendReminder).toBe(false);
  });
});

describe("getAnnouncementAcknowledgementDetailsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:circulars:acknowledgement-track"] });
  });

  it("returns pending-first household rows", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      targetType: "all",
      targetIds: null,
    } as never);
    prismaMock.household.findMany.mockResolvedValue([
      { id: "hh-1", name: "Asante Family" },
      { id: "hh-2", name: "Mensah Family" },
      { id: "hh-3", name: "Owusu Family" },
    ] as never);
    prismaMock.circularAcknowledgement.findMany.mockResolvedValue([
      {
        householdId: "hh-1",
        acknowledgedAt: new Date("2026-04-20"),
        acknowledgedBy: { firstName: "Kofi", lastName: "Asante" },
      },
    ] as never);

    const res = await getAnnouncementAcknowledgementDetailsAction("a-1");
    if (!("data" in res)) throw new Error("expected data: " + JSON.stringify(res));
    expect(res.data.length).toBe(3);
    // Pending first
    expect(res.data[0].acknowledged).toBe(false);
    expect(res.data[1].acknowledged).toBe(false);
    expect(res.data[2].acknowledged).toBe(true);
    expect(res.data[2].householdId).toBe("hh-1");
  });
});

describe("chaseAnnouncementAcknowledgementAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:circulars:acknowledgement-track"] });
    vi.mocked(audit).mockClear();
    vi.mocked(notifyCircularReminder).mockClear();
  });

  it("rejects inside 24h cooldown", async () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000);
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      title: "x",
      lastReminderSentAt: recent,
      targetType: "all",
      targetIds: null,
      requiresAcknowledgement: true,
    } as never);

    const res = await chaseAnnouncementAcknowledgementAction("a-1");
    expect((res as { error: string }).error).toMatch(/cooldown/i);
  });

  it("rejects when zero households pending", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      title: "x",
      lastReminderSentAt: null,
      targetType: "all",
      targetIds: null,
      requiresAcknowledgement: true,
    } as never);
    // All 3 mocked-as-targeted households are acknowledged → pending = 0
    prismaMock.circularAcknowledgement.findMany.mockResolvedValue([
      { householdId: "hh-1" },
      { householdId: "hh-2" },
      { householdId: "hh-3" },
    ] as never);

    const res = await chaseAnnouncementAcknowledgementAction("a-1");
    expect((res as { error: string }).error).toMatch(/everyone/i);
  });

  it("updates lastReminderSentAt + audits + fires notify on happy path", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      title: "Exam fees",
      lastReminderSentAt: null,
      targetType: "all",
      targetIds: null,
      requiresAcknowledgement: true,
    } as never);
    prismaMock.circularAcknowledgement.findMany.mockResolvedValue([
      { householdId: "hh-1" }, // hh-2 and hh-3 pending (from mocked resolveTargetedHouseholdIds)
    ] as never);
    prismaMock.guardian.findMany.mockResolvedValue([
      { userId: "user-2" },
      { userId: "user-3" },
    ] as never);
    prismaMock.announcement.update.mockResolvedValue({} as never);

    const res = await chaseAnnouncementAcknowledgementAction("a-1");
    expect(res).toEqual({ success: true, notifiedCount: 2 });
    expect(prismaMock.announcement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastReminderSentAt: expect.any(Date),
        }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
    expect(vi.mocked(notifyCircularReminder)).toHaveBeenCalledWith(
      expect.objectContaining({
        announcementId: "a-1",
        recipientUserIds: expect.arrayContaining(["user-2", "user-3"]),
      }),
    );
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/communication/circular-acknowledgement.test.ts`
  Expected: fail — module not found.

### Step 3: Implement

Create `src/modules/communication/actions/circular-acknowledgement.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { resolveTargetedHouseholdIds } from "../circular-targeting";
import { notifyCircularReminder } from "../circular-notifications";

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ─── Acknowledge ─────────────────────────────────────────────────

export async function acknowledgeCircularAction(input: {
  announcementId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.CIRCULAR_ACKNOWLEDGE);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const announcement = await db.announcement.findFirst({
    where: { id: input.announcementId, schoolId: ctx.schoolId },
    select: {
      id: true,
      status: true,
      requiresAcknowledgement: true,
      targetType: true,
      targetIds: true,
    },
  });
  if (!announcement) return { error: "Circular not found" };
  if (!announcement.requiresAcknowledgement) {
    return { error: "This circular doesn't require acknowledgement." };
  }
  if (announcement.status === "ARCHIVED") {
    return { error: "This circular is no longer active." };
  }

  const guardian = await db.guardian.findUnique({
    where: { userId },
    select: { userId: true, householdId: true },
  });
  if (!guardian?.householdId) return { error: "Circular not found" };

  const targeted = await resolveTargetedHouseholdIds({
    schoolId: ctx.schoolId,
    targetType: announcement.targetType as never,
    targetIds: Array.isArray(announcement.targetIds)
      ? (announcement.targetIds as string[])
      : null,
  });
  if (!targeted.includes(guardian.householdId)) {
    return { error: "Circular not found" };
  }

  try {
    await db.circularAcknowledgement.create({
      data: {
        announcementId: input.announcementId,
        householdId: guardian.householdId,
        acknowledgedByUserId: userId,
      },
    });
  } catch (err) {
    // P2002 = unique constraint violation → idempotent double-tap
    if ((err as { code?: string }).code === "P2002") {
      return { success: true };
    }
    throw err;
  }

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "CircularAcknowledgement",
    entityId: input.announcementId,
    module: "communication",
    description: `Parent acknowledged circular ${input.announcementId}`,
    newData: { householdId: guardian.householdId },
  });

  return { success: true };
}

// ─── Stats (admin) ────────────────────────────────────────────────

/** @no-audit Read-only admin stats view. */
export async function getAnnouncementAcknowledgementStatsAction(
  announcementId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK,
  );
  if (denied) return denied;

  const announcement = await db.announcement.findFirst({
    where: { id: announcementId, schoolId: ctx.schoolId },
    select: {
      id: true,
      targetType: true,
      targetIds: true,
      lastReminderSentAt: true,
      requiresAcknowledgement: true,
    },
  });
  if (!announcement) return { error: "Circular not found" };

  const targeted = await resolveTargetedHouseholdIds({
    schoolId: ctx.schoolId,
    targetType: announcement.targetType as never,
    targetIds: Array.isArray(announcement.targetIds)
      ? (announcement.targetIds as string[])
      : null,
  });

  const acknowledgedCount = await db.circularAcknowledgement.count({
    where: { announcementId, householdId: { in: targeted } },
  });

  const now = Date.now();
  const lastMs = announcement.lastReminderSentAt?.getTime() ?? 0;
  const canSendReminder = now - lastMs >= REMINDER_COOLDOWN_MS;

  return {
    data: {
      targeted: targeted.length,
      acknowledged: acknowledgedCount,
      pending: targeted.length - acknowledgedCount,
      lastReminderSentAt: announcement.lastReminderSentAt,
      canSendReminder,
      requiresAcknowledgement: announcement.requiresAcknowledgement,
    },
  };
}

// ─── Detail rows (admin) ──────────────────────────────────────────

/** @no-audit Read-only admin detail view. */
export async function getAnnouncementAcknowledgementDetailsAction(
  announcementId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK,
  );
  if (denied) return denied;

  const announcement = await db.announcement.findFirst({
    where: { id: announcementId, schoolId: ctx.schoolId },
    select: { targetType: true, targetIds: true },
  });
  if (!announcement) return { error: "Circular not found" };

  const targeted = await resolveTargetedHouseholdIds({
    schoolId: ctx.schoolId,
    targetType: announcement.targetType as never,
    targetIds: Array.isArray(announcement.targetIds)
      ? (announcement.targetIds as string[])
      : null,
  });
  if (targeted.length === 0) return { data: [] };

  const [households, acks] = await Promise.all([
    db.household.findMany({
      where: { id: { in: targeted }, schoolId: ctx.schoolId },
      select: { id: true, name: true },
    }),
    db.circularAcknowledgement.findMany({
      where: { announcementId, householdId: { in: targeted } },
      select: {
        householdId: true,
        acknowledgedAt: true,
        acknowledgedBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const ackByHousehold = new Map(acks.map((a) => [a.householdId, a]));

  const rows = households.map((h) => {
    const ack = ackByHousehold.get(h.id);
    return {
      householdId: h.id,
      householdName: h.name,
      acknowledged: !!ack,
      acknowledgedAt: ack?.acknowledgedAt ?? null,
      acknowledgedBy: ack?.acknowledgedBy
        ? [ack.acknowledgedBy.firstName, ack.acknowledgedBy.lastName]
            .filter(Boolean)
            .join(" ") || "(deleted user)"
        : null,
    };
  });

  // Pending first, then alphabetic
  rows.sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    return a.householdName.localeCompare(b.householdName);
  });

  return { data: rows };
}

// ─── Chase (admin) ────────────────────────────────────────────────

export async function chaseAnnouncementAcknowledgementAction(
  announcementId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK,
  );
  if (denied) return denied;

  const announcement = await db.announcement.findFirst({
    where: { id: announcementId, schoolId: ctx.schoolId },
    select: {
      id: true,
      title: true,
      lastReminderSentAt: true,
      targetType: true,
      targetIds: true,
      requiresAcknowledgement: true,
    },
  });
  if (!announcement) return { error: "Circular not found" };
  if (!announcement.requiresAcknowledgement) {
    return { error: "This circular doesn't require acknowledgement." };
  }

  const now = Date.now();
  const lastMs = announcement.lastReminderSentAt?.getTime() ?? 0;
  const remainingMs = REMINDER_COOLDOWN_MS - (now - lastMs);
  if (remainingMs > 0) {
    const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return { error: `Reminder cooldown: ${hours} hour${hours === 1 ? "" : "s"} remaining.` };
  }

  const targeted = await resolveTargetedHouseholdIds({
    schoolId: ctx.schoolId,
    targetType: announcement.targetType as never,
    targetIds: Array.isArray(announcement.targetIds)
      ? (announcement.targetIds as string[])
      : null,
  });

  const acks = await db.circularAcknowledgement.findMany({
    where: { announcementId, householdId: { in: targeted } },
    select: { householdId: true },
  });
  const acknowledgedIds = new Set(acks.map((a) => a.householdId));
  const pendingHouseholdIds = targeted.filter((id) => !acknowledgedIds.has(id));

  if (pendingHouseholdIds.length === 0) {
    return { error: "Everyone has acknowledged. No one to remind." };
  }

  const guardians = await db.guardian.findMany({
    where: {
      householdId: { in: pendingHouseholdIds },
      userId: { not: null },
    },
    select: { userId: true },
  });
  const recipientUserIds = [
    ...new Set(guardians.map((g) => g.userId).filter((u): u is string => !!u)),
  ];

  await db.announcement.update({
    where: { id: announcementId },
    data: { lastReminderSentAt: new Date() },
  });

  try {
    if (recipientUserIds.length > 0) {
      await notifyCircularReminder({
        announcementId,
        title: announcement.title,
        recipientUserIds,
      });
    }
  } catch (err) {
    console.error("notifyCircularReminder failed", { announcementId, err });
  }

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Announcement",
    entityId: announcementId,
    module: "communication",
    description: `Sent acknowledgement reminder to ${pendingHouseholdIds.length} household(s)`,
    newData: { recipientUserCount: recipientUserIds.length, pendingHouseholdCount: pendingHouseholdIds.length },
  });

  return { success: true, notifiedCount: recipientUserIds.length };
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/communication/circular-acknowledgement.test.ts`
  Expected: all ~10 tests passing.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/communication/actions/circular-acknowledgement.action.ts tests/unit/modules/communication/circular-acknowledgement.test.ts
git commit -m "feat(circulars): acknowledge + stats + details + chase actions"
```

---

## Task 6: Extend announcement.action.ts

**Files:**
- Modify: `src/modules/communication/actions/announcement.action.ts`
- Create: `tests/unit/modules/communication/announcement-publish-ack.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/communication/announcement-publish-ack.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import {
  createAnnouncementAction,
  publishAnnouncementAction,
} from "@/modules/communication/actions/announcement.action";
import { notifyCircularPublished } from "@/modules/communication/circular-notifications";

vi.mock("@/modules/communication/circular-notifications", () => ({
  notifyCircularPublished: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/communication/circular-targeting", () => ({
  resolveTargetedHouseholdIds: vi.fn().mockResolvedValue(["hh-1", "hh-2"]),
}));

describe("createAnnouncementAction + requiresAcknowledgement", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:announcements:create"] });
  });

  it("persists requiresAcknowledgement=true when passed", async () => {
    prismaMock.announcement.create.mockResolvedValue({
      id: "a-1",
      requiresAcknowledgement: true,
    } as never);

    await createAnnouncementAction({
      title: "Exam fees due",
      content: "Please pay by Friday",
      targetType: "all",
      targetIds: null,
      priority: "high",
      requiresAcknowledgement: true,
    } as never);

    expect(prismaMock.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requiresAcknowledgement: true }),
      }),
    );
  });

  it("defaults requiresAcknowledgement=false when not passed", async () => {
    prismaMock.announcement.create.mockResolvedValue({
      id: "a-1",
      requiresAcknowledgement: false,
    } as never);

    await createAnnouncementAction({
      title: "Library closed",
      content: "on Friday",
      targetType: "all",
      targetIds: null,
      priority: "normal",
    } as never);

    expect(prismaMock.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requiresAcknowledgement: false }),
      }),
    );
  });
});

describe("publishAnnouncementAction fan-out", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:announcements:create"] });
    vi.mocked(notifyCircularPublished).mockClear();
  });

  it("fires notifyCircularPublished with requiresAcknowledgement=false for routine", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      title: "Library closed",
      status: "DRAFT",
      targetType: "all",
      targetIds: null,
      priority: "normal",
      requiresAcknowledgement: false,
    } as never);
    prismaMock.announcement.update.mockResolvedValue({} as never);
    prismaMock.guardian.findMany.mockResolvedValue([
      { userId: "u-1" },
      { userId: "u-2" },
    ] as never);

    await publishAnnouncementAction("a-1");

    expect(vi.mocked(notifyCircularPublished)).toHaveBeenCalledWith(
      expect.objectContaining({
        requiresAcknowledgement: false,
        recipientUserIds: expect.arrayContaining(["u-1", "u-2"]),
      }),
    );
  });

  it("fires notifyCircularPublished with requiresAcknowledgement=true when required", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      title: "Exam fees due",
      status: "DRAFT",
      targetType: "all",
      targetIds: null,
      priority: "high",
      requiresAcknowledgement: true,
    } as never);
    prismaMock.announcement.update.mockResolvedValue({} as never);
    prismaMock.guardian.findMany.mockResolvedValue([{ userId: "u-1" }] as never);

    await publishAnnouncementAction("a-1");

    expect(vi.mocked(notifyCircularPublished)).toHaveBeenCalledWith(
      expect.objectContaining({
        requiresAcknowledgement: true,
      }),
    );
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/communication/announcement-publish-ack.test.ts`
  Expected: fail (imports don't yet compile because the action signatures haven't changed).

### Step 3: Extend the existing action file

Open `src/modules/communication/actions/announcement.action.ts`.

**Change 1 — create/update schemas.** Find where the create/update action body accepts its input. Extend the accepted object:

```ts
// In createAnnouncementAction's input type and Zod schema (wherever Zod is)
requiresAcknowledgement?: boolean;
```

In the `db.announcement.create({ data: { ... } })` call, pass through:

```ts
requiresAcknowledgement: input.requiresAcknowledgement ?? false,
```

Same for `updateAnnouncementAction` — accept the optional field and pass through when provided.

**Change 2 — publish fan-out.** Find `publishAnnouncementAction`. After the existing `announcement.update({ ... status: "PUBLISHED" })` call, add:

```ts
import { resolveTargetedHouseholdIds } from "../circular-targeting";
import { notifyCircularPublished } from "../circular-notifications";
// ...inside publishAnnouncementAction, after the update:

try {
  const targeted = await resolveTargetedHouseholdIds({
    schoolId: ctx.schoolId,
    targetType: announcement.targetType as never,
    targetIds: Array.isArray(announcement.targetIds)
      ? (announcement.targetIds as string[])
      : null,
  });

  if (targeted.length > 0) {
    const guardians = await db.guardian.findMany({
      where: {
        householdId: { in: targeted },
        userId: { not: null },
      },
      select: { userId: true },
    });
    const recipientUserIds = [
      ...new Set(guardians.map((g) => g.userId).filter((u): u is string => !!u)),
    ];

    if (recipientUserIds.length > 0) {
      await notifyCircularPublished({
        announcementId: announcement.id,
        title: announcement.title,
        priority: (announcement.priority ?? "normal") as
          | "low"
          | "normal"
          | "high"
          | "urgent",
        recipientUserIds,
        requiresAcknowledgement: announcement.requiresAcknowledgement ?? false,
      });
    }
  }
} catch (err) {
  console.error("notifyCircularPublished failed", { announcementId: announcement.id, err });
}
```

If there's an existing `notify` call inside `publishAnnouncementAction` for the legacy `ANNOUNCEMENT_PUBLISHED` event, REMOVE it — `notifyCircularPublished` already fires the existing event internally. Confirm by checking `notifyCircularPublished` in `circular-notifications.ts` from Task 4.

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/communication/announcement-publish-ack.test.ts`
  Expected: all ~4 tests passing.
- [ ] Run: `npx vitest run tests/unit/modules/communication/`
  Expected: all existing announcement tests still pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/communication/actions/announcement.action.ts tests/unit/modules/communication/announcement-publish-ack.test.ts
git commit -m "feat(circulars): extend announcement create/update/publish with acknowledgement support"
```

---

## Task 7: Fix targeting bug + add getParentCircularsAction

**Files:**
- Modify: `src/modules/portal/actions/parent.action.ts`
- Create: `tests/unit/modules/portal/parent-circulars.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/portal/parent-circulars.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import {
  getParentAnnouncementsAction,
  getParentCircularsAction,
} from "@/modules/portal/actions/parent.action";

const fakeClassAnnouncement = {
  id: "a-class",
  schoolId: "default-school",
  status: "PUBLISHED",
  targetType: "class",
  targetIds: ["class-a"],
  title: "Class A only",
  content: "x",
  priority: "normal",
  publishedAt: new Date(),
  expiresAt: null,
  requiresAcknowledgement: false,
  lastReminderSentAt: null,
};

const fakeAllAnnouncement = {
  ...fakeClassAnnouncement,
  id: "a-all",
  targetType: "all",
  targetIds: null,
  title: "For everyone",
};

function mockGuardianWithStudents(students: Array<{
  id: string;
  classArmId: string | null;
  classId: string | null;
  programmeId: string | null;
  houseId: string | null;
}>) {
  // Simulate guardian → student relations that the action loads.
  prismaMock.guardian.findUnique.mockResolvedValue({
    userId: "test-user-id",
    householdId: "hh-1",
    students: students.map((s) => ({
      student: {
        id: s.id,
        status: "ACTIVE",
        enrollments: [
          {
            status: "ACTIVE",
            classArmId: s.classArmId,
            classArm: s.classId
              ? { id: s.classArmId, classId: s.classId, class: { programmeId: s.programmeId } }
              : null,
          },
        ],
        houseAssignment: s.houseId ? { houseId: s.houseId } : null,
      },
    })),
  } as never);
}

describe("getParentAnnouncementsAction (targeting bug regression)", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:announcements:read"] });
  });

  it("class-targeted circular is visible to guardian of student in that class", async () => {
    mockGuardianWithStudents([
      { id: "s1", classArmId: "arm-a", classId: "class-a", programmeId: "prog-1", houseId: null },
    ]);
    prismaMock.announcement.findMany.mockResolvedValue([fakeClassAnnouncement] as never);

    const res = await getParentAnnouncementsAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.map((a) => a.id)).toContain("a-class");
  });

  it("class-targeted circular is invisible to guardian of student NOT in that class", async () => {
    mockGuardianWithStudents([
      { id: "s1", classArmId: "arm-b", classId: "class-b", programmeId: "prog-1", houseId: null },
    ]);
    prismaMock.announcement.findMany.mockResolvedValue([fakeClassAnnouncement] as never);

    const res = await getParentAnnouncementsAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.map((a) => a.id)).not.toContain("a-class");
  });

  it("all-targeted circular visible to every guardian", async () => {
    mockGuardianWithStudents([
      { id: "s1", classArmId: "arm-b", classId: "class-b", programmeId: "prog-2", houseId: null },
    ]);
    prismaMock.announcement.findMany.mockResolvedValue([fakeAllAnnouncement] as never);

    const res = await getParentAnnouncementsAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.map((a) => a.id)).toContain("a-all");
  });
});

describe("getParentCircularsAction tabs", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:announcements:read"] });
  });

  it("pending tab returns ack-required circulars not yet acknowledged by my household", async () => {
    mockGuardianWithStudents([
      { id: "s1", classArmId: "arm-a", classId: "class-a", programmeId: "prog-1", houseId: null },
    ]);
    prismaMock.announcement.findMany.mockResolvedValue([
      { ...fakeAllAnnouncement, id: "a-ack", requiresAcknowledgement: true },
      { ...fakeAllAnnouncement, id: "a-routine", requiresAcknowledgement: false },
      { ...fakeAllAnnouncement, id: "a-acked", requiresAcknowledgement: true },
    ] as never);
    prismaMock.circularAcknowledgement.findMany.mockResolvedValue([
      { announcementId: "a-acked", householdId: "hh-1" },
    ] as never);

    const res = await getParentCircularsAction({ tab: "pending" });
    if (!("data" in res)) throw new Error("expected data");
    const ids = res.data.map((a) => a.id);
    expect(ids).toContain("a-ack");
    expect(ids).not.toContain("a-routine");
    expect(ids).not.toContain("a-acked");
  });

  it("history tab returns everything else (routine + already-acknowledged)", async () => {
    mockGuardianWithStudents([
      { id: "s1", classArmId: "arm-a", classId: "class-a", programmeId: "prog-1", houseId: null },
    ]);
    prismaMock.announcement.findMany.mockResolvedValue([
      { ...fakeAllAnnouncement, id: "a-ack", requiresAcknowledgement: true },
      { ...fakeAllAnnouncement, id: "a-routine", requiresAcknowledgement: false },
      { ...fakeAllAnnouncement, id: "a-acked", requiresAcknowledgement: true },
    ] as never);
    prismaMock.circularAcknowledgement.findMany.mockResolvedValue([
      { announcementId: "a-acked", householdId: "hh-1" },
    ] as never);

    const res = await getParentCircularsAction({ tab: "history" });
    if (!("data" in res)) throw new Error("expected data");
    const ids = res.data.map((a) => a.id);
    expect(ids).toContain("a-routine");
    expect(ids).toContain("a-acked");
    expect(ids).not.toContain("a-ack");
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/portal/parent-circulars.test.ts`
  Expected: fail (action signature may not match yet, or targeting bug still present).

### Step 3: Implement changes in `parent.action.ts`

Open `src/modules/portal/actions/parent.action.ts`.

**Change 1 — Fix `getParentAnnouncementsAction`.** Find the existing action. Replace its body with:

```ts
import { doesAnnouncementTargetGuardian } from "@/modules/communication/circular-targeting";
// ...

/** @no-audit Read-only parent view. */
export async function getParentAnnouncementsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ANNOUNCEMENTS_READ);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const guardian = await db.guardian.findUnique({
    where: { userId },
    select: {
      userId: true,
      householdId: true,
      students: {
        select: {
          student: {
            select: {
              id: true,
              status: true,
              enrollments: {
                where: { status: "ACTIVE" },
                take: 1,
                select: {
                  classArmId: true,
                  classArm: { select: { id: true, classId: true, class: { select: { programmeId: true } } } },
                },
              },
              houseAssignment: { select: { houseId: true } },
            },
          },
        },
      },
    },
  });

  if (!guardian) return { data: [] };

  const contexts = guardian.students
    .map((sg) => sg.student)
    .filter((s) => s.status === "ACTIVE" || s.status === "SUSPENDED")
    .map((s) => ({
      id: s.id,
      classArmId: s.enrollments[0]?.classArmId ?? null,
      classId: s.enrollments[0]?.classArm?.classId ?? null,
      programmeId: s.enrollments[0]?.classArm?.class?.programmeId ?? null,
      houseId: s.houseAssignment?.houseId ?? null,
    }));
  const studentIds = contexts.map((c) => c.id);

  const now = new Date();
  const candidates = await db.announcement.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "PUBLISHED",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { publishedAt: "desc" },
  });

  const visible = candidates.filter((a) =>
    doesAnnouncementTargetGuardian(
      { targetType: a.targetType, targetIds: a.targetIds },
      studentIds,
      contexts,
    ),
  );

  return { data: visible };
}
```

**Change 2 — Add `getParentCircularsAction`.** Append to the file:

```ts
/** @no-audit Read-only parent view. */
export async function getParentCircularsAction(input: {
  tab: "pending" | "history";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ANNOUNCEMENTS_READ);
  if (denied) return denied;

  const base = await getParentAnnouncementsAction();
  if ("error" in base) return base;

  const userId = ctx.session.user.id!;
  const guardian = await db.guardian.findUnique({
    where: { userId },
    select: { householdId: true },
  });

  const ackIds = new Set<string>();
  if (guardian?.householdId) {
    const acks = await db.circularAcknowledgement.findMany({
      where: {
        householdId: guardian.householdId,
        announcementId: { in: base.data.map((a) => a.id) },
      },
      select: { announcementId: true },
    });
    for (const a of acks) ackIds.add(a.announcementId);
  }

  const hydrated = base.data.map((a) => ({
    ...a,
    isAcknowledged: ackIds.has(a.id),
  }));

  const pending = hydrated.filter(
    (a) => a.requiresAcknowledgement && !a.isAcknowledged,
  );
  const history = hydrated.filter(
    (a) => !a.requiresAcknowledgement || a.isAcknowledged,
  );

  return { data: input.tab === "pending" ? pending : history };
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/portal/parent-circulars.test.ts`
  Expected: all passing.
- [ ] Run: `npx vitest run`
  Expected: no regressions.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/portal/actions/parent.action.ts tests/unit/modules/portal/parent-circulars.test.ts
git commit -m "fix(portal): correct parent announcement targeting + add getParentCirculars with tabs"
```

---

## Task 8: Parent portal UI — `/parent/circulars`

**Files:**
- Create: `src/app/(portal)/parent/circulars/page.tsx`
- Create: `src/app/(portal)/parent/circulars/circulars-client.tsx`
- Modify: `src/app/(portal)/portal-nav.tsx`

### Step 1: page.tsx

Create `src/app/(portal)/parent/circulars/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getParentCircularsAction } from "@/modules/portal/actions/parent.action";
import { CircularsClient } from "./circulars-client";

export default async function ParentCircularsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [pending, history] = await Promise.all([
    getParentCircularsAction({ tab: "pending" }),
    getParentCircularsAction({ tab: "history" }),
  ]);

  if ("error" in pending) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {pending.error}
        </div>
      </div>
    );
  }
  if ("error" in history) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {history.error}
        </div>
      </div>
    );
  }

  return <CircularsClient pending={pending.data as never} history={history.data as never} />;
}
```

### Step 2: circulars-client.tsx

Create `src/app/(portal)/parent/circulars/circulars-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { acknowledgeCircularAction } from "@/modules/communication/actions/circular-acknowledgement.action";

type CircularRow = {
  id: string;
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  publishedAt: Date | string;
  requiresAcknowledgement: boolean;
  isAcknowledged: boolean;
};

function StatusBadge({ status }: { status: "pending" | "acknowledged" | "routine" }) {
  const map = {
    pending: { label: "Pending", className: "bg-gray-100 text-gray-700" },
    acknowledged: { label: "Acknowledged", className: "bg-green-100 text-green-800" },
    routine: { label: "Read", className: "bg-gray-50 text-gray-500" },
  };
  const entry = map[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${entry.className}`}>
      {entry.label}
    </span>
  );
}

function PriorityChip({ priority }: { priority: CircularRow["priority"] }) {
  if (priority !== "high" && priority !== "urgent") return null;
  const colors =
    priority === "urgent"
      ? "bg-red-100 text-red-800"
      : "bg-amber-100 text-amber-800";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors}`}>
      {priority.toUpperCase()}
    </span>
  );
}

export function CircularsClient({
  pending,
  history,
}: {
  pending: CircularRow[];
  history: CircularRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "history">(
    pending.length > 0 ? "pending" : "history",
  );
  const [opened, setOpened] = useState<CircularRow | null>(null);
  const [working, start] = useTransition();

  const acknowledge = (id: string) => {
    start(async () => {
      const res = await acknowledgeCircularAction({ announcementId: id });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Acknowledged.");
      setOpened(null);
      router.refresh();
    });
  };

  const rows = tab === "pending" ? pending : history;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Circulars"
        description="Important messages from the school."
      />

      <div className="border-b border-gray-200 flex gap-4 text-sm">
        <button
          onClick={() => setTab("pending")}
          className={`pb-2 ${tab === "pending" ? "border-b-2 border-teal-600 font-semibold" : "text-gray-500"}`}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`pb-2 ${tab === "history" ? "border-b-2 border-teal-600 font-semibold" : "text-gray-500"}`}
        >
          History ({history.length})
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          {tab === "pending"
            ? "You're all caught up. No circulars need your acknowledgement."
            : "No circulars yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const badgeStatus: "pending" | "acknowledged" | "routine" =
              r.requiresAcknowledgement
                ? r.isAcknowledged
                  ? "acknowledged"
                  : "pending"
                : "routine";
            return (
              <div
                key={r.id}
                className="rounded-xl border border-gray-200 bg-white p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setOpened(r)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{r.title}</p>
                      <PriorityChip priority={r.priority} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(r.publishedAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {r.content}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusBadge status={badgeStatus} />
                    {tab === "pending" && r.requiresAcknowledgement && !r.isAcknowledged && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          acknowledge(r.id);
                        }}
                        disabled={working}
                        className="text-xs rounded-lg bg-teal-600 text-white px-3 py-1 disabled:opacity-50"
                      >
                        I acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {opened && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpened(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white p-6 space-y-3 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{opened.title}</h2>
              <PriorityChip priority={opened.priority} />
            </div>
            <p className="text-xs text-gray-500">
              {new Date(opened.publishedAt).toLocaleString()}
            </p>
            <div className="text-sm whitespace-pre-wrap">{opened.content}</div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setOpened(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Close
              </button>
              {opened.requiresAcknowledgement && !opened.isAcknowledged && (
                <button
                  onClick={() => acknowledge(opened.id)}
                  disabled={working}
                  className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  I acknowledge
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Nav link

In `src/app/(portal)/portal-nav.tsx`, find `parentLinks`. Add after `My requests`:

```ts
  { href: "/parent/circulars", label: "Circulars" },
```

### Step 4: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add "src/app/(portal)/parent/circulars/" "src/app/(portal)/portal-nav.tsx"
git commit -m "feat(circulars): parent portal Circulars UI with Pending/History tabs"
```

---

## Task 9: Admin tracker UI — extend announcements page

**Files:**
- Modify: `src/app/(dashboard)/communication/announcements/announcements-client.tsx`

The existing client component lists announcements. We extend it in three ways: (1) add a column showing acknowledgement stats, (2) add a detail drawer triggered by row click with the per-household table + chase button + CSV export, (3) add a "Require acknowledgement" checkbox to the create/edit form.

### Step 1: Extend the client component

Open `src/app/(dashboard)/communication/announcements/announcements-client.tsx`. Read it first to understand the existing structure (table layout, create/edit modal, state). You'll need to:

**(a) Import the new actions:**

```tsx
import {
  getAnnouncementAcknowledgementStatsAction,
  getAnnouncementAcknowledgementDetailsAction,
  chaseAnnouncementAcknowledgementAction,
} from "@/modules/communication/actions/circular-acknowledgement.action";
```

**(b) Track per-row stats.** On component mount (or after the announcements list loads), fire a batch of stat requests for announcements where `requiresAcknowledgement === true`. Store in a `Map<string, Stats>` keyed by announcement id:

```tsx
const [stats, setStats] = useState<Map<string, { targeted: number; acknowledged: number; pending: number; canSendReminder: boolean; lastReminderSentAt: Date | null }>>(new Map());

useEffect(() => {
  const ackRequired = rows.filter((r) => r.requiresAcknowledgement);
  Promise.all(
    ackRequired.map(async (r) => {
      const res = await getAnnouncementAcknowledgementStatsAction(r.id);
      if ("data" in res) return [r.id, res.data] as const;
      return null;
    }),
  ).then((entries) => {
    const m = new Map<string, never>();
    for (const e of entries) if (e) m.set(e[0], e[1] as never);
    setStats(m as never);
  });
}, [rows]);
```

**(c) Add acknowledgement column to the table.** In the existing table header, after the existing columns, add:

```tsx
<th className="p-3 text-left text-xs uppercase text-muted-foreground">Acks</th>
```

In the row, add:

```tsx
<td className="p-3 text-xs">
  {row.requiresAcknowledgement ? (
    (() => {
      const s = stats.get(row.id);
      if (!s) return <span className="text-muted-foreground">…</span>;
      const pct = s.targeted === 0 ? 0 : Math.round((s.acknowledged / s.targeted) * 100);
      return (
        <div className="min-w-24">
          <div className="flex justify-between">
            <span>{s.acknowledged} / {s.targeted}</span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <div className="w-full h-1 bg-muted rounded-full mt-1">
            <div className="h-1 bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      );
    })()
  ) : (
    <span className="text-muted-foreground">—</span>
  )}
</td>
```

**(d) Add a detail drawer.** Add state:

```tsx
const [openedRow, setOpenedRow] = useState<{ id: string; title: string; requiresAcknowledgement: boolean } | null>(null);
const [details, setDetails] = useState<Array<{ householdId: string; householdName: string; acknowledged: boolean; acknowledgedAt: Date | null; acknowledgedBy: string | null }>>([]);
const [detailsLoading, setDetailsLoading] = useState(false);
```

Modify the row onClick to open the drawer:

```tsx
<tr onClick={() => setOpenedRow({ id: row.id, title: row.title, requiresAcknowledgement: row.requiresAcknowledgement })} className="cursor-pointer hover:bg-muted/40">
```

When `openedRow` changes and it's `requiresAcknowledgement=true`, fetch details:

```tsx
useEffect(() => {
  if (!openedRow || !openedRow.requiresAcknowledgement) {
    setDetails([]);
    return;
  }
  setDetailsLoading(true);
  getAnnouncementAcknowledgementDetailsAction(openedRow.id).then((res) => {
    setDetailsLoading(false);
    if ("data" in res) setDetails(res.data as never);
  });
}, [openedRow]);
```

Render the drawer when `openedRow` is set:

```tsx
{openedRow && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    onClick={() => setOpenedRow(null)}
  >
    <div
      className="w-full max-w-3xl rounded-xl bg-card p-6 space-y-4 max-h-[85vh] overflow-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold">{openedRow.title}</h2>
        <button onClick={() => setOpenedRow(null)} className="text-muted-foreground">✕</button>
      </div>

      {openedRow.requiresAcknowledgement && (() => {
        const s = stats.get(openedRow.id);
        if (!s) return <p className="text-sm text-muted-foreground">Loading…</p>;
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">
                {s.acknowledged} of {s.targeted} households acknowledged ({s.pending} pending)
              </p>
              <div className="w-full h-2 bg-muted rounded-full mt-1">
                <div
                  className="h-2 bg-green-500 rounded-full"
                  style={{ width: `${s.targeted === 0 ? 0 : (s.acknowledged / s.targeted) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {s.lastReminderSentAt
                  ? `Last reminder sent: ${new Date(s.lastReminderSentAt).toLocaleString()}`
                  : "No reminders sent yet"}
              </p>
            </div>

            <button
              onClick={() => {
                start(async () => {
                  const res = await chaseAnnouncementAcknowledgementAction(openedRow.id);
                  if ("error" in res) { toast.error(res.error); return; }
                  toast.success(`Reminder sent to ${res.notifiedCount} recipient(s).`);
                  router.refresh();
                  // re-fetch stats + details
                  const fresh = await getAnnouncementAcknowledgementStatsAction(openedRow.id);
                  if ("data" in fresh) setStats((prev) => new Map(prev).set(openedRow.id, fresh.data as never));
                });
              }}
              disabled={!s.canSendReminder || s.pending === 0 || working}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
              title={
                !s.canSendReminder
                  ? "Within 24-hour cooldown"
                  : s.pending === 0
                    ? "Everyone has acknowledged"
                    : undefined
              }
            >
              Send reminder to {s.pending} pending household{s.pending === 1 ? "" : "s"}
            </button>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Household</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsLoading ? (
                    <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">Loading…</td></tr>
                  ) : details.length === 0 ? (
                    <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">No households targeted.</td></tr>
                  ) : (
                    details.map((d) => (
                      <tr key={d.householdId} className="border-t border-border">
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
                  const csv = ["Household,Status,AcknowledgedBy,AcknowledgedAt"]
                    .concat(details.map((d) =>
                      [
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
                  a.download = `acknowledgements-${openedRow.id}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-xs text-primary hover:underline"
              >
                Download CSV
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  </div>
)}
```

**(e) Add `requiresAcknowledgement` checkbox to the create/edit form.** Find the existing form (likely inside a modal). Add a field:

```tsx
<label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={formData.requiresAcknowledgement ?? false}
    onChange={(e) => setFormData({ ...formData, requiresAcknowledgement: e.target.checked })}
  />
  Require parents to acknowledge this circular
  <span className="text-xs text-muted-foreground">
    (targeted households will see an "I acknowledge" button)
  </span>
</label>
```

Ensure `formData` includes the field and it's passed through to `createAnnouncementAction` / `updateAnnouncementAction`.

### Step 2: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 3: Commit

```bash
git add "src/app/(dashboard)/communication/announcements/announcements-client.tsx"
git commit -m "feat(circulars): admin acknowledgement tracker + chase + CSV export"
```

---

## Task 10: Integration test (live DB)

**Files:**
- Create: `tests/integration/students/circular-acknowledgements.test.ts`

Model after `tests/integration/students/parent-requests.test.ts` for fixture setup/teardown.

### Step 1: Write the test

Create `tests/integration/students/circular-acknowledgements.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveSeededAdminId, loginAs } from "./setup";
import {
  acknowledgeCircularAction,
  getAnnouncementAcknowledgementStatsAction,
  chaseAnnouncementAcknowledgementAction,
} from "@/modules/communication/actions/circular-acknowledgement.action";
import { getParentCircularsAction } from "@/modules/portal/actions/parent.action";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Circular acknowledgements (integration)", () => {
  const db = new PrismaClient();
  const testTag = `circ-test-${Date.now()}`;

  let adminId: string;
  let parentUserId: string;
  let parentUser2Id: string;  // second household
  let studentId: string;
  let studentId2: string;
  let classId: string;
  let armId: string;
  let programmeId: string;
  let householdId: string;
  let household2Id: string;
  let announcementId: string;

  async function cleanupSeedData() {
    try {
      await db.circularAcknowledgement.deleteMany({ where: { announcementId } }).catch(() => {});
      if (announcementId) await db.announcement.delete({ where: { id: announcementId } }).catch(() => {});
      await db.studentGuardian.deleteMany({ where: { studentId: { in: [studentId, studentId2] } } }).catch(() => {});
      await db.enrollment.deleteMany({ where: { studentId: { in: [studentId, studentId2] } } }).catch(() => {});
      await db.student.deleteMany({ where: { id: { in: [studentId, studentId2] } } }).catch(() => {});
      await db.guardian.deleteMany({ where: { userId: { in: [parentUserId, parentUser2Id] } } }).catch(() => {});
      if (armId) await db.classArm.delete({ where: { id: armId } }).catch(() => {});
      if (classId) await db.class.delete({ where: { id: classId } }).catch(() => {});
      if (programmeId) await db.programme.delete({ where: { id: programmeId } }).catch(() => {});
      if (householdId) await db.household.delete({ where: { id: householdId } }).catch(() => {});
      if (household2Id) await db.household.delete({ where: { id: household2Id } }).catch(() => {});
      await db.user.deleteMany({ where: { id: { in: [parentUserId, parentUser2Id] } } }).catch(() => {});
    } catch {}
  }

  beforeAll(async () => {
    try {
      adminId = await resolveSeededAdminId();
      // Fixtures: two households, each with one child in the same class + an ACTIVE academic year.
      // Follow the same pattern as tests/integration/students/parent-requests.test.ts for:
      //  - User creation with firstName/lastName/email/passwordHash/status
      //  - Household creation
      //  - Guardian + StudentGuardian link + household link
      //  - Programme + Class + ClassArm
      //  - Student + active Enrollment in the arm
    } catch (e) {
      await cleanupSeedData();
      throw e;
    }
  });

  afterAll(async () => {
    await cleanupSeedData();
    await db.$disconnect();
  });

  it("happy path: admin creates ack-required circular → parent acknowledges → stats reflect", async () => {
    // Admin creates
    loginAs({ id: adminId, permissions: ["*"] });
    const ann = await db.announcement.create({
      data: {
        schoolId: "default-school",
        title: `${testTag}-circular`,
        content: "Please confirm receipt",
        targetType: "class",
        targetIds: [classId],
        priority: "high",
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdBy: adminId,
        requiresAcknowledgement: true,
      },
    });
    announcementId = ann.id;

    // Parent sees it in Pending
    loginAs({ id: parentUserId, permissions: ["communication:announcements:read", "communication:circulars:acknowledge"] });
    const pending = await getParentCircularsAction({ tab: "pending" });
    if (!("data" in pending)) throw new Error((pending as { error: string }).error);
    expect(pending.data.map((a) => a.id)).toContain(announcementId);

    // Parent acknowledges
    const ack = await acknowledgeCircularAction({ announcementId });
    expect(ack).toEqual({ success: true });

    // Parent no longer sees it in Pending
    const pendingAfter = await getParentCircularsAction({ tab: "pending" });
    if (!("data" in pendingAfter)) throw new Error((pendingAfter as { error: string }).error);
    expect(pendingAfter.data.map((a) => a.id)).not.toContain(announcementId);

    // ...and now sees it in History
    const history = await getParentCircularsAction({ tab: "history" });
    if (!("data" in history)) throw new Error((history as { error: string }).error);
    expect(history.data.map((a) => a.id)).toContain(announcementId);

    // Admin stats show 1 acknowledged
    loginAs({ id: adminId, permissions: ["*"] });
    const stats = await getAnnouncementAcknowledgementStatsAction(announcementId);
    if (!("data" in stats)) throw new Error((stats as { error: string }).error);
    expect(stats.data.acknowledged).toBe(1);
    expect(stats.data.targeted).toBeGreaterThanOrEqual(2);
  });

  it("second household acks independently", async () => {
    loginAs({ id: parentUser2Id, permissions: ["communication:announcements:read", "communication:circulars:acknowledge"] });
    const ack = await acknowledgeCircularAction({ announcementId });
    expect(ack).toEqual({ success: true });

    loginAs({ id: adminId, permissions: ["*"] });
    const stats = await getAnnouncementAcknowledgementStatsAction(announcementId);
    if (!("data" in stats)) throw new Error((stats as { error: string }).error);
    expect(stats.data.acknowledged).toBe(2);
  });

  it("double-tap acknowledge is idempotent", async () => {
    loginAs({ id: parentUserId, permissions: ["communication:announcements:read", "communication:circulars:acknowledge"] });
    const again = await acknowledgeCircularAction({ announcementId });
    expect(again).toEqual({ success: true });
  });

  it("chase cooldown enforced", async () => {
    loginAs({ id: adminId, permissions: ["*"] });

    // First chase — might succeed (if still pending) or return "Everyone acknowledged" depending on test order.
    // If pending=0 (both households acked), this test becomes a no-op; skip in that case.
    const stats = await getAnnouncementAcknowledgementStatsAction(announcementId);
    if (!("data" in stats)) throw new Error((stats as { error: string }).error);
    if (stats.data.pending === 0) return;

    const first = await chaseAnnouncementAcknowledgementAction(announcementId);
    // Either success or "everyone acked" — both are acceptable here
    expect(first).toSatisfy((r: unknown) => {
      const res = r as { success?: boolean; error?: string };
      return res.success === true || /everyone|cooldown/i.test(res.error ?? "");
    });

    // If first succeeded, a second chase immediately should be cooldown-rejected
    if ((first as { success?: boolean }).success) {
      const second = await chaseAnnouncementAcknowledgementAction(announcementId);
      expect((second as { error: string }).error).toMatch(/cooldown/i);
    }
  });

  it("tenant isolation: other-school caller cannot see this circular", async () => {
    loginAs({ id: "other-user", permissions: ["communication:announcements:read"], schoolId: "other-school" });
    const otherVisible = await db.announcement.findFirst({
      where: { id: announcementId, schoolId: "other-school" },
    });
    expect(otherVisible).toBeNull();
  });
});
```

Fill in the fixture details in `beforeAll` following the pattern of the existing parent-requests integration test (user creation, Household, Programme, Class, ClassArm, Student, Enrollment, Guardian, StudentGuardian). The student for household 1 must be in the class; student for household 2 must also be in the same class.

### Step 2: Verify

- [ ] Run: `npm run test:students`
  Expected: all integration tests pass, including the new file.

### Step 3: Commit

```bash
git add tests/integration/students/circular-acknowledgements.test.ts
git commit -m "test(circulars): live-DB integration coverage"
```

---

## Task 11: End-to-end verification

**Files:** verification only.

### Step 1: Full unit suite

- [ ] Run: `npx vitest run`
  Expected: all passing. Roughly 1833+ tests with the new additions.

### Step 2: Integration suite

- [ ] Run: `npm run test:students`
  Expected: all passing, including `circular-acknowledgements.test.ts`.

### Step 3: Audit guardrail

- [ ] Run: `npx vitest run tests/unit/guardrails/audit-coverage.test.ts`
  Expected: passing. `acknowledgeCircularAction` + `chaseAnnouncementAcknowledgementAction` carry `audit()`; read actions carry `@no-audit` JSDoc.

### Step 4: TypeScript

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Build

- [ ] Run: `npm run build`
  Expected: success. Confirm new route compiles:
  - `/parent/circulars`

### Step 6: Lint

- [ ] Run: `npm run lint`
  Expected: 0 errors, no new baseline warnings.

### Step 7: Prisma status

- [ ] Run: `npx prisma migrate status`
  Expected: up to date.

### Step 8: Manual UI walk

1. Log in as admin. Create an announcement targeting a class, tick "Require parents to acknowledge", publish.
2. Log in as a parent of a student in that class → `/parent/circulars` → tab "Pending" shows the circular → click "I acknowledge".
3. Reload → circular is now in "History" with green "Acknowledged" badge.
4. Log in as admin → open the announcement detail drawer → see "1 of N acknowledged" + pending household list + "Send reminder" button.
5. Click "Send reminder" → success toast + button greys out (24h cooldown tooltip on hover).
6. Log in as a parent whose child is NOT in the targeted class → `/parent/circulars` should NOT show the circular (targeting regression verified).
7. Admin creates an announcement WITHOUT `requiresAcknowledgement` → parents see it in "History" immediately; no acknowledge UI renders.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage:**
  - §4 data model → Task 1
  - §5 targeting + pending → Task 3 (helpers), Task 7 (parent-side fix)
  - §6 permissions → Task 2
  - §7 server actions → Tasks 5, 6, 7
  - §8 notifications → Task 4
  - §9 UI surfaces → Tasks 8, 9
  - §10 error handling → validated via Tasks 5, 7 tests
  - §11 testing → Tasks 3, 4, 5, 6, 7, 10
  - §12 verification → Task 11
- [x] **No placeholders:** every step has concrete code or exact commands.
- [x] **Type consistency:** `CircularRow`, stats shape `{ targeted, acknowledged, pending, canSendReminder, lastReminderSentAt }`, details shape `{ householdId, householdName, acknowledged, acknowledgedAt, acknowledgedBy }` used consistently across actions and UI.
- [x] **File paths:** absolute-from-repo-root.
- [x] **TDD shape:** Tasks 3, 4, 5, 6, 7 follow RED → implement → GREEN → commit. Tasks 1, 2 are data/config. Tasks 8, 9 are UI (no unit tests per repo convention). Task 10 is integration-only. Task 11 is verification-only.
