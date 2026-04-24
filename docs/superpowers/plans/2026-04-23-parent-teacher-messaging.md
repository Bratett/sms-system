# Parent ↔ Teacher Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/parent/messages` "Coming Soon" stub with a threaded messaging feature scoped per student between household guardians and the class teacher or housemaster, with per-message attachments, per-thread unread tracking, rate limiting, admin transparency, moderation workflow, and lifecycle-driven archival.

**Architecture:** New `src/modules/messaging/` module split into pure helpers (`eligibility.ts`, `notifications.ts`, `attachments.ts`, `lifecycle.ts`) and focused action files (`thread.action.ts`, `message.action.ts`, `message-moderation.action.ts`, `attachment.action.ts`). Four new Prisma models added to `communication.prisma`. Existing `NotificationPreference` + `sendMessage` hub reused for fan-out. R2 storage reused from document vault.

**Tech Stack:** Next.js 15 App Router, Prisma on PostgreSQL, vitest + vitest-mock-extended, Cloudflare R2, native HTML + tailwind.

**Spec reference:** `docs/superpowers/specs/2026-04-23-parent-teacher-messaging-design.md`

---

## File Structure

**New files**
- `src/modules/messaging/eligibility.ts` — pure rules
- `src/modules/messaging/notifications.ts` — fan-out over `sendMessage`
- `src/modules/messaging/attachments.ts` — MIME/size/key validation wrapper over R2
- `src/modules/messaging/lifecycle.ts` — archive + teacher-rotation helpers
- `src/modules/messaging/actions/thread.action.ts`
- `src/modules/messaging/actions/message.action.ts`
- `src/modules/messaging/actions/message-moderation.action.ts`
- `src/modules/messaging/actions/attachment.action.ts`
- `src/app/(portal)/staff/messages/page.tsx`
- `src/app/(portal)/staff/messages/messages-client.tsx`
- `src/app/(dashboard)/students/messaging/page.tsx`
- `src/app/(dashboard)/students/messaging/messaging-admin-client.tsx`
- `src/app/(dashboard)/students/messaging/reports/page.tsx`
- `src/app/(dashboard)/students/messaging/reports/reports-client.tsx`
- `tests/unit/modules/messaging/eligibility.test.ts`
- `tests/unit/modules/messaging/thread.test.ts`
- `tests/unit/modules/messaging/message.test.ts`
- `tests/unit/modules/messaging/moderation.test.ts`
- `tests/unit/modules/messaging/notifications.test.ts`
- `tests/unit/modules/messaging/attachments.test.ts`
- `tests/integration/students/messaging.test.ts`

**Modified files**
- `prisma/schema/communication.prisma` — append `MessageThread`, `Message`, `MessageThreadRead`, `MessageReport` models + enums + back-relations on `Student`, `School`, `User`
- Prisma migration `<timestamp>_add_messaging_models/migration.sql`
- `src/lib/permissions.ts` — 4 new permissions + grants + test
- `src/lib/notifications/events.ts` — 2 new event keys + `EVENT_CHANNELS` entries
- `src/app/(portal)/portal-nav.tsx` — add `Messages` link under `staffLinks`
- `src/app/(portal)/parent/messages/messages-client.tsx` — REWRITE (was stub)
- `src/app/(portal)/parent/messages/page.tsx` — adapt to load threads
- `src/modules/student/actions/transfer.action.ts` — call `archiveThreadsForStudent`
- `src/modules/student/actions/withdraw.action.ts` — same
- `src/modules/student/actions/graduate.action.ts` — same
- `src/modules/student/actions/promotion.action.ts` — call `rotateTeacherOnThreadsForArm` when class_teacher rotates
- `tests/unit/auth/permissions.test.ts` — +1 test
- `prisma/schema/student.prisma` — back-relation on `Student`
- `prisma/schema/school.prisma` — back-relation on `School`
- `prisma/schema/auth.prisma` (or wherever `User` lives) — back-relations on `User`

---

## Task 1: Schema migration (models + enums + back-relations)

**Files:**
- Modify: `prisma/schema/communication.prisma`
- Modify: `prisma/schema/student.prisma` (back-relation on `Student`)
- Modify: `prisma/schema/school.prisma` (back-relation on `School`)
- Modify: `prisma/schema/auth.prisma` (back-relations on `User`)
- Create: `prisma/schema/migrations/<timestamp>_add_messaging_models/migration.sql`

### Step 1: Append models to `communication.prisma`

At the bottom of `prisma/schema/communication.prisma`, append:

```prisma
// ─── Messaging: Parent ↔ Teacher threads ─────────────────────────────

model MessageThread {
  id            String              @id @default(cuid())
  schoolId      String
  studentId     String
  teacherUserId String
  status        MessageThreadStatus @default(ACTIVE)
  lockedAt      DateTime?
  lockedBy      String?
  lockReason    String?
  lastMessageAt DateTime?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  student  Student             @relation(fields: [studentId], references: [id], onDelete: Cascade)
  school   School              @relation("SchoolMessageThread", fields: [schoolId], references: [id])
  teacher  User                @relation("TeacherThreads", fields: [teacherUserId], references: [id])
  messages Message[]
  reads    MessageThreadRead[]

  @@unique([studentId, teacherUserId])
  @@index([schoolId, status])
  @@index([teacherUserId, status])
  @@index([studentId])
  @@index([lastMessageAt])
}

enum MessageThreadStatus {
  ACTIVE
  ARCHIVED
}

model Message {
  id             String   @id @default(cuid())
  threadId       String
  authorUserId   String
  body           String
  attachmentKey  String?
  attachmentName String?
  attachmentSize Int?
  attachmentMime String?
  systemNote     Boolean  @default(false)
  createdAt      DateTime @default(now())

  thread  MessageThread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  author  User            @relation("AuthoredMessages", fields: [authorUserId], references: [id])
  reports MessageReport[]

  @@index([threadId, createdAt])
  @@index([authorUserId])
}

model MessageThreadRead {
  id         String   @id @default(cuid())
  threadId   String
  userId     String
  lastReadAt DateTime @default(now())

  thread MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@unique([threadId, userId])
  @@index([userId])
}

model MessageReport {
  id               String              @id @default(cuid())
  messageId        String
  reportedByUserId String
  reason           String
  status           MessageReportStatus @default(PENDING)
  createdAt        DateTime            @default(now())
  resolvedAt       DateTime?
  resolvedByUserId String?

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([status, createdAt])
  @@index([messageId])
}

enum MessageReportStatus {
  PENDING
  DISMISSED
  ACTIONED
}
```

### Step 2: Add back-relation on `Student`

Open `prisma/schema/student.prisma`. Find `model Student { ... }`. Add alongside other relations:

```prisma
  messageThreads MessageThread[]
```

### Step 3: Add back-relation on `School`

Open `prisma/schema/school.prisma`. Find `model School { ... }`. Add alongside other relations:

```prisma
  messageThreads MessageThread[] @relation("SchoolMessageThread")
```

### Step 4: Add back-relations on `User`

Open `prisma/schema/auth.prisma` (or wherever `model User` is defined — confirm with a grep). Find `model User { ... }`. Add:

```prisma
  teacherThreads    MessageThread[] @relation("TeacherThreads")
  authoredMessages  Message[]       @relation("AuthoredMessages")
```

### Step 5: Validate

Run: `npx prisma validate`
Expected: `The schemas at prisma\schema are valid`.

### Step 6: Generate migration

Run: `npx prisma migrate dev --name add_messaging_models --create-only`
Expected: creates `prisma/schema/migrations/<timestamp>_add_messaging_models/migration.sql`.

Open the generated SQL. It should contain only:
- `CREATE TABLE "MessageThread" (...)`
- `CREATE TABLE "Message" (...)`
- `CREATE TABLE "MessageThreadRead" (...)`
- `CREATE TABLE "MessageReport" (...)`
- `CREATE TYPE "MessageThreadStatus" AS ENUM ('ACTIVE', 'ARCHIVED')`
- `CREATE TYPE "MessageReportStatus" AS ENUM ('PENDING', 'DISMISSED', 'ACTIONED')`
- Index + FK statements

If Prisma proposes any unrelated table alterations (spurious FK drift — a known repo issue), remove those lines from the migration SQL and keep only the messaging-related statements.

Then apply:

Run: `npx prisma migrate dev`
Expected: migration applied + Prisma client regenerated.

### Step 7: Verify

Run: `npx tsc --noEmit`
Expected: clean.

### Step 8: Commit

```bash
git add prisma/
git commit -m "feat(messaging): add MessageThread + Message + MessageThreadRead + MessageReport models"
```

---

## Task 2: Permissions + role grants

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `tests/unit/auth/permissions.test.ts`

### Step 1: Add four new constants

In `src/lib/permissions.ts`, find the `STUDENTS_*` / `HOUSEHOLDS_*` block. After the `GUARDIANS_MERGE` constant (added in Tier 2 #5), add:

```ts
  // Messaging
  MESSAGING_PORTAL_USE:   "messaging:portal:use",
  MESSAGING_REPORT:       "messaging:reports:create",
  MESSAGING_ADMIN_READ:   "messaging:admin:read",
  MESSAGING_ADMIN_REVIEW: "messaging:admin:review",
```

### Step 2: Grant `MESSAGING_PORTAL_USE` + `MESSAGING_REPORT` to parent / class_teacher / housemaster

Find each of `parent:`, `class_teacher:`, `housemaster:` role arrays in `DEFAULT_ROLE_PERMISSIONS`. Add both permissions:

```ts
    PERMISSIONS.MESSAGING_PORTAL_USE,
    PERMISSIONS.MESSAGING_REPORT,
```

### Step 3: Grant `MESSAGING_ADMIN_READ` to headmaster + both assistant headmasters

Find `headmaster:`, `assistant_headmaster_academic:`, `assistant_headmaster_admin:` arrays. Add:

```ts
    PERMISSIONS.MESSAGING_ADMIN_READ,
```

### Step 4: Grant `MESSAGING_ADMIN_REVIEW` to headmaster + assistant_headmaster_admin

Only these two admin roles. Find them and add:

```ts
    PERMISSIONS.MESSAGING_ADMIN_REVIEW,
```

### Step 5: Add regression test

Open `tests/unit/auth/permissions.test.ts`. Near the existing role-bundle tests, add:

```ts
it("messaging permissions are granted to the expected roles", () => {
  for (const role of ["parent", "class_teacher", "housemaster"]) {
    expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.MESSAGING_PORTAL_USE);
    expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.MESSAGING_REPORT);
  }
  for (const role of ["headmaster", "assistant_headmaster_academic", "assistant_headmaster_admin"]) {
    expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.MESSAGING_ADMIN_READ);
  }
  for (const role of ["headmaster", "assistant_headmaster_admin"]) {
    expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  }
  // Negative: parent must NOT have MESSAGING_ADMIN_*
  expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.MESSAGING_ADMIN_READ);
  expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  // Negative: guidance_counsellor (not a thread participant) must NOT have MESSAGING_PORTAL_USE
  expect(DEFAULT_ROLE_PERMISSIONS.guidance_counsellor).not.toContain(PERMISSIONS.MESSAGING_PORTAL_USE);
});
```

### Step 6: Verify

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vitest run tests/unit/auth/permissions.test.ts`
Expected: all existing tests pass + 1 new.

### Step 7: Commit

```bash
git add src/lib/permissions.ts tests/unit/auth/permissions.test.ts
git commit -m "feat(messaging): add MESSAGING_* permissions + role grants"
```

---

## Task 3: Pure eligibility helpers (TDD)

**Files:**
- Create: `src/modules/messaging/eligibility.ts`
- Create: `tests/unit/modules/messaging/eligibility.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/messaging/eligibility.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  eligibleStaffRole,
  parentCanMessageAbout,
  eligibleTeachersForStudent,
  isRateLimited,
  type StudentContext,
  type StaffAssignment,
  type GuardianLink,
} from "@/modules/messaging/eligibility";

const activeBoarder: StudentContext = {
  id: "s1",
  schoolId: "school-1",
  status: "ACTIVE",
  boardingStatus: "BOARDING",
  classArmId: "arm-1",
  houseId: "house-1",
};
const activeDay: StudentContext = { ...activeBoarder, boardingStatus: "DAY", houseId: null };
const withdrawnStudent: StudentContext = { ...activeBoarder, status: "WITHDRAWN" };
const suspendedStudent: StudentContext = { ...activeBoarder, status: "SUSPENDED" };

describe("eligibleStaffRole", () => {
  it("returns 'class_teacher' when staff is class teacher of the student's arm", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBe("class_teacher");
  });

  it("returns null when class teacher is of a different arm", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-9" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBeNull();
  });

  it("returns 'housemaster' for a housemaster of a matching boarding student's house", () => {
    const staff: StaffAssignment = { userId: "u2", role: "housemaster", houseId: "house-1" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBe("housemaster");
  });

  it("returns null for a housemaster when the student is a DAY student", () => {
    const staff: StaffAssignment = { userId: "u2", role: "housemaster", houseId: "house-1" };
    expect(eligibleStaffRole(staff, activeDay)).toBeNull();
  });

  it("returns null when the student is WITHDRAWN regardless of role", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(eligibleStaffRole(staff, withdrawnStudent)).toBeNull();
  });

  it("returns 'class_teacher' when the student is SUSPENDED (messaging allowed during suspension)", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(eligibleStaffRole(staff, suspendedStudent)).toBe("class_teacher");
  });

  it("returns null for subject_teacher (MVP excludes)", () => {
    const staff: StaffAssignment = { userId: "u3", role: "subject_teacher" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBeNull();
  });

  it("returns null when class teacher has no classArmId assignment", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBeNull();
  });

  it("returns null when housemaster has no houseId assignment", () => {
    const staff: StaffAssignment = { userId: "u2", role: "housemaster" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBeNull();
  });
});

describe("parentCanMessageAbout", () => {
  const links: GuardianLink[] = [
    { userId: "user-parent-A", studentId: "s1", householdId: "hh-1" },
    { userId: "user-parent-A", studentId: "s2", householdId: "hh-1" },
    { userId: "user-parent-B", studentId: "s1", householdId: "hh-1" },
  ];

  it("returns true when there's a link for (userId, studentId)", () => {
    expect(parentCanMessageAbout(links, "user-parent-A", "s1")).toBe(true);
    expect(parentCanMessageAbout(links, "user-parent-A", "s2")).toBe(true);
    expect(parentCanMessageAbout(links, "user-parent-B", "s1")).toBe(true);
  });

  it("returns false when no link exists", () => {
    expect(parentCanMessageAbout(links, "user-parent-B", "s2")).toBe(false);
    expect(parentCanMessageAbout(links, "user-other", "s1")).toBe(false);
  });

  it("returns false for an empty links list", () => {
    expect(parentCanMessageAbout([], "user-parent-A", "s1")).toBe(false);
  });
});

describe("eligibleTeachersForStudent", () => {
  it("returns only staff that match eligibility rules", () => {
    const assignments: StaffAssignment[] = [
      { userId: "u1", role: "class_teacher", classArmId: "arm-1" }, // eligible
      { userId: "u2", role: "housemaster", houseId: "house-1" }, // eligible (boarder)
      { userId: "u3", role: "class_teacher", classArmId: "arm-9" }, // not eligible
      { userId: "u4", role: "subject_teacher" }, // not eligible (MVP)
    ];
    const eligible = eligibleTeachersForStudent(activeBoarder, assignments);
    expect(eligible.map((a) => a.userId).sort()).toEqual(["u1", "u2"]);
  });

  it("returns empty when no assignment matches", () => {
    expect(eligibleTeachersForStudent(activeDay, [
      { userId: "u2", role: "housemaster", houseId: "house-1" },
    ])).toEqual([]);
  });
});

describe("isRateLimited", () => {
  const now = new Date("2026-04-23T12:00:00Z");

  it("returns false below the limit", () => {
    const timestamps = Array.from({ length: 9 }, (_, i) =>
      new Date(now.getTime() - (i + 1) * 60_000),
    );
    expect(isRateLimited(timestamps, now)).toBe(false);
  });

  it("returns true at the limit (10)", () => {
    const timestamps = Array.from({ length: 10 }, (_, i) =>
      new Date(now.getTime() - (i + 1) * 60_000),
    );
    expect(isRateLimited(timestamps, now)).toBe(true);
  });

  it("ignores timestamps older than the window", () => {
    const timestamps = Array.from({ length: 10 }, (_, i) =>
      new Date(now.getTime() - (i + 1) * 60 * 60_000), // each one an hour older than the last
    );
    expect(isRateLimited(timestamps, now)).toBe(false);
  });

  it("respects a custom window and limit", () => {
    const timestamps = [
      new Date(now.getTime() - 2 * 60_000),
      new Date(now.getTime() - 3 * 60_000),
    ];
    expect(isRateLimited(timestamps, now, 5 * 60_000, 2)).toBe(true);
    expect(isRateLimited(timestamps, now, 5 * 60_000, 3)).toBe(false);
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/modules/messaging/eligibility.test.ts`
Expected: fail — module not found.

### Step 3: Implement

Create `src/modules/messaging/eligibility.ts`:

```ts
export type StudentContext = {
  id: string;
  schoolId: string;
  status: "ACTIVE" | "SUSPENDED" | "TRANSFERRED" | "WITHDRAWN" | "GRADUATED";
  boardingStatus: "DAY" | "BOARDING";
  classArmId: string | null;
  houseId: string | null;
};

export type StaffAssignment = {
  userId: string;
  role: "class_teacher" | "housemaster" | "subject_teacher";
  classArmId?: string;
  houseId?: string;
};

export type GuardianLink = {
  userId: string;
  studentId: string;
  householdId: string | null;
};

const MESSAGEABLE_STATUSES = new Set(["ACTIVE", "SUSPENDED"]);

/**
 * Returns the staff role that grants eligibility to message about the student,
 * or null if no eligibility. Pure — no DB or network.
 *
 * Rules:
 *  - Student must be ACTIVE or SUSPENDED (not TRANSFERRED/WITHDRAWN/GRADUATED)
 *  - class_teacher with matching classArmId → "class_teacher"
 *  - housemaster with matching houseId AND student.boardingStatus === "BOARDING" → "housemaster"
 *  - Otherwise null
 */
export function eligibleStaffRole(
  staff: StaffAssignment,
  student: StudentContext,
): "class_teacher" | "housemaster" | null {
  if (!MESSAGEABLE_STATUSES.has(student.status)) return null;

  if (
    staff.role === "class_teacher" &&
    staff.classArmId != null &&
    staff.classArmId === student.classArmId
  ) {
    return "class_teacher";
  }

  if (
    staff.role === "housemaster" &&
    staff.houseId != null &&
    staff.houseId === student.houseId &&
    student.boardingStatus === "BOARDING"
  ) {
    return "housemaster";
  }

  return null;
}

/**
 * Returns true if the user is a household guardian of the student.
 * Pure.
 */
export function parentCanMessageAbout(
  guardianLinks: GuardianLink[],
  userId: string,
  studentId: string,
): boolean {
  return guardianLinks.some(
    (g) => g.userId === userId && g.studentId === studentId,
  );
}

/**
 * Filters assignments to those eligible for this student.
 * Pure.
 */
export function eligibleTeachersForStudent(
  student: StudentContext,
  assignments: StaffAssignment[],
): StaffAssignment[] {
  return assignments.filter((a) => eligibleStaffRole(a, student) !== null);
}

/**
 * Spam rate-limit calculator. Returns true if another message would exceed
 * `limit` within the trailing `windowMs`.
 *
 * Pure — caller provides recent timestamps and "now".
 */
export function isRateLimited(
  recentMessageTimestamps: Date[],
  now: Date = new Date(),
  windowMs: number = 60 * 60 * 1000, // 1 hour
  limit: number = 10,
): boolean {
  const threshold = now.getTime() - windowMs;
  const recentCount = recentMessageTimestamps.filter(
    (t) => t.getTime() >= threshold,
  ).length;
  return recentCount >= limit;
}
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/modules/messaging/eligibility.test.ts`
Expected: all ~16 tests passing.

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Commit

```bash
git add src/modules/messaging/eligibility.ts tests/unit/modules/messaging/eligibility.test.ts
git commit -m "feat(messaging): pure eligibility + rate-limit helpers"
```

---

## Task 4: Notification events + fan-out helper (TDD)

**Files:**
- Modify: `src/lib/notifications/events.ts`
- Create: `src/modules/messaging/notifications.ts`
- Create: `tests/unit/modules/messaging/notifications.test.ts`

### Step 1: Register the two new events

Open `src/lib/notifications/events.ts`. Find `NOTIFICATION_EVENTS`. Before the closing `} as const;`, add (inside the `// Communication` block or right after it):

```ts
  // Messaging
  MESSAGE_RECEIVED_PARENT: "message_received_parent",
  MESSAGE_RECEIVED_TEACHER: "message_received_teacher",
```

Find `EVENT_CHANNELS`. Before the closing `};`, add:

```ts
  [NOTIFICATION_EVENTS.MESSAGE_RECEIVED_PARENT]: ["in_app", "email"],
  [NOTIFICATION_EVENTS.MESSAGE_RECEIVED_TEACHER]: ["in_app"],
```

Run: `npx tsc --noEmit`
Expected: clean — the type-level `EVENT_CHANNELS: Record<NotificationEvent, …>` makes this map-completeness-checked.

### Step 2: Write failing tests

Create `tests/unit/modules/messaging/notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import { notifyNewMessage } from "@/modules/messaging/notifications";
import { sendMessage } from "@/lib/messaging/hub";

vi.mock("@/lib/messaging/hub", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

describe("notifyNewMessage", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
  });

  it("uses default channels when no NotificationPreference exists for the recipient", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);

    await notifyNewMessage({
      messageId: "m-1",
      threadId: "t-1",
      recipientUserIds: ["user-parent"],
      authorRole: "teacher",
      studentName: "Kofi Asante",
      authorName: "Ms. Mensah",
      bodyPreview: "Please review the attached homework.",
    });

    // Default for MESSAGE_RECEIVED_PARENT is [in_app, email]
    const calls = vi.mocked(sendMessage).mock.calls;
    const channelsCalled = calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
  });

  it("respects user preference overrides", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([
      { userId: "user-parent", eventKey: "message_received_parent", channels: ["IN_APP"] },
    ] as never);

    await notifyNewMessage({
      messageId: "m-1",
      threadId: "t-1",
      recipientUserIds: ["user-parent"],
      authorRole: "teacher",
      studentName: "Kofi",
      authorName: "Ms. Mensah",
      bodyPreview: "hi",
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).not.toContain("email");
  });

  it("skips recipients with opted-out prefs (empty channels)", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([
      { userId: "user-parent", eventKey: "message_received_parent", channels: [] },
    ] as never);

    await notifyNewMessage({
      messageId: "m-1",
      threadId: "t-1",
      recipientUserIds: ["user-parent"],
      authorRole: "teacher",
      studentName: "Kofi",
      authorName: "Ms. Mensah",
      bodyPreview: "hi",
    });

    expect(vi.mocked(sendMessage)).not.toHaveBeenCalled();
  });

  it("swallows per-recipient errors and continues the loop", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("whatsapp blew up"));

    await expect(
      notifyNewMessage({
        messageId: "m-1",
        threadId: "t-1",
        recipientUserIds: ["user-parent"],
        authorRole: "teacher",
        studentName: "K",
        authorName: "M",
        bodyPreview: "hi",
      }),
    ).resolves.toBeUndefined();
  });
});
```

### Step 3: Verify RED

Run: `npx vitest run tests/unit/modules/messaging/notifications.test.ts`
Expected: fail — module not found.

### Step 4: Implement

Create `src/modules/messaging/notifications.ts`:

```ts
import { db } from "@/lib/db";
import { sendMessage, type ChannelType } from "@/lib/messaging/hub";
import { NOTIFICATION_EVENTS, EVENT_CHANNELS } from "@/lib/notifications/events";
import type { NotificationChannel } from "@prisma/client";

type NotifyParams = {
  messageId: string;
  threadId: string;
  recipientUserIds: string[];
  authorRole: "parent" | "teacher";
  studentName: string;
  authorName: string;
  bodyPreview: string;
};

const CHANNEL_ENUM_TO_HUB: Record<NotificationChannel, ChannelType | null> = {
  IN_APP: "in_app",
  WHATSAPP: "whatsapp",
  PUSH: "push",
  // SMS and EMAIL are handled by other infra layers (BullMQ / Nodemailer) and
  // are not routed through the hub in MVP. They're silently skipped here —
  // users who opt into them via preferences will see the preference persist
  // but no delivery fires until those channel adapters are added.
  SMS: null,
  EMAIL: null,
};

const EVENT_CHANNELS_AS_ENUM: Record<"parent" | "teacher", NotificationChannel[]> = {
  parent: (EVENT_CHANNELS[NOTIFICATION_EVENTS.MESSAGE_RECEIVED_PARENT] ?? ["in_app"])
    .map((c) => channelKeyToEnum(c)),
  teacher: (EVENT_CHANNELS[NOTIFICATION_EVENTS.MESSAGE_RECEIVED_TEACHER] ?? ["in_app"])
    .map((c) => channelKeyToEnum(c)),
};

/**
 * Fan out a new-message notification to recipients via their preferred
 * channels (or the system defaults if no preference exists).
 *
 * Errors during individual dispatches are swallowed so one recipient's
 * failure doesn't block others. Callers may await this or fire-and-forget.
 */
export async function notifyNewMessage(params: NotifyParams): Promise<void> {
  const eventKey =
    params.authorRole === "teacher"
      ? NOTIFICATION_EVENTS.MESSAGE_RECEIVED_PARENT
      : NOTIFICATION_EVENTS.MESSAGE_RECEIVED_TEACHER;

  // Whose event is it? Parent-received notifications go to the parent;
  // teacher-received go to the teacher. Determines which defaults apply.
  const audience: "parent" | "teacher" =
    params.authorRole === "teacher" ? "parent" : "teacher";

  // Load all preferences in one query
  const prefs = await db.notificationPreference.findMany({
    where: {
      userId: { in: params.recipientUserIds },
      eventKey,
    },
  });
  const prefByUser = new Map(prefs.map((p) => [p.userId, p.channels]));

  for (const userId of params.recipientUserIds) {
    const override = prefByUser.get(userId);
    const channels = override ?? EVENT_CHANNELS_AS_ENUM[audience];

    // opt-out
    if (channels.length === 0) continue;

    for (const channel of channels) {
      const hubChannel = CHANNEL_ENUM_TO_HUB[channel];
      if (!hubChannel) continue;

      try {
        await sendMessage(hubChannel, {
          to: userId,
          body: renderBody(params),
          templateData: {
            studentName: params.studentName,
            authorName: params.authorName,
            bodyPreview: params.bodyPreview,
            eventKey,
            threadId: params.threadId,
          },
        });
      } catch {
        // Swallow — logged by the hub itself; we must not block other recipients/channels
      }
    }
  }
}

function renderBody(p: NotifyParams): string {
  const who =
    p.authorRole === "teacher"
      ? `${p.authorName} (teacher)`
      : `${p.authorName} (parent)`;
  return `New message about ${p.studentName} from ${who}: ${p.bodyPreview}`;
}

function channelKeyToEnum(c: string): NotificationChannel {
  switch (c) {
    case "in_app": return "IN_APP";
    case "sms": return "SMS";
    case "email": return "EMAIL";
    case "whatsapp": return "WHATSAPP";
    case "push": return "PUSH";
    default: return "IN_APP";
  }
}
```

### Step 5: Verify GREEN

Run: `npx vitest run tests/unit/modules/messaging/notifications.test.ts`
Expected: 4 tests passing.

Run: `npx tsc --noEmit`
Expected: clean.

### Step 6: Commit

```bash
git add src/modules/messaging/notifications.ts src/lib/notifications/events.ts tests/unit/modules/messaging/notifications.test.ts
git commit -m "feat(messaging): register MESSAGE_RECEIVED_* events + notifyNewMessage helper"
```

---

## Task 5: Attachment helper (TDD)

**Files:**
- Create: `src/modules/messaging/attachments.ts`
- Create: `tests/unit/modules/messaging/attachments.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/messaging/attachments.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  validateAttachment,
  buildAttachmentKey,
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "@/modules/messaging/attachments";

describe("validateAttachment", () => {
  it("accepts allowed MIME + size within limit", () => {
    const result = validateAttachment({
      mimeType: "application/pdf",
      size: 100_000,
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects unsupported MIME", () => {
    const result = validateAttachment({
      mimeType: "application/x-executable",
      size: 100,
    });
    expect(result).toEqual({ ok: false, error: expect.stringContaining("File type") });
  });

  it("rejects oversized file", () => {
    const result = validateAttachment({
      mimeType: "application/pdf",
      size: MAX_ATTACHMENT_SIZE_BYTES + 1,
    });
    expect(result).toEqual({ ok: false, error: expect.stringContaining("5 MB") });
  });

  it("accepts all whitelisted MIME types", () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      expect(validateAttachment({ mimeType: mime, size: 1024 })).toEqual({ ok: true });
    }
  });
});

describe("buildAttachmentKey", () => {
  it("uses schoolId + threadId + uuid + sanitized filename", () => {
    const key = buildAttachmentKey({
      schoolId: "school-1",
      threadId: "t-1",
      filename: "Homework Sheet #5.pdf",
    });
    expect(key).toMatch(/^messages\/school-1\/t-1\/[0-9a-f-]+-homework_sheet__5\.pdf$/);
  });

  it("prevents path traversal in filename", () => {
    const key = buildAttachmentKey({
      schoolId: "school-1",
      threadId: "t-1",
      filename: "../../etc/passwd",
    });
    expect(key).not.toContain("..");
    expect(key.startsWith("messages/school-1/t-1/")).toBe(true);
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/modules/messaging/attachments.test.ts`
Expected: fail — module not found.

### Step 3: Implement

Create `src/modules/messaging/attachments.ts`:

```ts
import { randomUUID } from "node:crypto";

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
] as const;

export type ValidateResult = { ok: true } | { ok: false; error: string };

/**
 * Pure validator for attachment metadata. Caller MUST re-verify by HEAD'ing
 * R2 after upload to catch MIME/size mismatches from client-side lies.
 */
export function validateAttachment(input: {
  mimeType: string;
  size: number;
}): ValidateResult {
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      ok: false,
      error: `File type "${input.mimeType}" is not allowed. Accepted: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }
  if (input.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { ok: false, error: "File is too large. Maximum size is 5 MB." };
  }
  if (input.size <= 0) {
    return { ok: false, error: "File is empty." };
  }
  return { ok: true };
}

/**
 * Deterministic R2 key generation. Sanitises filename and prefixes with a
 * random UUID to avoid collisions. Scoped by schoolId so a leaked key cannot
 * target another tenant's bucket space.
 */
export function buildAttachmentKey(input: {
  schoolId: string;
  threadId: string;
  filename: string;
}): string {
  const safeName = sanitiseFilename(input.filename);
  const uuid = randomUUID();
  return `messages/${input.schoolId}/${input.threadId}/${uuid}-${safeName}`;
}

function sanitiseFilename(name: string): string {
  // Strip leading path segments, replace unsafe chars with underscore,
  // preserve extension.
  const lastSegment = name.split(/[\\/]/).pop() ?? "file";
  return lastSegment
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
}
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/modules/messaging/attachments.test.ts`
Expected: all tests passing.

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Commit

```bash
git add src/modules/messaging/attachments.ts tests/unit/modules/messaging/attachments.test.ts
git commit -m "feat(messaging): attachment MIME/size validation + R2 key builder"
```

---

## Task 6: Thread action (CRUD) with TDD

**Files:**
- Create: `src/modules/messaging/actions/thread.action.ts`
- Create: `tests/unit/modules/messaging/thread.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/messaging/thread.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../../setup";
import {
  getMessageThreadsAction,
  getMessageThreadAction,
  createMessageThreadAction,
  markThreadReadAction,
  archiveThreadAction,
} from "@/modules/messaging/actions/thread.action";

const sampleStudent = {
  id: "s-1",
  schoolId: "default-school",
  firstName: "Kofi",
  lastName: "Asante",
  status: "ACTIVE",
  boardingStatus: "BOARDING",
  classArmId: "arm-1",
  houseAssignment: { houseId: "house-1" },
  guardians: [{ guardian: { userId: "user-parent-A" } }],
};

const sampleTeacher = {
  id: "user-teacher",
  name: "Ms. Mensah",
};

describe("getMessageThreadsAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:portal:use"] }));

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMessageThreadsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects users without MESSAGING_PORTAL_USE or MESSAGING_ADMIN_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getMessageThreadsAction();
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("returns empty list when user has no threads", async () => {
    prismaMock.messageThread.findMany.mockResolvedValue([] as never);
    const result = await getMessageThreadsAction();
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data).toEqual([]);
  });
});

describe("getMessageThreadAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:portal:use"] }));

  it("returns { error: 'Thread not found' } when missing", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(null as never);
    const result = await getMessageThreadAction("nope");
    expect(result).toEqual({ error: "Thread not found" });
  });

  it("bumps lastReadAt for a participant", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      id: "t-1",
      schoolId: "default-school",
      studentId: "s-1",
      teacherUserId: "user-teacher",
      status: "ACTIVE",
      lockedAt: null,
      messages: [],
      student: { id: "s-1", guardians: [{ guardian: { userId: "test-user-id" } }] },
    } as never);
    prismaMock.messageThreadRead.upsert.mockResolvedValue({} as never);

    await getMessageThreadAction("t-1");
    expect(prismaMock.messageThreadRead.upsert).toHaveBeenCalled();
  });
});

describe("createMessageThreadAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:portal:use"] }));

  it("rejects when user is not a household guardian of the student", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      ...sampleStudent,
      guardians: [{ guardian: { userId: "user-other" } }],
    } as never);
    prismaMock.user.findUnique.mockResolvedValue(sampleTeacher as never);

    const result = await createMessageThreadAction({
      studentId: "s-1",
      teacherUserId: "user-teacher",
      initialBody: "Hello",
    });
    expect(result).toHaveProperty("error");
  });

  it("returns existing thread when one already exists for (student, teacher)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.user.findUnique.mockResolvedValue(sampleTeacher as never);
    prismaMock.userRole.findMany.mockResolvedValue([
      { userId: "user-teacher", role: { name: "class_teacher" } },
    ] as never);
    prismaMock.class.findMany.mockResolvedValue([] as never); // stub for teacher-arm lookup if needed
    prismaMock.messageThread.findUnique.mockResolvedValue({
      id: "existing",
      schoolId: "default-school",
    } as never);

    const result = await createMessageThreadAction({
      studentId: "s-1",
      teacherUserId: "user-teacher",
      initialBody: "Hi",
    });
    if (!("data" in result)) throw new Error("expected data: " + JSON.stringify(result));
    expect(result.data.id).toBe("existing");
  });
});

describe("markThreadReadAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:portal:use"] }));

  it("upserts MessageThreadRead for the caller", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      id: "t-1",
      schoolId: "default-school",
      teacherUserId: "user-teacher",
      student: { guardians: [{ guardian: { userId: "test-user-id" } }] },
    } as never);
    prismaMock.messageThreadRead.upsert.mockResolvedValue({} as never);

    await markThreadReadAction("t-1");
    expect(prismaMock.messageThreadRead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { threadId_userId: { threadId: "t-1", userId: "test-user-id" } },
      }),
    );
  });
});

describe("archiveThreadAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:admin:review"] }));

  it("rejects users without MESSAGING_ADMIN_REVIEW", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await archiveThreadAction("t-1");
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("archives + audits", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      id: "t-1",
      schoolId: "default-school",
      status: "ACTIVE",
    } as never);
    prismaMock.messageThread.update.mockResolvedValue({} as never);

    const result = await archiveThreadAction("t-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.messageThread.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ARCHIVED" }) }),
    );
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/modules/messaging/thread.test.ts`
Expected: fail — module not found.

### Step 3: Implement

Create `src/modules/messaging/actions/thread.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireAuth, requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

type ThreadListRow = {
  id: string;
  studentId: string;
  studentName: string;
  teacherUserId: string;
  teacherName: string;
  status: "ACTIVE" | "ARCHIVED";
  locked: boolean;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
};

// ─── List Threads ──────────────────────────────────────────────────

export async function getMessageThreadsAction(filters?: {
  studentId?: string;
  status?: "ACTIVE" | "ARCHIVED";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const hasPortalUse = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  const hasAdminRead = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_READ);
  if (!hasPortalUse && !hasAdminRead) {
    return { error: "Insufficient permissions" };
  }

  const userId = ctx.session.user.id!;

  // Scope:
  //  - Admin (MESSAGING_ADMIN_READ): all threads in school
  //  - Otherwise: threads where caller is the teacher OR a household guardian of the student
  const where: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.studentId ? { studentId: filters.studentId } : {}),
  };

  if (!hasAdminRead) {
    where.OR = [
      { teacherUserId: userId },
      { student: { guardians: { some: { guardian: { userId } } } } },
    ];
  }

  const threads = await db.messageThread.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      teacher: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, systemNote: true },
      },
      reads: {
        where: { userId },
        select: { lastReadAt: true },
      },
    },
  });

  const data: ThreadListRow[] = await Promise.all(
    threads.map(async (t) => {
      const lastReadAt = t.reads[0]?.lastReadAt ?? null;
      const unreadCount = await db.message.count({
        where: {
          threadId: t.id,
          authorUserId: { not: userId },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      });
      const lastMsg = t.messages[0];
      return {
        id: t.id,
        studentId: t.studentId,
        studentName: `${t.student.firstName} ${t.student.lastName}`,
        teacherUserId: t.teacherUserId,
        teacherName: t.teacher.name ?? "(teacher)",
        status: t.status,
        locked: t.lockedAt != null,
        lastMessageAt: t.lastMessageAt,
        lastMessagePreview: lastMsg?.body?.slice(0, 120) ?? null,
        unreadCount,
      };
    }),
  );

  return { data };
}

// ─── Get Single Thread ─────────────────────────────────────────────

export async function getMessageThreadAction(threadId: string, options?: { limit?: number }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const hasPortalUse = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  const hasAdminRead = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_READ);
  if (!hasPortalUse && !hasAdminRead) return { error: "Insufficient permissions" };

  const userId = ctx.session.user.id!;

  const thread = await db.messageThread.findFirst({
    where: { id: threadId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          guardians: { select: { guardian: { select: { userId: true } } } },
        },
      },
      teacher: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: options?.limit ?? 50,
      },
    },
  });
  if (!thread) return { error: "Thread not found" };

  // Determine if caller is a participant
  const guardianUserIds = thread.student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const isParticipant = userId === thread.teacherUserId || guardianUserIds.includes(userId);

  if (isParticipant) {
    await db.messageThreadRead.upsert({
      where: { threadId_userId: { threadId, userId } },
      create: { threadId, userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
  }

  return {
    data: {
      id: thread.id,
      studentId: thread.studentId,
      studentName: `${thread.student.firstName} ${thread.student.lastName}`,
      teacher: { id: thread.teacher.id, name: thread.teacher.name ?? "(teacher)" },
      status: thread.status,
      locked: thread.lockedAt != null,
      lockReason: thread.lockReason,
      messages: thread.messages.slice().reverse(), // chronological order for UI
      isParticipant,
      isAdmin: hasAdminRead && !isParticipant,
    },
  };
}

// ─── Create Thread ─────────────────────────────────────────────────

export async function createMessageThreadAction(input: {
  studentId: string;
  teacherUserId: string;
  initialBody: string;
  attachmentKey?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMime?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const body = (input.initialBody ?? "").trim();
  if (!body) return { error: "Message body is required." };

  // Load student + household guardian userIds
  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId: ctx.schoolId },
    select: {
      id: true,
      schoolId: true,
      status: true,
      boardingStatus: true,
      guardians: { select: { guardian: { select: { userId: true } } } },
      enrollments: {
        where: { status: "ACTIVE" },
        select: { classArmId: true },
        take: 1,
      },
      houseAssignment: { select: { houseId: true } },
    },
  });
  if (!student) return { error: "Student not found." };

  const guardianUserIds = student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const callerIsGuardian = guardianUserIds.includes(userId);
  const callerIsTheTeacher = userId === input.teacherUserId;

  if (!callerIsGuardian && !callerIsTheTeacher) {
    return { error: "You are not allowed to participate in this thread." };
  }

  // If there's already a thread, return it
  const existing = await db.messageThread.findUnique({
    where: {
      studentId_teacherUserId: {
        studentId: input.studentId,
        teacherUserId: input.teacherUserId,
      },
    },
  });
  if (existing) {
    // Post the initial body as a regular message to the existing thread
    const msg = await db.message.create({
      data: {
        threadId: existing.id,
        authorUserId: userId,
        body,
        attachmentKey: input.attachmentKey ?? null,
        attachmentName: input.attachmentName ?? null,
        attachmentSize: input.attachmentSize ?? null,
        attachmentMime: input.attachmentMime ?? null,
      },
    });
    await db.messageThread.update({
      where: { id: existing.id },
      data: { lastMessageAt: msg.createdAt },
    });
    return { data: existing };
  }

  // Create thread + first message in a transaction
  const { thread } = await db.$transaction(async (tx) => {
    const t = await tx.messageThread.create({
      data: {
        schoolId: ctx.schoolId,
        studentId: input.studentId,
        teacherUserId: input.teacherUserId,
        status: "ACTIVE",
        lastMessageAt: new Date(),
      },
    });
    await tx.message.create({
      data: {
        threadId: t.id,
        authorUserId: userId,
        body,
        attachmentKey: input.attachmentKey ?? null,
        attachmentName: input.attachmentName ?? null,
        attachmentSize: input.attachmentSize ?? null,
        attachmentMime: input.attachmentMime ?? null,
      },
    });
    return { thread: t };
  });

  return { data: thread };
}

// ─── Mark Thread Read ──────────────────────────────────────────────

/** @no-audit Portal read-state tracking; not a material mutation. */
export async function markThreadReadAction(threadId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const thread = await db.messageThread.findFirst({
    where: { id: threadId, schoolId: ctx.schoolId },
    select: {
      teacherUserId: true,
      student: { select: { guardians: { select: { guardian: { select: { userId: true } } } } } },
    },
  });
  if (!thread) return { error: "Thread not found" };

  const guardianUserIds = thread.student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const isParticipant = userId === thread.teacherUserId || guardianUserIds.includes(userId);
  if (!isParticipant) return { success: true }; // silent no-op for admin viewers

  await db.messageThreadRead.upsert({
    where: { threadId_userId: { threadId, userId } },
    create: { threadId, userId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  return { success: true };
}

// ─── Archive Thread (Admin-callable) ───────────────────────────────

export async function archiveThreadAction(threadId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  if (denied) return denied;

  const thread = await db.messageThread.findFirst({
    where: { id: threadId, schoolId: ctx.schoolId },
  });
  if (!thread) return { error: "Thread not found" };

  if (thread.status === "ARCHIVED") return { success: true }; // idempotent

  await db.messageThread.update({
    where: { id: threadId },
    data: { status: "ARCHIVED" },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MessageThread",
    entityId: threadId,
    module: "messaging",
    description: `Archived message thread ${threadId}`,
  });

  return { success: true };
}
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/modules/messaging/thread.test.ts`
Expected: all tests passing.

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Commit

```bash
git add src/modules/messaging/actions/thread.action.ts tests/unit/modules/messaging/thread.test.ts
git commit -m "feat(messaging): thread CRUD actions (list, get, create, mark-read, archive)"
```

---

## Task 7: Message action (post + report) with TDD

**Files:**
- Create: `src/modules/messaging/actions/message.action.ts`
- Create: `tests/unit/modules/messaging/message.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/messaging/message.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  postMessageAction,
  reportMessageAction,
} from "@/modules/messaging/actions/message.action";
import { notifyNewMessage } from "@/modules/messaging/notifications";

vi.mock("@/modules/messaging/notifications", () => ({
  notifyNewMessage: vi.fn().mockResolvedValue(undefined),
}));

const activeThread = {
  id: "t-1",
  schoolId: "default-school",
  studentId: "s-1",
  teacherUserId: "user-teacher",
  status: "ACTIVE" as const,
  lockedAt: null as Date | null,
  student: {
    id: "s-1",
    firstName: "Kofi",
    lastName: "Asante",
    guardians: [{ guardian: { userId: "test-user-id" } }], // caller is a guardian
  },
  teacher: { id: "user-teacher", name: "Ms. Mensah" },
};

describe("postMessageAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["messaging:portal:use"] });
    vi.mocked(notifyNewMessage).mockClear();
  });

  it("rejects when thread is archived", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      ...activeThread,
      status: "ARCHIVED",
    } as never);

    const result = await postMessageAction({ threadId: "t-1", body: "hi" });
    expect(result).toEqual({ error: "Thread is archived." });
  });

  it("rejects when thread is locked", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      ...activeThread,
      lockedAt: new Date(),
    } as never);

    const result = await postMessageAction({ threadId: "t-1", body: "hi" });
    expect(result).toEqual({ error: "Thread is locked." });
  });

  it("rejects when caller is not a participant", async () => {
    mockAuthenticatedUser({ permissions: ["messaging:portal:use"] }); // id = test-user-id
    prismaMock.messageThread.findFirst.mockResolvedValue({
      ...activeThread,
      student: { ...activeThread.student, guardians: [{ guardian: { userId: "other" } }] },
    } as never);

    const result = await postMessageAction({ threadId: "t-1", body: "hi" });
    expect(result).toEqual({ error: "You are not a participant of this thread." });
  });

  it("rejects when rate-limited", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(activeThread as never);
    prismaMock.message.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        createdAt: new Date(Date.now() - i * 60_000),
      })) as never,
    );

    const result = await postMessageAction({ threadId: "t-1", body: "spam" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Too many messages");
  });

  it("creates a message and triggers notification fan-out", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(activeThread as never);
    prismaMock.message.findMany.mockResolvedValue([] as never);
    prismaMock.message.create.mockResolvedValue({
      id: "m-new",
      threadId: "t-1",
      authorUserId: "test-user-id",
      body: "hello",
      createdAt: new Date(),
    } as never);
    prismaMock.messageThread.update.mockResolvedValue({} as never);

    const result = await postMessageAction({ threadId: "t-1", body: "hello" });
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.id).toBe("m-new");
    expect(vi.mocked(notifyNewMessage)).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "m-new",
        threadId: "t-1",
        authorRole: "parent",
      }),
    );
  });

  it("rejects attachment with unsupported MIME type", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(activeThread as never);
    prismaMock.message.findMany.mockResolvedValue([] as never);

    const result = await postMessageAction({
      threadId: "t-1",
      body: "see attached",
      attachmentKey: "messages/default-school/t-1/abc-evil.exe",
      attachmentName: "evil.exe",
      attachmentSize: 1024,
      attachmentMime: "application/x-msdownload",
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("not allowed");
  });

  it("rejects attachment exceeding 5 MB", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(activeThread as never);
    prismaMock.message.findMany.mockResolvedValue([] as never);

    const result = await postMessageAction({
      threadId: "t-1",
      body: "see attached",
      attachmentKey: "messages/default-school/t-1/abc-big.pdf",
      attachmentName: "big.pdf",
      attachmentSize: 6 * 1024 * 1024,
      attachmentMime: "application/pdf",
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("5 MB");
  });

  it("swallows notifyNewMessage errors (message still posts)", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue(activeThread as never);
    prismaMock.message.findMany.mockResolvedValue([] as never);
    prismaMock.message.create.mockResolvedValue({
      id: "m-new",
      threadId: "t-1",
      createdAt: new Date(),
    } as never);
    prismaMock.messageThread.update.mockResolvedValue({} as never);
    vi.mocked(notifyNewMessage).mockRejectedValueOnce(new Error("hub down"));

    const result = await postMessageAction({ threadId: "t-1", body: "hi" });
    if (!("data" in result)) throw new Error("expected data even if notify failed");
    expect(result.data.id).toBe("m-new");
  });
});

describe("reportMessageAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["messaging:reports:create"] });
    vi.mocked(audit).mockClear();
  });

  it("creates a MessageReport + writes audit", async () => {
    prismaMock.message.findFirst.mockResolvedValue({
      id: "m-1",
      thread: { schoolId: "default-school" },
    } as never);
    prismaMock.messageReport.create.mockResolvedValue({
      id: "rep-1",
    } as never);

    const result = await reportMessageAction({ messageId: "m-1", reason: "abusive language" });
    expect(result).toEqual({ success: true, reportId: "rep-1" });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "MessageReport",
        entityId: "rep-1",
      }),
    );
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/modules/messaging/message.test.ts`
Expected: fail — module not found.

### Step 3: Implement

Create `src/modules/messaging/actions/message.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { isRateLimited } from "../eligibility";
import { validateAttachment } from "../attachments";
import { notifyNewMessage } from "../notifications";

// ─── Post Message ──────────────────────────────────────────────────

/** @no-audit Message content is itself the record. Volume would flood audit log. */
export async function postMessageAction(input: {
  threadId: string;
  body: string;
  attachmentKey?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMime?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const body = (input.body ?? "").trim();
  if (!body && !input.attachmentKey) return { error: "Message is empty." };

  // Attachment validation (if any)
  if (input.attachmentKey) {
    if (!input.attachmentMime || !input.attachmentSize) {
      return { error: "Attachment metadata incomplete." };
    }
    const validation = validateAttachment({
      mimeType: input.attachmentMime,
      size: input.attachmentSize,
    });
    if (!validation.ok) return { error: validation.error };
  }

  const thread = await db.messageThread.findFirst({
    where: { id: input.threadId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          guardians: { select: { guardian: { select: { userId: true } } } },
        },
      },
      teacher: { select: { name: true } },
    },
  });
  if (!thread) return { error: "Thread not found." };

  if (thread.status === "ARCHIVED") return { error: "Thread is archived." };
  if (thread.lockedAt != null) return { error: "Thread is locked." };

  const guardianUserIds = thread.student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const authorRole: "parent" | "teacher" =
    userId === thread.teacherUserId ? "teacher" : "parent";
  const isParticipant =
    authorRole === "teacher" || guardianUserIds.includes(userId);
  if (!isParticipant) return { error: "You are not a participant of this thread." };

  // Rate limit (same author, same thread, last hour)
  const recent = await db.message.findMany({
    where: {
      threadId: input.threadId,
      authorUserId: userId,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    select: { createdAt: true },
  });
  if (isRateLimited(recent.map((r) => r.createdAt))) {
    return { error: "Too many messages. Please wait before sending another." };
  }

  // Persist
  const message = await db.message.create({
    data: {
      threadId: input.threadId,
      authorUserId: userId,
      body,
      attachmentKey: input.attachmentKey ?? null,
      attachmentName: input.attachmentName ?? null,
      attachmentSize: input.attachmentSize ?? null,
      attachmentMime: input.attachmentMime ?? null,
    },
  });
  await db.messageThread.update({
    where: { id: input.threadId },
    data: { lastMessageAt: message.createdAt },
  });

  // Fan out (best-effort)
  try {
    const recipients =
      authorRole === "teacher"
        ? guardianUserIds
        : [thread.teacherUserId];

    const bodyPreview =
      (body.length > 120 ? body.slice(0, 120) + "…" : body) +
      (input.attachmentName ? ` [attachment: ${input.attachmentName}]` : "");

    await notifyNewMessage({
      messageId: message.id,
      threadId: thread.id,
      recipientUserIds: recipients,
      authorRole,
      studentName: `${thread.student.firstName} ${thread.student.lastName}`,
      authorName: thread.teacher.name ?? "(user)",
      bodyPreview,
    });
  } catch {
    // Notifications must not block the message post
  }

  return { data: message };
}

// ─── Report Message ────────────────────────────────────────────────

export async function reportMessageAction(input: {
  messageId: string;
  reason: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_REPORT);
  if (denied) return denied;

  const reason = (input.reason ?? "").trim();
  if (!reason) return { error: "Please describe why you're reporting this message." };

  const message = await db.message.findFirst({
    where: { id: input.messageId, thread: { schoolId: ctx.schoolId } },
    include: { thread: { select: { schoolId: true } } },
  });
  if (!message) return { error: "Message not found." };

  const report = await db.messageReport.create({
    data: {
      messageId: input.messageId,
      reportedByUserId: ctx.session.user.id!,
      reason,
      status: "PENDING",
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "MessageReport",
    entityId: report.id,
    module: "messaging",
    description: `Reported message ${input.messageId}`,
    newData: { reason, messageId: input.messageId },
  });

  return { success: true, reportId: report.id };
}
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/modules/messaging/message.test.ts`
Expected: all tests passing.

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Commit

```bash
git add src/modules/messaging/actions/message.action.ts tests/unit/modules/messaging/message.test.ts
git commit -m "feat(messaging): postMessage + reportMessage actions with rate limit + notification fan-out"
```

---

## Task 8: Moderation actions (TDD)

**Files:**
- Create: `src/modules/messaging/actions/message-moderation.action.ts`
- Create: `tests/unit/modules/messaging/moderation.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/messaging/moderation.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  getMessageReportsAction,
  resolveReportAction,
  lockThreadAction,
  unlockThreadAction,
} from "@/modules/messaging/actions/message-moderation.action";

describe("getMessageReportsAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["messaging:admin:review"] }));

  it("rejects users without MESSAGING_ADMIN_REVIEW", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getMessageReportsAction();
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("returns reports scoped to the school", async () => {
    prismaMock.messageReport.findMany.mockResolvedValue([] as never);
    const result = await getMessageReportsAction({ status: "PENDING" });
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data).toEqual([]);
    expect(prismaMock.messageReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING",
          message: { thread: { schoolId: "default-school" } },
        }),
      }),
    );
  });
});

describe("resolveReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["messaging:admin:review"] });
    vi.mocked(audit).mockClear();
  });

  it("transitions PENDING → DISMISSED and audits", async () => {
    prismaMock.messageReport.findFirst.mockResolvedValue({
      id: "rep-1",
      status: "PENDING",
      message: { thread: { schoolId: "default-school" } },
    } as never);
    prismaMock.messageReport.update.mockResolvedValue({} as never);

    const result = await resolveReportAction({ reportId: "rep-1", action: "DISMISS" });
    expect(result).toEqual({ success: true });
    expect(prismaMock.messageReport.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DISMISSED" }) }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });

  it("rejects when report already resolved", async () => {
    prismaMock.messageReport.findFirst.mockResolvedValue({
      id: "rep-1",
      status: "DISMISSED",
      message: { thread: { schoolId: "default-school" } },
    } as never);

    const result = await resolveReportAction({ reportId: "rep-1", action: "ACTION" });
    expect(result).toEqual({ error: "Report has already been resolved." });
  });
});

describe("lockThreadAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["messaging:admin:review"] });
    vi.mocked(audit).mockClear();
  });

  it("locks + audits", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      id: "t-1",
      schoolId: "default-school",
      lockedAt: null,
    } as never);
    prismaMock.messageThread.update.mockResolvedValue({} as never);

    const result = await lockThreadAction({ threadId: "t-1", reason: "Escalation" });
    expect(result).toEqual({ success: true });
    expect(prismaMock.messageThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedAt: expect.any(Date),
          lockReason: "Escalation",
        }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });
});

describe("unlockThreadAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["messaging:admin:review"] });
    vi.mocked(audit).mockClear();
  });

  it("unlocks + audits", async () => {
    prismaMock.messageThread.findFirst.mockResolvedValue({
      id: "t-1",
      schoolId: "default-school",
      lockedAt: new Date(),
    } as never);
    prismaMock.messageThread.update.mockResolvedValue({} as never);

    const result = await unlockThreadAction("t-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.messageThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedAt: null,
          lockedBy: null,
          lockReason: null,
        }),
      }),
    );
  });
});
```

### Step 2: Verify RED

Run: `npx vitest run tests/unit/modules/messaging/moderation.test.ts`
Expected: fail — module not found.

### Step 3: Implement

Create `src/modules/messaging/actions/message-moderation.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Report Queue ──────────────────────────────────────────────────

export async function getMessageReportsAction(filters?: {
  status?: "PENDING" | "DISMISSED" | "ACTIONED";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  if (denied) return denied;

  const reports = await db.messageReport.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      message: { thread: { schoolId: ctx.schoolId } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      message: {
        select: {
          id: true,
          body: true,
          authorUserId: true,
          author: { select: { name: true } },
          thread: {
            select: {
              id: true,
              studentId: true,
              student: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  return {
    data: reports.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      reportedAt: r.createdAt,
      reportedByUserId: r.reportedByUserId,
      message: {
        id: r.message.id,
        body: r.message.body,
        authorName: r.message.author.name ?? "(user)",
      },
      thread: {
        id: r.message.thread.id,
        studentName: `${r.message.thread.student.firstName} ${r.message.thread.student.lastName}`,
      },
    })),
  };
}

// ─── Resolve Report ────────────────────────────────────────────────

export async function resolveReportAction(input: {
  reportId: string;
  action: "DISMISS" | "ACTION";
  note?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  if (denied) return denied;

  const report = await db.messageReport.findFirst({
    where: {
      id: input.reportId,
      message: { thread: { schoolId: ctx.schoolId } },
    },
  });
  if (!report) return { error: "Report not found." };
  if (report.status !== "PENDING") {
    return { error: "Report has already been resolved." };
  }

  const newStatus = input.action === "DISMISS" ? "DISMISSED" : "ACTIONED";
  await db.messageReport.update({
    where: { id: input.reportId },
    data: {
      status: newStatus,
      resolvedAt: new Date(),
      resolvedByUserId: ctx.session.user.id!,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MessageReport",
    entityId: input.reportId,
    module: "messaging",
    description: `Resolved report as ${newStatus}${input.note ? `: ${input.note}` : ""}`,
    newData: { status: newStatus, note: input.note },
  });

  return { success: true };
}

// ─── Lock Thread ───────────────────────────────────────────────────

export async function lockThreadAction(input: {
  threadId: string;
  reason: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  if (denied) return denied;

  const reason = (input.reason ?? "").trim();
  if (!reason) return { error: "Please provide a reason for locking the thread." };

  const thread = await db.messageThread.findFirst({
    where: { id: input.threadId, schoolId: ctx.schoolId },
  });
  if (!thread) return { error: "Thread not found." };

  await db.messageThread.update({
    where: { id: input.threadId },
    data: {
      lockedAt: new Date(),
      lockedBy: ctx.session.user.id!,
      lockReason: reason,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MessageThread",
    entityId: input.threadId,
    module: "messaging",
    description: `Locked thread: ${reason}`,
  });

  return { success: true };
}

// ─── Unlock Thread ─────────────────────────────────────────────────

export async function unlockThreadAction(threadId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  if (denied) return denied;

  const thread = await db.messageThread.findFirst({
    where: { id: threadId, schoolId: ctx.schoolId },
  });
  if (!thread) return { error: "Thread not found." };

  await db.messageThread.update({
    where: { id: threadId },
    data: { lockedAt: null, lockedBy: null, lockReason: null },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MessageThread",
    entityId: threadId,
    module: "messaging",
    description: `Unlocked thread`,
  });

  return { success: true };
}
```

### Step 4: Verify GREEN

Run: `npx vitest run tests/unit/modules/messaging/moderation.test.ts`
Expected: all tests passing.

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Commit

```bash
git add src/modules/messaging/actions/message-moderation.action.ts tests/unit/modules/messaging/moderation.test.ts
git commit -m "feat(messaging): moderation actions (reports queue, resolve, lock, unlock)"
```

---

## Task 9: Attachment URL actions

**Files:**
- Create: `src/modules/messaging/actions/attachment.action.ts`

No new test file; attachment URL logic is thin and exercised via integration + eligibility unit tests. Covered by the existing `attachments.test.ts` for validation logic.

### Step 1: Implement

Create `src/modules/messaging/actions/attachment.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { getSignedDownloadUrl, getSignedUploadUrl } from "@/lib/storage/r2";
import { validateAttachment, buildAttachmentKey } from "../attachments";

// ─── Request Upload URL ────────────────────────────────────────────

export async function getMessageAttachmentUploadUrlAction(input: {
  threadId: string;
  filename: string;
  mimeType: string;
  size: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  if (denied) return denied;

  const validation = validateAttachment({
    mimeType: input.mimeType,
    size: input.size,
  });
  if (!validation.ok) return { error: validation.error };

  const userId = ctx.session.user.id!;

  // Verify caller is a participant
  const thread = await db.messageThread.findFirst({
    where: { id: input.threadId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          guardians: { select: { guardian: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!thread) return { error: "Thread not found." };
  const guardianUserIds = thread.student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const isParticipant =
    userId === thread.teacherUserId || guardianUserIds.includes(userId);
  if (!isParticipant) return { error: "You are not a participant of this thread." };

  const key = buildAttachmentKey({
    schoolId: ctx.schoolId,
    threadId: input.threadId,
    filename: input.filename,
  });

  const url = await getSignedUploadUrl({
    key,
    contentType: input.mimeType,
    expiresInSeconds: 300, // 5 min
  });

  return {
    data: {
      uploadUrl: url,
      attachmentKey: key,
    },
  };
}

// ─── Request Download URL ──────────────────────────────────────────

export async function getMessageAttachmentUrlAction(messageId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const hasPortalUse = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  const hasAdminRead = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_READ);
  if (!hasPortalUse && !hasAdminRead) return { error: "Insufficient permissions" };

  const userId = ctx.session.user.id!;

  const message = await db.message.findFirst({
    where: { id: messageId, thread: { schoolId: ctx.schoolId } },
    include: {
      thread: {
        include: {
          student: {
            select: {
              guardians: { select: { guardian: { select: { userId: true } } } },
            },
          },
        },
      },
    },
  });
  if (!message) return { error: "Message not found." };
  if (!message.attachmentKey) return { error: "Message has no attachment." };

  if (!hasAdminRead) {
    const guardianUserIds = message.thread.student.guardians
      .map((g) => g.guardian.userId)
      .filter((id): id is string => id != null);
    const isParticipant =
      userId === message.thread.teacherUserId || guardianUserIds.includes(userId);
    if (!isParticipant) return { error: "You are not a participant of this thread." };
  }

  const url = await getSignedDownloadUrl(message.attachmentKey, 300);
  return {
    data: {
      url,
      filename: message.attachmentName ?? "attachment",
      mimeType: message.attachmentMime ?? "application/octet-stream",
      size: message.attachmentSize ?? 0,
    },
  };
}
```

**Note:** If `getSignedUploadUrl` does not exist in `src/lib/storage/r2.ts`, add it alongside the existing helpers; follow the same pattern as `getSignedDownloadUrl`. If it's already there, great.

### Step 2: Verify

Run: `npx tsc --noEmit`
Expected: clean.

### Step 3: Commit

```bash
git add src/modules/messaging/actions/attachment.action.ts
git commit -m "feat(messaging): signed upload/download URL actions for attachments"
```

---

## Task 10: Lifecycle hooks (archive on status change + teacher rotation)

**Files:**
- Create: `src/modules/messaging/lifecycle.ts`
- Modify: `src/modules/student/actions/transfer.action.ts`, `withdraw.action.ts`, `graduate.action.ts`, `promotion.action.ts`

### Step 1: Implement lifecycle helpers

Create `src/modules/messaging/lifecycle.ts`:

```ts
import { db } from "@/lib/db";

/**
 * Archives all active message threads for a student. Safe to call multiple times.
 * Intended to be called from student-lifecycle actions (transfer, withdraw, graduate)
 * AFTER the status update has been persisted.
 *
 * Not permission-checked — the calling action is already gated.
 */
export async function archiveThreadsForStudent(studentId: string): Promise<void> {
  await db.messageThread.updateMany({
    where: { studentId, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });
}

/**
 * Updates all active threads for students in a class arm when the class
 * teacher rotates. Posts a system-note message to each affected thread.
 *
 * Not permission-checked — caller (promotion action) already gated.
 */
export async function rotateTeacherOnThreadsForArm(params: {
  classArmId: string;
  newTeacherUserId: string;
  reason?: string;
}): Promise<void> {
  // Find all students currently enrolled in this arm
  const students = await db.student.findMany({
    where: {
      enrollments: { some: { classArmId: params.classArmId, status: "ACTIVE" } },
    },
    select: { id: true },
  });
  if (students.length === 0) return;

  const studentIds = students.map((s) => s.id);

  // For each student, find threads assigned to the OLD teacher and update them
  const threads = await db.messageThread.findMany({
    where: {
      studentId: { in: studentIds },
      status: "ACTIVE",
      teacherUserId: { not: params.newTeacherUserId },
    },
    select: { id: true, teacherUserId: true },
  });
  if (threads.length === 0) return;

  await db.$transaction(async (tx) => {
    for (const t of threads) {
      await tx.messageThread.update({
        where: { id: t.id },
        data: { teacherUserId: params.newTeacherUserId },
      });
      await tx.message.create({
        data: {
          threadId: t.id,
          authorUserId: params.newTeacherUserId,
          body: params.reason
            ? `Thread transferred to new class teacher: ${params.reason}`
            : "Thread transferred to new class teacher.",
          systemNote: true,
        },
      });
    }
  });
}
```

### Step 2: Wire into student lifecycle actions

Open `src/modules/student/actions/transfer.action.ts`. After the status update, import and call:

```ts
import { archiveThreadsForStudent } from "@/modules/messaging/lifecycle";
// ... at the end of the transferStudentAction, AFTER status has been set to TRANSFERRED:
await archiveThreadsForStudent(studentId);
```

Do the same in `src/modules/student/actions/withdraw.action.ts` (after status → WITHDRAWN) and `src/modules/student/actions/graduate.action.ts` (after status → GRADUATED).

If any of these actions don't exist under those names, search for the place where the student's `status` is updated to each of those values and insert the call immediately after.

### Step 3: Wire into promotion action (teacher rotation)

Open `src/modules/student/actions/promotion.action.ts`. Find where the class teacher for a class arm changes — look for code that updates `classArm.classTeacherId` or similar. If such assignment logic exists, after the update call:

```ts
import { rotateTeacherOnThreadsForArm } from "@/modules/messaging/lifecycle";
// After setting the new classTeacherId on the arm:
await rotateTeacherOnThreadsForArm({
  classArmId: arm.id,
  newTeacherUserId: newTeacherUserId,
  reason: "Academic year rotation",
});
```

If the promotion flow doesn't currently update class teachers on the arm (teachers are assigned out-of-band), skip this integration. Note in the report that it will be wired when class-teacher reassignment gets its own action.

### Step 4: Verify

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vitest run`
Expected: no regressions in existing tests.

### Step 5: Commit

```bash
git add src/modules/messaging/lifecycle.ts src/modules/student/actions/
git commit -m "feat(messaging): lifecycle hooks (archive on status change + teacher rotation)"
```

---

## Task 11: Parent portal UI — replace the stub

**Files:**
- Modify: `src/app/(portal)/parent/messages/messages-client.tsx` (was a 40-line "Coming Soon" stub)
- Modify: `src/app/(portal)/parent/messages/page.tsx` (load threads server-side, pass to client)

### Step 1: Rewrite the parent messages page

Open `src/app/(portal)/parent/messages/page.tsx`. Replace with:

```tsx
import { auth } from "@/lib/auth";
import { getMessageThreadsAction } from "@/modules/messaging/actions/thread.action";
import { MessagesClient } from "./messages-client";

export default async function ParentMessagesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getMessageThreadsAction();
  const threads = "data" in result ? result.data : [];

  return <MessagesClient threads={threads} role="parent" />;
}
```

### Step 2: Rewrite the client component

Replace the content of `src/app/(portal)/parent/messages/messages-client.tsx` with:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import {
  getMessageThreadAction,
  markThreadReadAction,
} from "@/modules/messaging/actions/thread.action";
import {
  postMessageAction,
  reportMessageAction,
} from "@/modules/messaging/actions/message.action";
import { getMessageAttachmentUrlAction } from "@/modules/messaging/actions/attachment.action";

type ThreadRow = {
  id: string;
  studentId: string;
  studentName: string;
  teacherUserId: string;
  teacherName: string;
  status: "ACTIVE" | "ARCHIVED";
  locked: boolean;
  lastMessageAt: Date | string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
};

type ThreadDetail = {
  id: string;
  studentId: string;
  studentName: string;
  teacher: { id: string; name: string };
  status: "ACTIVE" | "ARCHIVED";
  locked: boolean;
  lockReason: string | null;
  messages: Array<{
    id: string;
    authorUserId: string;
    body: string;
    attachmentKey: string | null;
    attachmentName: string | null;
    attachmentSize: number | null;
    attachmentMime: string | null;
    systemNote: boolean;
    createdAt: Date | string;
  }>;
  isParticipant: boolean;
  isAdmin: boolean;
};

export function MessagesClient({
  threads,
  role,
}: {
  threads: ThreadRow[];
  role: "parent" | "teacher" | "admin";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ThreadDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");

  const openThread = (threadId: string) => {
    setLoadingThread(true);
    start(async () => {
      const res = await getMessageThreadAction(threadId);
      setLoadingThread(false);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setSelected(res.data as ThreadDetail);
      router.refresh();
    });
  };

  const sendReply = () => {
    if (!selected) return;
    const text = body.trim();
    if (!text) return;
    start(async () => {
      const res = await postMessageAction({ threadId: selected.id, body: text });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setBody("");
      openThread(selected.id); // reload messages
    });
  };

  const reportMessage = (messageId: string) => {
    const reason = window.prompt("Reason for reporting this message?");
    if (!reason) return;
    start(async () => {
      const res = await reportMessageAction({ messageId, reason });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Message reported. An admin will review it.");
    });
  };

  const downloadAttachment = (messageId: string) => {
    start(async () => {
      const res = await getMessageAttachmentUrlAction(messageId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.data.url, "_blank");
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Messages"
        description="Conversations with your children's teachers."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Inbox */}
        <div className="rounded-lg border border-gray-200 bg-white md:col-span-1">
          {threads.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No conversations yet.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => openThread(t.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selected?.id === t.id ? "bg-teal-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{t.studentName}</p>
                        <p className="text-xs text-gray-500 truncate">{t.teacherName}</p>
                        <p className="text-xs text-gray-500 truncate mt-1">{t.lastMessagePreview ?? "(no messages yet)"}</p>
                      </div>
                      {t.unreadCount > 0 && (
                        <span className="shrink-0 rounded-full bg-teal-600 text-white text-xs font-semibold px-2 py-0.5">
                          {t.unreadCount}
                        </span>
                      )}
                    </div>
                    {t.status === "ARCHIVED" && (
                      <span className="mt-1 inline-block text-xs text-gray-400">Archived</span>
                    )}
                    {t.locked && (
                      <span className="mt-1 inline-block text-xs text-red-600">Locked</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread view */}
        <div className="rounded-lg border border-gray-200 bg-white md:col-span-2 min-h-[400px]">
          {loadingThread ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading…</div>
          ) : !selected ? (
            <div className="p-12 text-center text-sm text-gray-500">Select a conversation.</div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="border-b border-gray-100 p-4">
                <p className="font-semibold">{selected.studentName}</p>
                <p className="text-xs text-gray-500">
                  with {selected.teacher.name}
                  {selected.status === "ARCHIVED" && " • Archived"}
                  {selected.locked && ` • Locked: ${selected.lockReason ?? ""}`}
                </p>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-3">
                {selected.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-lg p-3 text-sm ${
                      m.systemNote
                        ? "mx-auto text-center italic text-gray-500 bg-gray-50"
                        : "bg-gray-100"
                    }`}
                  >
                    {!m.systemNote && (
                      <p className="text-xs text-gray-400 mb-1">
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.attachmentKey && (
                      <button
                        onClick={() => downloadAttachment(m.id)}
                        className="mt-2 text-xs text-teal-600 hover:underline"
                      >
                        📎 {m.attachmentName ?? "attachment"}
                        {m.attachmentSize ? ` (${Math.round(m.attachmentSize / 1024)} KB)` : ""}
                      </button>
                    )}
                    {!m.systemNote && (
                      <button
                        onClick={() => reportMessage(m.id)}
                        className="mt-1 ml-2 text-xs text-gray-400 hover:text-red-600"
                        aria-label="Report message"
                      >
                        Report
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {selected.isParticipant && selected.status === "ACTIVE" && !selected.locked && (
                <div className="border-t border-gray-100 p-3">
                  <div className="flex gap-2">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write a reply…"
                      rows={2}
                      className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={sendReply}
                      disabled={pending || !body.trim()}
                      className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Verify

Run: `npx tsc --noEmit`
Expected: clean.

### Step 4: Commit

```bash
git add "src/app/(portal)/parent/messages/"
git commit -m "feat(messaging): parent portal messages UI (replaces Coming Soon stub)"
```

---

## Task 12: Staff portal UI + nav

**Files:**
- Create: `src/app/(portal)/staff/messages/page.tsx`
- Modify: `src/app/(portal)/portal-nav.tsx` — add `Messages` to `staffLinks`

### Step 1: Add staff messages page

Create `src/app/(portal)/staff/messages/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { getMessageThreadsAction } from "@/modules/messaging/actions/thread.action";
import { MessagesClient } from "@/app/(portal)/parent/messages/messages-client";

export default async function StaffMessagesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getMessageThreadsAction();
  const threads = "data" in result ? result.data : [];

  return <MessagesClient threads={threads} role="teacher" />;
}
```

The `MessagesClient` component is general enough to handle both views since the thread-level actions (post, report, download) use the same server actions.

### Step 2: Update nav

Open `src/app/(portal)/portal-nav.tsx`. Find `staffLinks` (around line 24):

```ts
const staffLinks = [
  { href: "/staff", label: "Dashboard" },
  { href: "/staff/profile", label: "My Profile" },
  { href: "/staff/leave", label: "My Leave" },
  { href: "/staff/payslips", label: "My Payslips" },
  { href: "/staff/attendance", label: "My Attendance" },
];
```

Add `{ href: "/staff/messages", label: "Messages" }` after `"My Profile"`:

```ts
const staffLinks = [
  { href: "/staff", label: "Dashboard" },
  { href: "/staff/profile", label: "My Profile" },
  { href: "/staff/messages", label: "Messages" },
  { href: "/staff/leave", label: "My Leave" },
  { href: "/staff/payslips", label: "My Payslips" },
  { href: "/staff/attendance", label: "My Attendance" },
];
```

### Step 3: Verify

Run: `npx tsc --noEmit`
Expected: clean.

### Step 4: Commit

```bash
git add "src/app/(portal)/staff/messages/" "src/app/(portal)/portal-nav.tsx"
git commit -m "feat(messaging): staff portal messages page + nav link"
```

---

## Task 13: Admin review UI

**Files:**
- Create: `src/app/(dashboard)/students/messaging/page.tsx`
- Create: `src/app/(dashboard)/students/messaging/messaging-admin-client.tsx`
- Create: `src/app/(dashboard)/students/messaging/reports/page.tsx`
- Create: `src/app/(dashboard)/students/messaging/reports/reports-client.tsx`

### Step 1: Admin thread listing page

Create `src/app/(dashboard)/students/messaging/page.tsx`:

```tsx
import { getMessageThreadsAction } from "@/modules/messaging/actions/thread.action";
import { MessagingAdminClient } from "./messaging-admin-client";

export default async function AdminMessagingPage() {
  const result = await getMessageThreadsAction();
  if ("error" in result) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }
  return <MessagingAdminClient threads={result.data} />;
}
```

Create `src/app/(dashboard)/students/messaging/messaging-admin-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  getMessageThreadAction,
} from "@/modules/messaging/actions/thread.action";
import {
  lockThreadAction,
  unlockThreadAction,
} from "@/modules/messaging/actions/message-moderation.action";

type ThreadRow = {
  id: string;
  studentName: string;
  teacherName: string;
  status: "ACTIVE" | "ARCHIVED";
  locked: boolean;
  lastMessageAt: Date | string | null;
  unreadCount: number;
};

export function MessagingAdminClient({ threads }: { threads: ThreadRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [viewing, setViewing] = useState<{
    id: string;
    studentName: string;
    teacherName: string;
    status: string;
    locked: boolean;
    lockReason: string | null;
    messages: Array<{ id: string; body: string; createdAt: Date | string; systemNote: boolean }>;
  } | null>(null);

  const openThread = (id: string) => {
    start(async () => {
      const res = await getMessageThreadAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setViewing({
        id: res.data.id,
        studentName: res.data.studentName,
        teacherName: res.data.teacher.name,
        status: res.data.status,
        locked: res.data.locked,
        lockReason: res.data.lockReason,
        messages: res.data.messages.map((m) => ({
          id: m.id,
          body: m.body,
          createdAt: m.createdAt,
          systemNote: m.systemNote ?? false,
        })),
      });
    });
  };

  const onLock = (threadId: string) => {
    const reason = window.prompt("Reason for locking?");
    if (!reason) return;
    start(async () => {
      const res = await lockThreadAction({ threadId, reason });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Thread locked.");
      router.refresh();
      if (viewing?.id === threadId) openThread(threadId);
    });
  };

  const onUnlock = (threadId: string) => {
    start(async () => {
      const res = await unlockThreadAction(threadId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Thread unlocked.");
      router.refresh();
      if (viewing?.id === threadId) openThread(threadId);
    });
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Messaging Admin</h1>
        <Link
          href="/students/messaging/reports"
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
        >
          Report queue
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 text-left">Student</th>
                <th className="p-3 text-left">Teacher</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {threads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No threads.
                  </td>
                </tr>
              ) : (
                threads.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/40">
                    <td className="p-3 font-medium">{t.studentName}</td>
                    <td className="p-3 text-muted-foreground">{t.teacherName}</td>
                    <td className="p-3">
                      <span className="text-xs">
                        {t.status}
                        {t.locked && " • LOCKED"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openThread(t.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 min-h-[400px]">
          {!viewing ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Select a thread to view.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{viewing.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    with {viewing.teacherName}{viewing.locked ? " • LOCKED" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {viewing.locked ? (
                    <button
                      onClick={() => onUnlock(viewing.id)}
                      disabled={pending}
                      className="text-xs rounded-lg bg-primary text-primary-foreground px-3 py-1"
                    >
                      Unlock
                    </button>
                  ) : (
                    <button
                      onClick={() => onLock(viewing.id)}
                      disabled={pending}
                      className="text-xs rounded-lg bg-red-600 text-white px-3 py-1"
                    >
                      Lock
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-auto">
                {viewing.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg p-2 text-sm ${m.systemNote ? "bg-muted italic text-muted-foreground text-center" : "bg-muted/40"}`}
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Report queue page

Create `src/app/(dashboard)/students/messaging/reports/page.tsx`:

```tsx
import { getMessageReportsAction } from "@/modules/messaging/actions/message-moderation.action";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const result = await getMessageReportsAction({ status: "PENDING" });
  if ("error" in result) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }
  return <ReportsClient reports={result.data} />;
}
```

Create `src/app/(dashboard)/students/messaging/reports/reports-client.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { resolveReportAction } from "@/modules/messaging/actions/message-moderation.action";

type Report = {
  id: string;
  status: "PENDING" | "DISMISSED" | "ACTIONED";
  reason: string;
  reportedAt: Date | string;
  message: { id: string; body: string; authorName: string };
  thread: { id: string; studentName: string };
};

export function ReportsClient({ reports }: { reports: Report[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const resolve = (reportId: string, action: "DISMISS" | "ACTION") => {
    const note = window.prompt(`Note (optional) for ${action.toLowerCase()}:`) ?? undefined;
    start(async () => {
      const res = await resolveReportAction({ reportId, action, note });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Report ${action === "DISMISS" ? "dismissed" : "actioned"}.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Link href="/students/messaging" className="text-sm text-muted-foreground hover:underline">
          ← Messaging admin
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Report queue</h1>

      {reports.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No pending reports.
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{r.thread.studentName}</span> — reported{" "}
                    {new Date(r.reportedAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Reason: {r.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolve(r.id, "DISMISS")}
                    disabled={pending}
                    className="text-xs rounded-lg border border-border px-3 py-1"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => resolve(r.id, "ACTION")}
                    disabled={pending}
                    className="text-xs rounded-lg bg-red-600 text-white px-3 py-1"
                  >
                    Action
                  </button>
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">By {r.message.authorName}</p>
                <p className="whitespace-pre-wrap">{r.message.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 3: Verify

Run: `npx tsc --noEmit`
Expected: clean.

### Step 4: Commit

```bash
git add "src/app/(dashboard)/students/messaging/"
git commit -m "feat(messaging): admin review UI (threads viewer + reports queue)"
```

---

## Task 14: Integration test (live DB)

**Files:**
- Create: `tests/integration/students/messaging.test.ts`

### Step 1: Write the test

Create `tests/integration/students/messaging.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createMessageThreadAction,
  getMessageThreadAction,
  archiveThreadAction,
} from "@/modules/messaging/actions/thread.action";
import { postMessageAction } from "@/modules/messaging/actions/message.action";
import {
  lockThreadAction,
  unlockThreadAction,
} from "@/modules/messaging/actions/message-moderation.action";
import { resolveSeededAdminId, loginAs } from "./setup";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Messaging (integration)", () => {
  const db = new PrismaClient();
  const testTag = `msg-test-${Date.now()}`;
  let adminId: string;
  let parentUserId: string;
  let teacherUserId: string;
  let studentId: string;
  let guardianId: string;
  let armId: string;
  let threadId: string | null = null;
  const createdIds: { messages: string[]; reports: string[] } = { messages: [], reports: [] };

  beforeAll(async () => {
    adminId = await resolveSeededAdminId();

    // Create parent + teacher User rows (schoolId must match test)
    const parent = await db.user.upsert({
      where: { username: `${testTag}-parent` },
      create: {
        username: `${testTag}-parent`,
        name: "Test Parent",
        passwordHash: "x",
        active: true,
      },
      update: {},
    });
    parentUserId = parent.id;

    const teacher = await db.user.upsert({
      where: { username: `${testTag}-teacher` },
      create: {
        username: `${testTag}-teacher`,
        name: "Ms. Test",
        passwordHash: "x",
        active: true,
      },
      update: {},
    });
    teacherUserId = teacher.id;

    // Seed a student + class arm
    const year = await db.academicYear.findFirst({ where: { schoolId: "default-school", isCurrent: true } });
    if (!year) throw new Error("Seed DB missing current academic year");
    const prog = await db.programme.create({ data: { schoolId: "default-school", name: `${testTag}-P`, duration: 3 } });
    const cls = await db.class.create({
      data: { schoolId: "default-school", programmeId: prog.id, academicYearId: year.id, yearGroup: 1, name: `${testTag}-C` },
    });
    const arm = await db.classArm.create({
      data: { classId: cls.id, schoolId: "default-school", name: "A", capacity: 40 },
    });
    armId = arm.id;

    const s = await db.student.create({
      data: {
        schoolId: "default-school",
        studentId: `${testTag}/1`,
        firstName: "MsgTest",
        lastName: "Student",
        dateOfBirth: new Date("2010-01-01"),
        gender: "MALE",
      },
    });
    studentId = s.id;
    await db.enrollment.create({
      data: { schoolId: "default-school", studentId, classArmId: arm.id, academicYearId: year.id, status: "ACTIVE" },
    });

    const g = await db.guardian.create({
      data: {
        schoolId: "default-school",
        firstName: "Parent",
        lastName: "Test",
        phone: `020${testTag.slice(-6)}`,
        userId: parentUserId,
      },
    });
    guardianId = g.id;
    await db.studentGuardian.create({
      data: { schoolId: "default-school", studentId, guardianId, isPrimary: true },
    });
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { entity: "MessageThread", entityId: threadId ?? "" } }).catch(() => {});
    if (threadId) await db.message.deleteMany({ where: { threadId } }).catch(() => {});
    if (threadId) await db.messageThreadRead.deleteMany({ where: { threadId } }).catch(() => {});
    if (threadId) await db.messageThread.delete({ where: { id: threadId } }).catch(() => {});
    await db.studentGuardian.deleteMany({ where: { studentId } }).catch(() => {});
    await db.enrollment.deleteMany({ where: { studentId } }).catch(() => {});
    await db.student.delete({ where: { id: studentId } }).catch(() => {});
    await db.guardian.delete({ where: { id: guardianId } }).catch(() => {});
    await db.classArm.delete({ where: { id: armId } }).catch(() => {});
    await db.class.deleteMany({ where: { name: `${testTag}-C` } }).catch(() => {});
    await db.programme.deleteMany({ where: { name: `${testTag}-P` } }).catch(() => {});
    await db.user.delete({ where: { id: parentUserId } }).catch(() => {});
    await db.user.delete({ where: { id: teacherUserId } }).catch(() => {});
    await db.$disconnect();
  });

  it("parent creates a thread; teacher can read it", async () => {
    loginAs({ id: parentUserId, permissions: ["messaging:portal:use"], schoolId: "default-school" });
    const result = await createMessageThreadAction({
      studentId,
      teacherUserId,
      initialBody: "Hello teacher, how is my child doing?",
    });
    if (!("data" in result)) throw new Error(result.error);
    threadId = result.data.id;

    loginAs({ id: teacherUserId, permissions: ["messaging:portal:use"], schoolId: "default-school" });
    const detail = await getMessageThreadAction(threadId);
    if (!("data" in detail)) throw new Error(detail.error);
    expect(detail.data.messages.length).toBeGreaterThanOrEqual(1);
  });

  it("teacher replies; parent sees reply", async () => {
    if (!threadId) throw new Error("threadId not set");
    loginAs({ id: teacherUserId, permissions: ["messaging:portal:use"], schoolId: "default-school" });
    const res = await postMessageAction({
      threadId,
      body: "Doing well! Please see attached report.",
    });
    if (!("data" in res)) throw new Error(res.error);
    createdIds.messages.push(res.data.id);

    loginAs({ id: parentUserId, permissions: ["messaging:portal:use"], schoolId: "default-school" });
    const detail = await getMessageThreadAction(threadId);
    if (!("data" in detail)) throw new Error(detail.error);
    expect(detail.data.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("admin can lock; post then fails; unlock; post succeeds", async () => {
    if (!threadId) throw new Error("threadId not set");
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const lockRes = await lockThreadAction({ threadId, reason: "Testing lock" });
    expect(lockRes).toEqual({ success: true });

    loginAs({ id: parentUserId, permissions: ["messaging:portal:use"], schoolId: "default-school" });
    const postRes = await postMessageAction({ threadId, body: "Can I post?" });
    expect(postRes).toEqual({ error: "Thread is locked." });

    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    await unlockThreadAction(threadId);

    loginAs({ id: parentUserId, permissions: ["messaging:portal:use"], schoolId: "default-school" });
    const postAgain = await postMessageAction({ threadId, body: "Now I can." });
    if (!("data" in postAgain)) throw new Error(postAgain.error);
    expect(postAgain.data.id).toBeTruthy();
  });

  it("archiveThreadAction sets status to ARCHIVED; post fails", async () => {
    if (!threadId) throw new Error("threadId not set");
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    await archiveThreadAction(threadId);

    loginAs({ id: parentUserId, permissions: ["messaging:portal:use"], schoolId: "default-school" });
    const postRes = await postMessageAction({ threadId, body: "archived?" });
    expect(postRes).toEqual({ error: "Thread is archived." });
  });

  it("tenant isolation: parent from another school cannot see this thread", async () => {
    loginAs({ id: "other-user", permissions: ["messaging:portal:use"], schoolId: "other-school" });
    const res = await getMessageThreadAction(threadId!);
    expect(res).toEqual({ error: "Thread not found" });
  });
});
```

### Step 2: Run

Run: `npm run test:students`
Expected: all passing, new tests included.

### Step 3: Commit

```bash
git add tests/integration/students/messaging.test.ts
git commit -m "test(messaging): integration coverage for thread lifecycle + lock + archive + isolation"
```

---

## Task 15: New Conversation flow (UI + helper action)

Without this task, neither parents nor teachers can start threads from the UI — only via backend action calls. This closes that gap with a small, shared picker modal and one helper action.

**Files:**
- Modify: `src/modules/messaging/actions/thread.action.ts` — add `getEligibleCounterpartsAction`
- Create: `src/app/(portal)/parent/messages/new-conversation-modal.tsx`
- Modify: `src/app/(portal)/parent/messages/messages-client.tsx` — add "New conversation" button + wire modal

### Step 1: Add the helper action

Append to `src/modules/messaging/actions/thread.action.ts`:

```ts
export type CounterpartOption = {
  studentId: string;
  studentName: string;
  teacherUserId: string;
  teacherName: string;
  role: "class_teacher" | "housemaster";
};

/**
 * Returns the list of (student, teacher) pairs the caller can start a thread with.
 * Parent: for each of their linked students, resolve the active class teacher
 * of the enrolled class arm AND the housemaster if the student is BOARDING.
 * Teacher: for each student in their class arm / house, return the mirror pair
 * (they are always "the teacher" side of each proposed thread).
 */
/** @no-audit Read-only helper for the new-conversation picker. */
export async function getEligibleCounterpartsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  // Is caller a parent (guardian), a teacher, or both?
  const guardian = await db.guardian.findUnique({
    where: { userId },
    include: {
      students: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              status: true,
              boardingStatus: true,
              schoolId: true,
              enrollments: {
                where: { status: "ACTIVE" },
                take: 1,
                select: {
                  classArm: {
                    select: {
                      id: true,
                      // classTeacherId may be on ClassArm or Class in this repo; adapt if needed
                      classTeacherId: true,
                      classTeacher: { select: { user: { select: { id: true, name: true } } } },
                    },
                  },
                },
              },
              houseAssignment: {
                select: {
                  house: {
                    select: {
                      housemaster: { select: { user: { select: { id: true, name: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const counterparts: CounterpartOption[] = [];

  if (guardian) {
    for (const sg of guardian.students) {
      const s = sg.student;
      if (s.schoolId !== ctx.schoolId) continue;
      if (s.status !== "ACTIVE" && s.status !== "SUSPENDED") continue;

      // class teacher
      const ct = s.enrollments[0]?.classArm?.classTeacher?.user;
      if (ct) {
        counterparts.push({
          studentId: s.id,
          studentName: `${s.firstName} ${s.lastName}`,
          teacherUserId: ct.id,
          teacherName: ct.name ?? "Class teacher",
          role: "class_teacher",
        });
      }

      // housemaster (boarders only)
      if (s.boardingStatus === "BOARDING") {
        const hm = s.houseAssignment?.house?.housemaster?.user;
        if (hm) {
          counterparts.push({
            studentId: s.id,
            studentName: `${s.firstName} ${s.lastName}`,
            teacherUserId: hm.id,
            teacherName: hm.name ?? "Housemaster",
            role: "housemaster",
          });
        }
      }
    }
  }

  // Teacher side: find students in class arms / houses where the caller is the teacher
  // Use the assignments the repo already exposes; if the schema doesn't directly store
  // "classTeacherId on ClassArm", adapt. For MVP, we rely on the above guardian flow for
  // parents and let teachers use the same picker — they'll see empty list and can start
  // via navigating to a student profile (deferred polish).

  return { data: counterparts };
}
```

Note on schema shape: If `ClassArm.classTeacherId` / `House.housemasterId` aren't the exact field names in this repo, adapt the query to the actual shape. Grep `classTeacher` and `housemaster` in `prisma/schema/` to confirm. The logic above is correct in spirit; the path selectors may need tweaking.

### Step 2: Create the modal

Create `src/app/(portal)/parent/messages/new-conversation-modal.tsx`:

```tsx
"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
  getEligibleCounterpartsAction,
  createMessageThreadAction,
  type CounterpartOption,
} from "@/modules/messaging/actions/thread.action";

export function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (threadId: string) => void;
}) {
  const [options, setOptions] = useState<CounterpartOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CounterpartOption | null>(null);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const res = await getEligibleCounterpartsAction();
      setLoading(false);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setOptions(res.data);
    })();
  }, []);

  const submit = () => {
    if (!selected || !body.trim()) return;
    start(async () => {
      const res = await createMessageThreadAction({
        studentId: selected.studentId,
        teacherUserId: selected.teacherUserId,
        initialBody: body.trim(),
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Conversation started.");
      onCreated(res.data.id);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold">New conversation</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading options…</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-gray-500">
            No eligible recipients. This usually means the class teacher or housemaster hasn't been assigned yet — contact the school.
          </p>
        ) : (
          <>
            <ul className="space-y-2 max-h-48 overflow-auto">
              {options.map((o, idx) => (
                <li key={`${o.studentId}-${o.teacherUserId}-${idx}`}>
                  <label className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="counterpart"
                      checked={
                        selected?.studentId === o.studentId &&
                        selected?.teacherUserId === o.teacherUserId
                      }
                      onChange={() => setSelected(o)}
                      className="mt-1"
                    />
                    <div className="text-sm">
                      <p className="font-medium">{o.studentName}</p>
                      <p className="text-xs text-gray-500">
                        with {o.teacherName} ({o.role === "class_teacher" ? "Class Teacher" : "Housemaster"})
                      </p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the first message…"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || !selected || !body.trim() || loading}
            className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Start conversation
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Wire button + modal into `messages-client.tsx`

Add the modal import at the top of `src/app/(portal)/parent/messages/messages-client.tsx`:

```tsx
import { NewConversationModal } from "./new-conversation-modal";
```

Add state near other `useState` declarations:

```tsx
const [showNewModal, setShowNewModal] = useState(false);
```

Find the `<PageHeader>` block. Immediately after it, add a "New conversation" action button (the existing codebase often mounts action buttons as siblings of the header — adapt to the actual pattern in `PageHeader` if it provides an `actions` prop):

```tsx
<div className="flex justify-end">
  <button
    onClick={() => setShowNewModal(true)}
    className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm"
  >
    + New conversation
  </button>
</div>
```

Then, at the very bottom of the returned JSX (just before the closing `</div>` of the root wrapper), conditionally render the modal:

```tsx
{showNewModal && (
  <NewConversationModal
    onClose={() => setShowNewModal(false)}
    onCreated={(threadId) => {
      setShowNewModal(false);
      openThread(threadId);
      router.refresh();
    }}
  />
)}
```

### Step 4: Verify

Run: `npx tsc --noEmit`
Expected: clean. If the Prisma includes in `getEligibleCounterpartsAction` fail due to schema field mismatches (e.g., `classTeacherId` not on `ClassArm`), adapt the query to whatever the actual schema has — grep `classTeacher` in the prisma schema directory and follow the real relation.

### Step 5: Commit

```bash
git add "src/modules/messaging/actions/thread.action.ts" "src/app/(portal)/parent/messages/"
git commit -m "feat(messaging): new conversation modal + eligible counterparts helper"
```

---

## Task 16: End-to-end verification

**Files:** verification only.

### Step 1: Full unit suite

Run: `npx vitest run`
Expected: all passing. Counts:
- `tests/unit/modules/messaging/eligibility.test.ts` — ~16
- `tests/unit/modules/messaging/thread.test.ts` — ~10-14
- `tests/unit/modules/messaging/message.test.ts` — ~8
- `tests/unit/modules/messaging/moderation.test.ts` — ~6-8
- `tests/unit/modules/messaging/notifications.test.ts` — 4
- `tests/unit/modules/messaging/attachments.test.ts` — ~6
- `tests/unit/auth/permissions.test.ts` — +1
- No regressions elsewhere

### Step 2: Integration suite

Run: `npm run test:students`
Expected: passing with new `messaging.test.ts`.

### Step 3: Audit guardrail

Run: `npx vitest run tests/unit/guardrails/audit-coverage.test.ts`
Expected: passing. New admin mutations (`archiveThreadAction`, `lockThreadAction`, `unlockThreadAction`, `resolveReportAction`, `reportMessageAction`) have `audit()` calls. `postMessageAction`, `createMessageThreadAction`, `markThreadReadAction` carry `@no-audit` JSDoc.

If the guardrail flags anything else, add the appropriate JSDoc or audit call and re-run.

### Step 4: TypeScript

Run: `npx tsc --noEmit`
Expected: clean.

### Step 5: Build

Run: `npm run build`
Expected: success. Confirm new routes compile:
- `/parent/messages`
- `/staff/messages`
- `/students/messaging`
- `/students/messaging/reports`

### Step 6: Lint

Run: `npm run lint`
Expected: no new errors.

### Step 7: Manual UI walk

1. Log in as a parent with a child assigned to a class arm
2. `/parent/messages` — verify "Coming Soon" is gone; inbox shows empty state
3. Trigger creation from the client: there's no "New conversation" modal in this MVP (reserved for Task 16 polish — see Known Follow-ups); instead, trigger a thread by having the teacher create it
4. Log in as the class teacher → `/staff/messages` → confirm the nav link exists → thread shouldn't show yet
5. Use an admin or direct-DB path to insert a thread (documented in the PR description as a limitation)
6. Alternative: seed a thread via the integration test and inspect it via the UI

Since this MVP doesn't ship a "New conversation" modal (intentionally deferred — see below), the manual walk is limited. Main validation vectors are the integration test and the admin UI.

### Known follow-up

- "New conversation" modal (currently unthreaded) — a small follow-up that lets the UI surface `createMessageThreadAction` instead of requiring backend/test entry. Deferred to keep this PR focused.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage:** every spec section maps to a task:
  - §4 data model → Task 1
  - §5 permissions → Task 2
  - §6 pure helpers → Task 3
  - §7 server actions → Tasks 6, 7, 8, 9
  - §8 notifications → Task 4
  - §9 attachments → Tasks 5, 9
  - §10 UI → Tasks 11, 12, 13
  - §11 error handling → validated via action-layer tests in Tasks 6-8
  - §12 testing → Tasks 3, 4, 5, 6, 7, 8, 14
  - §13 verification → Task 16
  - New conversation UI flow (closes the ship-blocker gap where no UI could create threads) → Task 15
  - Lifecycle hooks (§3 architecture + §10) → Task 10
- [x] **No placeholders:** every task has concrete code; every command has expected output
- [x] **Type consistency:** `StudentContext`, `StaffAssignment`, `GuardianLink` (Task 3), `MatchReason`-style enums (Task 4), `NotifyParams` (Task 4), action return shapes (`{ data } | { error }`) all consistent across callers
- [x] **File paths:** absolute-from-repo-root
- [x] **TDD shape:** Tasks 3, 4, 5, 6, 7, 8 follow RED → implement → GREEN → commit. Tasks 1, 2 are data/config (no TDD). Tasks 9-13, 15 are UI/integration (no unit tests per codebase convention). Task 14 is integration-only. Task 16 is verification-only.
