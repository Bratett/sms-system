# Alumni Events + RSVPs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add alumni-event lifecycle (DRAFT → PUBLISHED → CANCELED) with publish-time fan-out notification and per-event RSVPs (yes/no/maybe + guest count + soft-capacity waitlist).

**Architecture:** Two new Prisma models (`AlumniEvent`, `AlumniEventRsvp`) co-located with `AlumniProfile` in `prisma/schema/communication.prisma`. New `src/modules/alumni-events/` sub-module with admin actions, alumni-side actions, and a notification fan-out helper that mirrors `release-notifications.ts` from PR #29. New admin surface at `/graduation/alumni-events`; new alumni surface at `/alumni/events`.

**Tech Stack:** Next.js 15 App Router, Prisma 6.x on PostgreSQL, vitest + vitest-mock-extended, zod, sonner. Reuses sub-project A's `assertAlumnusAccess` helper for defense-in-depth alumnus gating.

**Spec reference:** `docs/superpowers/specs/2026-04-29-alumni-events-design.md`

**Branch base:** `feat/alumni-events` (off `feat/alumni-foundation`).

---

## File Structure

**Created:**
- `prisma/schema/migrations/<timestamp>_add_alumni_events/migration.sql`
- `src/modules/alumni-events/events-notifications.ts`
- `src/modules/alumni-events/schemas/event.schema.ts`
- `src/modules/alumni-events/actions/admin-events.action.ts`
- `src/modules/alumni-events/actions/alumni-events.action.ts`
- `src/app/(dashboard)/graduation/alumni-events/page.tsx` + `events-list-client.tsx`
- `src/app/(dashboard)/graduation/alumni-events/[id]/page.tsx` + `event-detail-client.tsx`
- `src/app/(dashboard)/graduation/alumni-events/event-form-modal.tsx`
- `src/app/(portal)/alumni/events/page.tsx` + `events-list-client.tsx`
- `src/app/(portal)/alumni/events/[eventId]/page.tsx` + `event-detail-client.tsx`
- `tests/unit/modules/alumni-events/admin-events.test.ts`
- `tests/unit/modules/alumni-events/alumni-events.test.ts`
- `tests/unit/modules/alumni-events/events-notifications.test.ts`
- `tests/integration/students/alumni-events.test.ts`

**Modified:**
- `prisma/schema/communication.prisma` — append `AlumniEvent`, `AlumniEventRsvp`, 2 enums, back-relations on existing models
- `prisma/schema/auth.prisma` — `User.createdAlumniEvents` back-relation
- `prisma/schema/school.prisma` — `School.alumniEvents` back-relation
- `src/lib/permissions.ts` — 2 new permission constants + alumni role bundle update
- `prisma/seed/index.ts` — same additions
- `src/lib/notifications/events.ts` — register `ALUMNI_EVENT_PUBLISHED` + EVENT_CHANNELS entry
- `src/lib/navigation.ts` — admin sidebar entry under graduation group
- `src/app/(portal)/portal-nav.tsx` — append "Events" to `alumniLinks`
- `tests/unit/auth/permissions.test.ts` — extend alumni role assertion to expect 4 perms

---

## Task 1: Schema migration

**Files:**
- Modify: `prisma/schema/communication.prisma`
- Modify: `prisma/schema/auth.prisma`
- Modify: `prisma/schema/school.prisma`
- Create: `prisma/schema/migrations/<timestamp>_add_alumni_events/migration.sql`

### Step 1: Append models to `communication.prisma`

Open `prisma/schema/communication.prisma`. Find the end of the existing `AlumniProfile` model (around line 180). After it, append:

```prisma
// ─── Alumni Events (Tier 2 #7 sub-project B) ─────────────────────────

model AlumniEvent {
  id                  String              @id @default(cuid())
  schoolId            String
  title               String
  description         String?
  startAt             DateTime
  endAt               DateTime?
  location            String?
  virtualLink         String?
  capacity            Int?
  maxGuestsPerRsvp    Int                 @default(0)
  rsvpDeadline        DateTime?
  status              AlumniEventStatus   @default(DRAFT)
  publishedAt         DateTime?
  canceledAt          DateTime?
  createdByUserId     String?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  school    School            @relation("SchoolAlumniEvents", fields: [schoolId], references: [id], onDelete: Cascade)
  createdBy User?             @relation("CreatedAlumniEvents", fields: [createdByUserId], references: [id], onDelete: SetNull)
  rsvps     AlumniEventRsvp[]

  @@index([schoolId, status, startAt])
  @@index([schoolId, startAt])
  @@index([createdByUserId])
}

model AlumniEventRsvp {
  id              String        @id @default(cuid())
  eventId         String
  alumniProfileId String
  response        RsvpResponse
  guestCount      Int           @default(0)
  waitlisted      Boolean       @default(false)
  respondedAt     DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  event         AlumniEvent   @relation(fields: [eventId], references: [id], onDelete: Cascade)
  alumniProfile AlumniProfile @relation(fields: [alumniProfileId], references: [id], onDelete: Cascade)

  @@unique([eventId, alumniProfileId])
  @@index([eventId, response])
  @@index([alumniProfileId])
}

enum AlumniEventStatus {
  DRAFT
  PUBLISHED
  CANCELED
}

enum RsvpResponse {
  YES
  NO
  MAYBE
}
```

### Step 2: Add back-relation on `AlumniProfile`

In the same file, inside `model AlumniProfile { ... }`, alongside other relations (or at the end of the relations section), add:

```prisma
  eventRsvps AlumniEventRsvp[]
```

### Step 3: Add back-relation on `School`

In `prisma/schema/school.prisma`, inside `model School { ... }`:

```prisma
  alumniEvents AlumniEvent[] @relation("SchoolAlumniEvents")
```

### Step 4: Add back-relation on `User`

In `prisma/schema/auth.prisma`, inside `model User { ... }`:

```prisma
  createdAlumniEvents AlumniEvent[] @relation("CreatedAlumniEvents")
```

### Step 5: Validate

Run: `npx prisma validate`
Expected: `The schemas at prisma\schema are valid`.

### Step 6: Generate migration

Run: `npx prisma migrate dev --name add_alumni_events --create-only`

Inspect the generated SQL. It should contain ONLY:
- `CREATE TABLE "AlumniEvent" (...)` + indexes + FKs
- `CREATE TABLE "AlumniEventRsvp" (...)` + indexes + FKs
- `CREATE TYPE "AlumniEventStatus" AS ENUM (...)` and `CREATE TYPE "RsvpResponse" AS ENUM (...)`

If Prisma proposes unrelated ALTER TABLE statements (spurious FK drift), strip them.

### Step 7: Apply

Run: `npx prisma migrate dev`
Expected: migration applied + Prisma client regenerated.

### Step 8: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean (run `rm -rf .next/dev` first if stale Next.js dev-types fire).

### Step 9: Commit

```bash
git add prisma/
git commit -m "feat(alumni-events): add AlumniEvent + AlumniEventRsvp models"
```

---

## Task 2: Permissions + alumni role bundle update

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `prisma/seed/index.ts`
- Modify: `tests/unit/auth/permissions.test.ts`

### Step 1: Add the two constants to `src/lib/permissions.ts`

Open `src/lib/permissions.ts`. Find the `PERMISSIONS` object. Locate the existing `// Alumni` block (added in sub-project A) containing `ALUMNI_PROFILE_UPDATE_OWN` and `ALUMNI_DIRECTORY_READ`. Append:

```ts
  ALUMNI_EVENTS_READ: "alumni:events:read",
  ALUMNI_EVENTS_RSVP: "alumni:events:rsvp",
```

### Step 2: Update the alumni role bundle

In the same file, locate `DEFAULT_ROLE_PERMISSIONS.alumni` (the existing array with the 2 perms from sub-project A). Update to:

```ts
  alumni: [
    PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN,
    PERMISSIONS.ALUMNI_DIRECTORY_READ,
    PERMISSIONS.ALUMNI_EVENTS_READ,
    PERMISSIONS.ALUMNI_EVENTS_RSVP,
  ],
```

### Step 3: Mirror into `prisma/seed/index.ts`

Open `prisma/seed/index.ts`. Find the local `DEFAULT_ROLE_PERMISSIONS.alumni` entry (added in sub-project A). Update to match:

```ts
  alumni: [
    "alumni:profile:update-own",
    "alumni:directory:read",
    "alumni:events:read",
    "alumni:events:rsvp",
  ],
```

The seed's permission upsert loop iterates the imported `AUTHORITATIVE_PERMISSIONS` object, so the two new permission codes auto-seed via the spread in `permissions.ts`. No additional inline list changes needed.

### Step 4: Update the regression test

Open `tests/unit/auth/permissions.test.ts`. Find the existing alumni-role test from sub-project A: `"alumni role has exactly the expected permissions"`. Update the `toEqual` array to include the two new perms:

```ts
it("alumni role has exactly the expected permissions", () => {
  expect(DEFAULT_ROLE_PERMISSIONS.alumni).toEqual([
    PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN,
    PERMISSIONS.ALUMNI_DIRECTORY_READ,
    PERMISSIONS.ALUMNI_EVENTS_READ,
    PERMISSIONS.ALUMNI_EVENTS_RSVP,
  ]);
  expect(DEFAULT_ROLE_PERMISSIONS.student).not.toContain(PERMISSIONS.ALUMNI_EVENTS_READ);
  expect(DEFAULT_ROLE_PERMISSIONS.student).not.toContain(PERMISSIONS.ALUMNI_EVENTS_RSVP);
  expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.ALUMNI_EVENTS_READ);
  expect(DEFAULT_ROLE_PERMISSIONS.class_teacher).not.toContain(PERMISSIONS.ALUMNI_EVENTS_RSVP);
});
```

(Preserve any existing assertions for the original 2 perms — extend, don't replace.)

### Step 5: Verify

- [ ] Run: `npx vitest run tests/unit/auth/permissions.test.ts`
  Expected: all tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 6: Re-seed dev DB

- [ ] Run: `npm run db:seed`
  Expected: idempotent — 2 new Permission rows + 2 new RolePermission rows linking them to the alumni Role. Existing data untouched. If seed fails because Postgres at localhost:5433 unreachable, skip — the static map is the source of truth for unit tests.

### Step 7: Commit

```bash
git add src/lib/permissions.ts prisma/seed/index.ts tests/unit/auth/permissions.test.ts
git commit -m "feat(alumni-events): add ALUMNI_EVENTS_READ + ALUMNI_EVENTS_RSVP perms"
```

---

## Task 3: Notification event registration + fan-out helper (TDD)

**Files:**
- Modify: `src/lib/notifications/events.ts`
- Create: `src/modules/alumni-events/events-notifications.ts`
- Create: `tests/unit/modules/alumni-events/events-notifications.test.ts`

### Step 1: Register the new event

Open `src/lib/notifications/events.ts`. In `NOTIFICATION_EVENTS`, after the `REPORT_CARD_*` block, add:

```ts
  // Alumni events
  ALUMNI_EVENT_PUBLISHED: "alumni_event_published",
```

In `EVENT_CHANNELS`, add:

```ts
  [NOTIFICATION_EVENTS.ALUMNI_EVENT_PUBLISHED]: ["in_app", "email"],
```

Run `npx tsc --noEmit` — expect clean (the `EVENT_CHANNELS: Record<NotificationEvent, ...>` type enforces completeness).

### Step 2: Write failing tests

Create `tests/unit/modules/alumni-events/events-notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import { notifyAlumniEventPublished } from "@/modules/alumni-events/events-notifications";
import { sendMessage } from "@/lib/messaging/hub";

vi.mock("@/lib/messaging/hub", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

describe("notifyAlumniEventPublished", () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    vi.mocked(sendMessage).mockResolvedValue({ success: true });
    prismaMock.alumniProfile.findMany.mockReset();
    prismaMock.student.findMany.mockReset();
    prismaMock.notificationPreference.findMany.mockReset();
    prismaMock.school.findUnique.mockReset();
  });

  it("uses in_app + email defaults", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      { studentId: "s-1" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", userId: "u-1" },
    ] as never);
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);

    const result = await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Class of 2026 Reunion",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toContain("in_app");
    expect(channelsCalled).toContain("email");
    expect(result.recipientCount).toBe(1);
  });

  it("respects preference overrides (in_app only)", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      { studentId: "s-1" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", userId: "u-1" },
    ] as never);
    prismaMock.notificationPreference.findMany.mockResolvedValue([
      { userId: "u-1", eventKey: "alumni_event_published", channels: ["IN_APP"] },
    ] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);

    await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Reunion",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    const channelsCalled = vi.mocked(sendMessage).mock.calls.map((c) => c[0]);
    expect(channelsCalled).toEqual(["in_app"]);
  });

  it("skips alumni with null userId", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      { studentId: "s-1" },
      { studentId: "s-2" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", userId: "u-1" },
      { id: "s-2", userId: null },
    ] as never);
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);

    const result = await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Reunion",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    const recipients = vi.mocked(sendMessage).mock.calls.map((c) => c[1].to);
    expect(recipients).toEqual(["u-1", "u-1"]);  // 2 channels × 1 recipient
    expect(result.recipientCount).toBe(1);
  });

  it("returns recipientCount 0 and skips sendMessage when no alumni", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);

    const result = await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Reunion",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    expect(vi.mocked(sendMessage)).not.toHaveBeenCalled();
    expect(result.recipientCount).toBe(0);
  });

  it("swallows per-recipient errors and continues fan-out", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      { studentId: "s-1" },
      { studentId: "s-2" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", userId: "u-1" },
      { id: "s-2", userId: "u-2" },
    ] as never);
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error("hub down"));

    await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Reunion",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    // 2 recipients × 2 channels = 4 calls
    expect(vi.mocked(sendMessage).mock.calls.length).toBe(4);
    const recipients = vi.mocked(sendMessage).mock.calls.map((c) => c[1].to);
    expect(recipients).toContain("u-2");  // second recipient still reached
  });

  it("includes eventTitle and humanized date in body", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      { studentId: "s-1" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", userId: "u-1" },
    ] as never);
    prismaMock.notificationPreference.findMany.mockResolvedValue([] as never);
    prismaMock.school.findUnique.mockResolvedValue({ name: "Test School" } as never);

    await notifyAlumniEventPublished({
      eventId: "e-1",
      schoolId: "school-1",
      eventTitle: "Reunion 2026",
      startAt: new Date("2026-06-15T18:00:00Z"),
    });

    const firstCall = vi.mocked(sendMessage).mock.calls[0];
    expect(firstCall?.[1].body).toContain("Reunion 2026");
    expect(firstCall?.[1].body).toContain("Test School");
  });
});
```

### Step 3: Verify RED

Run: `npx vitest run tests/unit/modules/alumni-events/events-notifications.test.ts`
Expected: fail (module not found).

### Step 4: Implement the helper

Create `src/modules/alumni-events/events-notifications.ts`:

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

function humanizeDate(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function notifyAlumniEventPublished(params: {
  eventId: string;
  schoolId: string;
  eventTitle: string;
  startAt: Date;
}): Promise<{ recipientCount: number }> {
  // Resolve recipient userIds via alumni profiles -> students -> userIds.
  const profiles = await db.alumniProfile.findMany({
    where: { schoolId: params.schoolId },
    select: { studentId: true },
  });
  if (profiles.length === 0) {
    return { recipientCount: 0 };
  }

  const students = await db.student.findMany({
    where: { id: { in: profiles.map((p) => p.studentId) } },
    select: { id: true, userId: true },
  });
  const recipientUserIds = students
    .map((s) => s.userId)
    .filter((u): u is string => !!u);

  if (recipientUserIds.length === 0) {
    return { recipientCount: 0 };
  }

  const school = await db.school.findUnique({
    where: { id: params.schoolId },
    select: { name: true },
  });
  const schoolName = school?.name ?? "Your school";

  const prefs = await db.notificationPreference.findMany({
    where: {
      userId: { in: recipientUserIds },
      eventKey: NOTIFICATION_EVENTS.ALUMNI_EVENT_PUBLISHED,
    },
  });
  const prefByUser = new Map(prefs.map((p) => [p.userId, p.channels]));

  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.ALUMNI_EVENT_PUBLISHED] as ChannelKey[];
  const body =
    `${params.eventTitle} — ${humanizeDate(params.startAt)}\n\n` +
    `${schoolName} has published a new alumni event. Log in to RSVP.`;

  const metadata = {
    eventId: params.eventId,
    eventTitle: params.eventTitle,
    startAt: params.startAt.toISOString(),
  };

  for (const userId of recipientUserIds) {
    const override = prefByUser.get(userId);
    const channels: ChannelKey[] = override
      ? override.map(channelEnumToKey)
      : defaults;

    if (channels.length === 0) continue;

    for (const channel of channels) {
      const hubChannel = channelKeyToHub(channel);
      if (!hubChannel) continue;

      try {
        await sendMessage(hubChannel, {
          to: userId,
          body,
          metadata,
        });
      } catch (err) {
        console.error("alumni event notification failed", {
          eventId: params.eventId,
          userId,
          err,
        });
      }
    }
  }

  return { recipientCount: recipientUserIds.length };
}
```

### Step 5: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/alumni-events/events-notifications.test.ts`
  Expected: all 6 tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 6: Commit

```bash
git add src/lib/notifications/events.ts src/modules/alumni-events/events-notifications.ts tests/unit/modules/alumni-events/events-notifications.test.ts
git commit -m "feat(alumni-events): register ALUMNI_EVENT_PUBLISHED + fan-out helper"
```

---

## Task 4: Zod schemas

**Files:**
- Create: `src/modules/alumni-events/schemas/event.schema.ts`

### Step 1: Create the schemas

Create `src/modules/alumni-events/schemas/event.schema.ts`:

```ts
import { z } from "zod";

export const createAlumniEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  virtualLink: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  maxGuestsPerRsvp: z.number().int().min(0).default(0),
  rsvpDeadline: z.coerce.date().optional().nullable(),
}).refine(
  (data) => !data.endAt || data.endAt >= data.startAt,
  { message: "endAt must be on or after startAt", path: ["endAt"] },
).refine(
  (data) => !data.rsvpDeadline || data.rsvpDeadline <= data.startAt,
  { message: "rsvpDeadline must be on or before startAt", path: ["rsvpDeadline"] },
);

export const updateAlumniEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  virtualLink: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  maxGuestsPerRsvp: z.number().int().min(0).optional(),
  rsvpDeadline: z.coerce.date().optional().nullable(),
});

export const upsertRsvpSchema = z.object({
  eventId: z.string().min(1),
  response: z.enum(["YES", "NO", "MAYBE"]),
  guestCount: z.number().int().min(0).default(0),
});

export type CreateAlumniEventInput = z.infer<typeof createAlumniEventSchema>;
export type UpdateAlumniEventInput = z.infer<typeof updateAlumniEventSchema>;
export type UpsertRsvpInput = z.infer<typeof upsertRsvpSchema>;
```

### Step 2: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 3: Commit

```bash
git add src/modules/alumni-events/schemas/event.schema.ts
git commit -m "feat(alumni-events): zod schemas for event create/update/RSVP"
```

---

## Task 5: Admin event actions (TDD)

**Files:**
- Create: `src/modules/alumni-events/actions/admin-events.action.ts`
- Create: `tests/unit/modules/alumni-events/admin-events.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/alumni-events/admin-events.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  createAlumniEventDraftAction,
  updateAlumniEventAction,
  publishAlumniEventAction,
  cancelAlumniEventAction,
  getAlumniEventListAction,
  getAlumniEventDetailAction,
} from "@/modules/alumni-events/actions/admin-events.action";
import { notifyAlumniEventPublished } from "@/modules/alumni-events/events-notifications";

vi.mock("@/modules/alumni-events/events-notifications", () => ({
  notifyAlumniEventPublished: vi.fn().mockResolvedValue({ recipientCount: 0 }),
}));

const ADMIN_PERMS_WRITE = ["graduation:create"];
const ADMIN_PERMS_READ = ["graduation:records:read"];

const sampleEvent = {
  id: "e-1",
  schoolId: "default-school",
  title: "Class of 2026 Reunion",
  description: null,
  startAt: new Date("2027-06-15T18:00:00Z"),
  endAt: null,
  location: "Main Hall",
  virtualLink: null,
  capacity: null,
  maxGuestsPerRsvp: 0,
  rsvpDeadline: null,
  status: "DRAFT",
  publishedAt: null,
  canceledAt: null,
  createdByUserId: "test-user-id",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("createAlumniEventDraftAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_WRITE });
    prismaMock.alumniEvent.create.mockReset();
    vi.mocked(audit).mockClear();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await createAlumniEventDraftAction({
      title: "X",
      startAt: new Date("2027-06-15"),
    });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects empty title", async () => {
    const res = await createAlumniEventDraftAction({
      title: "",
      startAt: new Date("2027-06-15"),
    });
    expect("error" in res).toBe(true);
  });

  it("rejects endAt before startAt", async () => {
    const res = await createAlumniEventDraftAction({
      title: "X",
      startAt: new Date("2027-06-15"),
      endAt: new Date("2027-06-14"),
    });
    expect("error" in res).toBe(true);
  });

  it("happy path creates DRAFT event and audits", async () => {
    prismaMock.alumniEvent.create.mockResolvedValue(sampleEvent as never);

    const res = await createAlumniEventDraftAction({
      title: "Class of 2026 Reunion",
      startAt: new Date("2027-06-15T18:00:00Z"),
      location: "Main Hall",
    });

    expect("data" in res).toBe(true);
    expect(prismaMock.alumniEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Class of 2026 Reunion",
          status: "DRAFT",
          schoolId: "default-school",
          createdByUserId: "test-user-id",
        }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });
});

describe("updateAlumniEventAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_WRITE });
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEvent.update.mockReset();
    vi.mocked(audit).mockClear();
  });

  it("rejects when event not found in school", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(null as never);
    const res = await updateAlumniEventAction("e-1", { title: "New" });
    expect(res).toEqual({ error: "Event not found" });
  });

  it("rejects edits when event is CANCELED", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "CANCELED",
    } as never);
    const res = await updateAlumniEventAction("e-1", { title: "New" });
    expect((res as { error: string }).error).toMatch(/cannot edit.*canceled/i);
  });

  it("happy path partial update only writes supplied fields", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEvent.update.mockResolvedValue({
      ...sampleEvent,
      title: "Updated",
    } as never);

    await updateAlumniEventAction("e-1", { title: "Updated" });

    expect(prismaMock.alumniEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e-1" },
        data: { title: "Updated" },
      }),
    );
  });
});

describe("publishAlumniEventAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_WRITE });
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEvent.update.mockReset();
    vi.mocked(notifyAlumniEventPublished).mockClear();
    vi.mocked(notifyAlumniEventPublished).mockResolvedValue({ recipientCount: 5 });
  });

  it("idempotent: PUBLISHED event returns without re-firing fan-out", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "PUBLISHED",
    } as never);

    await publishAlumniEventAction("e-1");

    expect(prismaMock.alumniEvent.update).not.toHaveBeenCalled();
    expect(vi.mocked(notifyAlumniEventPublished)).not.toHaveBeenCalled();
  });

  it("rejects publish on CANCELED event", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "CANCELED",
    } as never);

    const res = await publishAlumniEventAction("e-1");
    expect((res as { error: string }).error).toMatch(/cannot publish.*canceled/i);
  });

  it("happy path: flips DRAFT→PUBLISHED and fires fan-out", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEvent.update.mockResolvedValue({
      ...sampleEvent,
      status: "PUBLISHED",
      publishedAt: new Date(),
    } as never);

    await publishAlumniEventAction("e-1");

    expect(prismaMock.alumniEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e-1" },
        data: expect.objectContaining({
          status: "PUBLISHED",
          publishedAt: expect.any(Date),
        }),
      }),
    );
    expect(vi.mocked(notifyAlumniEventPublished)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "e-1",
        schoolId: "default-school",
        eventTitle: "Class of 2026 Reunion",
      }),
    );
  });

  it("fan-out failure does not roll back publish", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEvent.update.mockResolvedValue({
      ...sampleEvent,
      status: "PUBLISHED",
    } as never);
    vi.mocked(notifyAlumniEventPublished).mockRejectedValueOnce(new Error("hub down"));

    const res = await publishAlumniEventAction("e-1");

    expect("data" in res).toBe(true);  // publish still committed
  });
});

describe("cancelAlumniEventAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_WRITE });
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEvent.update.mockReset();
  });

  it("idempotent: already-CANCELED returns existing", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "CANCELED",
    } as never);

    await cancelAlumniEventAction("e-1");
    expect(prismaMock.alumniEvent.update).not.toHaveBeenCalled();
  });

  it("happy path: flips to CANCELED with canceledAt set", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "PUBLISHED",
    } as never);
    prismaMock.alumniEvent.update.mockResolvedValue({
      ...sampleEvent,
      status: "CANCELED",
      canceledAt: new Date(),
    } as never);

    await cancelAlumniEventAction("e-1");

    expect(prismaMock.alumniEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANCELED",
          canceledAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe("getAlumniEventListAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_READ });
    prismaMock.alumniEvent.findMany.mockReset();
    prismaMock.alumniEvent.count.mockReset();
    prismaMock.alumniEventRsvp.groupBy.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getAlumniEventListAction({});
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("returns rows with computed yesCount + confirmedHeadcount", async () => {
    prismaMock.alumniEvent.findMany.mockResolvedValue([sampleEvent] as never);
    prismaMock.alumniEvent.count.mockResolvedValue(1 as never);
    prismaMock.alumniEventRsvp.groupBy.mockResolvedValue([
      { eventId: "e-1", response: "YES", _count: { _all: 3 }, _sum: { guestCount: 2 } },
    ] as never);

    const res = await getAlumniEventListAction({});
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data[0].yesCount).toBe(3);
    expect(res.data[0].confirmedHeadcount).toBeGreaterThan(0);
  });
});

describe("getAlumniEventDetailAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_READ });
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEventRsvp.findMany.mockReset();
  });

  it("returns event + sorted RSVP table", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEventRsvp.findMany.mockResolvedValue([
      {
        id: "r-1",
        response: "NO",
        guestCount: 0,
        waitlisted: false,
        respondedAt: new Date(),
        alumniProfile: {
          studentId: "s-1",
          graduationYear: 2026,
          currentEmployer: "Acme",
          student: { firstName: "A", lastName: "B", photoUrl: null },
        },
      },
      {
        id: "r-2",
        response: "YES",
        guestCount: 1,
        waitlisted: false,
        respondedAt: new Date(),
        alumniProfile: {
          studentId: "s-2",
          graduationYear: 2025,
          currentEmployer: "Co",
          student: { firstName: "C", lastName: "D", photoUrl: null },
        },
      },
    ] as never);

    const res = await getAlumniEventDetailAction("e-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.rsvps[0].response).toBe("YES");  // YES first
    expect(res.data.rsvps[1].response).toBe("NO");
  });

  it("returns Event not found for cross-school", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(null as never);
    const res = await getAlumniEventDetailAction("e-1");
    expect(res).toEqual({ error: "Event not found" });
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/alumni-events/admin-events.test.ts`
  Expected: fail (module not found).

### Step 3: Implement the action file

Create `src/modules/alumni-events/actions/admin-events.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  createAlumniEventSchema,
  updateAlumniEventSchema,
  type CreateAlumniEventInput,
  type UpdateAlumniEventInput,
} from "../schemas/event.schema";
import { notifyAlumniEventPublished } from "../events-notifications";

// ─── Create draft ───────────────────────────────────────────────────

export async function createAlumniEventDraftAction(input: CreateAlumniEventInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_CREATE);
  if (denied) return denied;

  const parsed = createAlumniEventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const event = await db.alumniEvent.create({
    data: {
      schoolId: ctx.schoolId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt ?? null,
      location: parsed.data.location ?? null,
      virtualLink: parsed.data.virtualLink ? parsed.data.virtualLink : null,
      capacity: parsed.data.capacity ?? null,
      maxGuestsPerRsvp: parsed.data.maxGuestsPerRsvp,
      rsvpDeadline: parsed.data.rsvpDeadline ?? null,
      status: "DRAFT",
      createdByUserId: ctx.session.user.id,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "AlumniEvent",
    entityId: event.id,
    module: "alumni",
    description: `Created alumni event draft: ${event.title}`,
    newData: event,
  });

  return { data: event };
}

// ─── Update ─────────────────────────────────────────────────────────

export async function updateAlumniEventAction(
  eventId: string,
  input: UpdateAlumniEventInput,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_CREATE);
  if (denied) return denied;

  const parsed = updateAlumniEventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const previous = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!previous) return { error: "Event not found" };

  if (previous.status === "CANCELED") {
    return { error: "Cannot edit a canceled event" };
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.startAt !== undefined) data.startAt = parsed.data.startAt;
  if (parsed.data.endAt !== undefined) data.endAt = parsed.data.endAt;
  if (parsed.data.location !== undefined) data.location = parsed.data.location;
  if (parsed.data.virtualLink !== undefined) {
    data.virtualLink = parsed.data.virtualLink === "" ? null : parsed.data.virtualLink;
  }
  if (parsed.data.capacity !== undefined) data.capacity = parsed.data.capacity;
  if (parsed.data.maxGuestsPerRsvp !== undefined) data.maxGuestsPerRsvp = parsed.data.maxGuestsPerRsvp;
  if (parsed.data.rsvpDeadline !== undefined) data.rsvpDeadline = parsed.data.rsvpDeadline;

  const updated = await db.alumniEvent.update({
    where: { id: eventId },
    data,
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "AlumniEvent",
    entityId: eventId,
    module: "alumni",
    description: `Updated alumni event: ${updated.title}`,
    previousData: previous,
    newData: updated,
  });

  return { data: updated };
}

// ─── Publish ────────────────────────────────────────────────────────

export async function publishAlumniEventAction(eventId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_CREATE);
  if (denied) return denied;

  const previous = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!previous) return { error: "Event not found" };

  if (previous.status === "CANCELED") {
    return { error: "Cannot publish a canceled event" };
  }
  if (previous.status === "PUBLISHED") {
    return { data: previous };  // idempotent
  }

  const updated = await db.alumniEvent.update({
    where: { id: eventId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  let recipientCount = 0;
  try {
    const result = await notifyAlumniEventPublished({
      eventId: updated.id,
      schoolId: ctx.schoolId,
      eventTitle: updated.title,
      startAt: updated.startAt,
    });
    recipientCount = result.recipientCount;
  } catch (err) {
    console.error("notifyAlumniEventPublished failed", { eventId: updated.id, err });
  }

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "AlumniEvent",
    entityId: eventId,
    module: "alumni",
    description: `Published alumni event: ${updated.title}`,
    previousData: previous,
    newData: updated,
    metadata: { eventTitle: updated.title, recipientCount },
  });

  return { data: updated };
}

// ─── Cancel ─────────────────────────────────────────────────────────

export async function cancelAlumniEventAction(eventId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_CREATE);
  if (denied) return denied;

  const previous = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!previous) return { error: "Event not found" };

  if (previous.status === "CANCELED") {
    return { data: previous };  // idempotent
  }

  const updated = await db.alumniEvent.update({
    where: { id: eventId },
    data: { status: "CANCELED", canceledAt: new Date() },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "AlumniEvent",
    entityId: eventId,
    module: "alumni",
    description: `Canceled alumni event: ${updated.title}`,
    previousData: previous,
    newData: updated,
  });

  return { data: updated };
}

// ─── List ───────────────────────────────────────────────────────────

/** @no-audit Read-only admin listing. */
export async function getAlumniEventListAction(filters?: {
  status?: "DRAFT" | "PUBLISHED" | "CANCELED";
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.status) where.status = filters.status;
  if (filters?.fromDate || filters?.toDate) {
    const startAt: Record<string, Date> = {};
    if (filters?.fromDate) startAt.gte = filters.fromDate;
    if (filters?.toDate) startAt.lte = filters.toDate;
    where.startAt = startAt;
  }

  const [events, total] = await Promise.all([
    db.alumniEvent.findMany({
      where,
      orderBy: { startAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.alumniEvent.count({ where }),
  ]);

  // Fetch RSVP aggregates for the page's events.
  const eventIds = events.map((e) => e.id);
  const aggregates = eventIds.length
    ? await db.alumniEventRsvp.groupBy({
        by: ["eventId", "response", "waitlisted"],
        where: { eventId: { in: eventIds } },
        _count: { _all: true },
        _sum: { guestCount: true },
      })
    : [];

  // Build a map: eventId -> { yes, no, maybe, confirmedHeadcount, waitlistHeadcount }
  type EventStats = {
    yesCount: number;
    noCount: number;
    maybeCount: number;
    confirmedHeadcount: number;
    waitlistHeadcount: number;
  };
  const statsByEvent = new Map<string, EventStats>();
  for (const agg of aggregates) {
    const stats = statsByEvent.get(agg.eventId) ?? {
      yesCount: 0,
      noCount: 0,
      maybeCount: 0,
      confirmedHeadcount: 0,
      waitlistHeadcount: 0,
    };
    if (agg.response === "YES") {
      stats.yesCount += agg._count._all;
      const head = agg._count._all + (agg._sum.guestCount ?? 0);
      if (agg.waitlisted) stats.waitlistHeadcount += head;
      else stats.confirmedHeadcount += head;
    } else if (agg.response === "NO") {
      stats.noCount += agg._count._all;
    } else if (agg.response === "MAYBE") {
      stats.maybeCount += agg._count._all;
    }
    statsByEvent.set(agg.eventId, stats);
  }

  const data = events.map((e) => ({
    ...e,
    ...(statsByEvent.get(e.id) ?? {
      yesCount: 0,
      noCount: 0,
      maybeCount: 0,
      confirmedHeadcount: 0,
      waitlistHeadcount: 0,
    }),
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ─── Detail ─────────────────────────────────────────────────────────

/** @no-audit Read-only admin detail. */
export async function getAlumniEventDetailAction(eventId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_READ);
  if (denied) return denied;

  const event = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!event) return { error: "Event not found" };

  const rsvps = await db.alumniEventRsvp.findMany({
    where: { eventId },
    include: {
      alumniProfile: {
        select: {
          studentId: true,
          graduationYear: true,
          currentEmployer: true,
          student: {
            select: { firstName: true, lastName: true, photoUrl: true },
          },
        },
      },
    },
  });

  // Sort: YES non-waitlisted (by name) → YES waitlisted → MAYBE → NO
  const responseOrder = { YES: 0, MAYBE: 2, NO: 3 } as const;
  const sorted = [...rsvps].sort((a, b) => {
    const ra = responseOrder[a.response];
    const rb = responseOrder[b.response];
    if (a.response === "YES" && b.response === "YES") {
      if (a.waitlisted !== b.waitlisted) return a.waitlisted ? 1 : -1;
    }
    if (ra !== rb) return ra - rb;
    const an = `${a.alumniProfile.student.firstName} ${a.alumniProfile.student.lastName}`;
    const bn = `${b.alumniProfile.student.firstName} ${b.alumniProfile.student.lastName}`;
    return an.localeCompare(bn);
  });

  const flatRsvps = sorted.map((r) => ({
    id: r.id,
    studentId: r.alumniProfile.studentId,
    firstName: r.alumniProfile.student.firstName,
    lastName: r.alumniProfile.student.lastName,
    photoUrl: r.alumniProfile.student.photoUrl,
    graduationYear: r.alumniProfile.graduationYear,
    currentEmployer: r.alumniProfile.currentEmployer,
    response: r.response,
    guestCount: r.guestCount,
    waitlisted: r.waitlisted,
    respondedAt: r.respondedAt,
  }));

  return {
    data: { event, rsvps: flatRsvps },
  };
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/alumni-events/admin-events.test.ts`
  Expected: all tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/alumni-events/actions/admin-events.action.ts tests/unit/modules/alumni-events/admin-events.test.ts
git commit -m "feat(alumni-events): admin actions (create/update/publish/cancel/list/detail)"
```

---

## Task 6: Alumni-side event actions (TDD)

**Files:**
- Create: `src/modules/alumni-events/actions/alumni-events.action.ts`
- Create: `tests/unit/modules/alumni-events/alumni-events.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/alumni-events/alumni-events.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  getMyAlumniEventsAction,
  getMyAlumniEventDetailAction,
  upsertMyEventRsvpAction,
} from "@/modules/alumni-events/actions/alumni-events.action";

const ALUMNI_PERMS = ["alumni:events:read", "alumni:events:rsvp"];

const sampleStudent = { id: "s-1" };
const sampleProfile = { id: "ap-1" };

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

const sampleEvent = {
  id: "e-1",
  schoolId: "default-school",
  title: "Reunion",
  description: null,
  startAt: futureDate,
  endAt: null,
  location: "Hall",
  virtualLink: null,
  capacity: null,
  maxGuestsPerRsvp: 2,
  rsvpDeadline: null,
  status: "PUBLISHED" as const,
  publishedAt: new Date(),
  canceledAt: null,
  createdByUserId: "u-admin",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getMyAlumniEventsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.alumniEvent.findMany.mockReset();
    prismaMock.alumniEventRsvp.findMany.mockReset();
    prismaMock.alumniEventRsvp.groupBy.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getMyAlumniEventsAction({ tab: "upcoming" });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects non-graduated user", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const res = await getMyAlumniEventsAction({ tab: "upcoming" });
    expect(res).toEqual({ error: "Alumni access not available." });
  });

  it("upcoming tab filters published + future events; includes own RSVP", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findMany.mockResolvedValue([sampleEvent] as never);
    prismaMock.alumniEventRsvp.findMany.mockResolvedValue([
      {
        eventId: "e-1",
        response: "YES",
        guestCount: 1,
        waitlisted: false,
      },
    ] as never);
    prismaMock.alumniEventRsvp.groupBy.mockResolvedValue([] as never);

    const res = await getMyAlumniEventsAction({ tab: "upcoming" });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data[0].myRsvp?.response).toBe("YES");

    expect(prismaMock.alumniEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "default-school",
          status: "PUBLISHED",
          startAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
  });

  it("past tab filters past events; includes CANCELED", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findMany.mockResolvedValue([] as never);
    prismaMock.alumniEventRsvp.findMany.mockResolvedValue([] as never);
    prismaMock.alumniEventRsvp.groupBy.mockResolvedValue([] as never);

    await getMyAlumniEventsAction({ tab: "past" });

    expect(prismaMock.alumniEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["PUBLISHED", "CANCELED"] },
          startAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });
});

describe("getMyAlumniEventDetailAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEventRsvp.findUnique.mockReset();
  });

  it("returns 404 for DRAFT event", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "DRAFT",
    } as never);

    const res = await getMyAlumniEventDetailAction("e-1");
    expect(res).toEqual({ error: "Event not found" });
  });

  it("happy path returns event + own RSVP", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEventRsvp.findUnique.mockResolvedValue({
      response: "MAYBE",
      guestCount: 0,
      waitlisted: false,
    } as never);

    const res = await getMyAlumniEventDetailAction("e-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.event.id).toBe("e-1");
    expect(res.data.myRsvp?.response).toBe("MAYBE");
  });
});

describe("upsertMyEventRsvpAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEventRsvp.findUnique.mockReset();
    prismaMock.alumniEventRsvp.upsert.mockReset();
    prismaMock.alumniEventRsvp.aggregate.mockReset();
    vi.mocked(audit).mockClear();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects RSVP on DRAFT event with generic 404", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "DRAFT",
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    expect(res).toEqual({ error: "Event not available" });
  });

  it("rejects RSVP after rsvpDeadline", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      rsvpDeadline: pastDate,
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    expect((res as { error: string }).error).toMatch(/deadline/i);
  });

  it("rejects RSVP after startAt", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      startAt: pastDate,
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    expect((res as { error: string }).error).toMatch(/already taken place/i);
  });

  it("rejects when guestCount exceeds maxGuestsPerRsvp", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      maxGuestsPerRsvp: 1,
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 5 });
    expect((res as { error: string }).error).toMatch(/at most 1 guest/i);
  });

  it("happy path with no capacity sets waitlisted=false", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEventRsvp.findUnique.mockResolvedValue(null as never);
    prismaMock.alumniEventRsvp.upsert.mockResolvedValue({
      id: "r-1",
      eventId: "e-1",
      alumniProfileId: "ap-1",
      response: "YES",
      guestCount: 0,
      waitlisted: false,
      respondedAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.waitlisted).toBe(false);
    expect(prismaMock.alumniEventRsvp.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ waitlisted: false }),
      }),
    );
  });

  it("capacity exceeded sets waitlisted=true", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      capacity: 2,
    } as never);
    prismaMock.alumniEventRsvp.findUnique.mockResolvedValue(null as never);
    // Existing headcount = 2 (one YES with 1 guest = 2 spots used)
    prismaMock.alumniEventRsvp.aggregate.mockResolvedValue({
      _count: { _all: 1 },
      _sum: { guestCount: 1 },
    } as never);
    prismaMock.alumniEventRsvp.upsert.mockResolvedValue({
      id: "r-2",
      eventId: "e-1",
      alumniProfileId: "ap-1",
      response: "YES",
      guestCount: 0,
      waitlisted: true,
      respondedAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.waitlisted).toBe(true);
  });

  it("idempotent upsert (second call updates same row)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEventRsvp.findUnique.mockResolvedValue({
      id: "r-1",
      response: "MAYBE",
      guestCount: 0,
      waitlisted: false,
    } as never);
    prismaMock.alumniEventRsvp.upsert.mockResolvedValue({
      id: "r-1",
      response: "YES",
      guestCount: 1,
      waitlisted: false,
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 1 });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.response).toBe("YES");
    expect(prismaMock.alumniEventRsvp.upsert).toHaveBeenCalled();
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/alumni-events/alumni-events.test.ts`
  Expected: fail (module not found).

### Step 3: Implement the action file

Create `src/modules/alumni-events/actions/alumni-events.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission, type Permission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import type { Session } from "next-auth";
import { upsertRsvpSchema, type UpsertRsvpInput } from "../schemas/event.schema";

// Reuse the assertAlumnusAccess helper pattern from sub-project A.
async function assertAlumnusAccess<S extends Record<string, true>>(
  ctx: { session: Session; schoolId: string },
  permission: Permission,
  select: S,
): Promise<{ student: { [K in keyof S]: unknown } } | { error: string }> {
  const denied = assertPermission(ctx.session, permission);
  if (denied) return denied;
  const student = await db.student.findFirst({
    where: {
      userId: ctx.session.user.id,
      schoolId: ctx.schoolId,
      status: "GRADUATED",
    },
    select,
  });
  if (!student) {
    console.error("alumni: status check failed", {
      userId: ctx.session.user.id,
      permission,
    });
    return { error: "Alumni access not available." };
  }
  return { student: student as { [K in keyof S]: unknown } };
}

async function resolveAlumniProfileId(studentId: string): Promise<string | null> {
  const profile = await db.alumniProfile.findUnique({
    where: { studentId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

// ─── List my events ─────────────────────────────────────────────────

/** @no-audit Read-only alumnus events listing. */
export async function getMyAlumniEventsAction(filters?: {
  tab?: "upcoming" | "past";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const access = await assertAlumnusAccess(ctx, PERMISSIONS.ALUMNI_EVENTS_READ, { id: true });
  if ("error" in access) return access;
  const studentId = (access.student as { id: string }).id;
  const alumniProfileId = await resolveAlumniProfileId(studentId);
  if (!alumniProfileId) return { error: "Alumni profile not found" };

  const tab = filters?.tab ?? "upcoming";
  const now = new Date();

  const where: Record<string, unknown> =
    tab === "upcoming"
      ? {
          schoolId: ctx.schoolId,
          status: "PUBLISHED",
          startAt: { gte: now },
        }
      : {
          schoolId: ctx.schoolId,
          status: { in: ["PUBLISHED", "CANCELED"] },
          startAt: { lt: now },
        };

  const events = await db.alumniEvent.findMany({
    where,
    orderBy: { startAt: tab === "upcoming" ? "asc" : "desc" },
  });

  if (events.length === 0) return { data: [] };

  const eventIds = events.map((e) => e.id);

  // Own RSVPs for these events
  const myRsvps = await db.alumniEventRsvp.findMany({
    where: { eventId: { in: eventIds }, alumniProfileId },
  });
  const rsvpByEvent = new Map(myRsvps.map((r) => [r.eventId, r]));

  // Headcount aggregates for capacity hints
  const aggregates = await db.alumniEventRsvp.groupBy({
    by: ["eventId", "response", "waitlisted"],
    where: { eventId: { in: eventIds } },
    _count: { _all: true },
    _sum: { guestCount: true },
  });
  const headcountByEvent = new Map<string, number>();
  for (const a of aggregates) {
    if (a.response === "YES" && !a.waitlisted) {
      const head = a._count._all + (a._sum.guestCount ?? 0);
      headcountByEvent.set(a.eventId, (headcountByEvent.get(a.eventId) ?? 0) + head);
    }
  }

  const data = events.map((e) => {
    const myRsvp = rsvpByEvent.get(e.id);
    return {
      id: e.id,
      title: e.title,
      startAt: e.startAt,
      endAt: e.endAt,
      location: e.location,
      virtualLink: e.virtualLink,
      status: e.status,
      capacity: e.capacity,
      confirmedHeadcount: headcountByEvent.get(e.id) ?? 0,
      myRsvp: myRsvp
        ? {
            response: myRsvp.response,
            guestCount: myRsvp.guestCount,
            waitlisted: myRsvp.waitlisted,
          }
        : null,
    };
  });

  return { data };
}

// ─── Detail ─────────────────────────────────────────────────────────

/** @no-audit Read-only alumnus event detail. */
export async function getMyAlumniEventDetailAction(eventId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const access = await assertAlumnusAccess(ctx, PERMISSIONS.ALUMNI_EVENTS_READ, { id: true });
  if ("error" in access) return access;
  const studentId = (access.student as { id: string }).id;
  const alumniProfileId = await resolveAlumniProfileId(studentId);
  if (!alumniProfileId) return { error: "Alumni profile not found" };

  const event = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!event || event.status === "DRAFT") {
    return { error: "Event not found" };
  }

  const myRsvp = await db.alumniEventRsvp.findUnique({
    where: { eventId_alumniProfileId: { eventId, alumniProfileId } },
  });

  return {
    data: {
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        location: event.location,
        virtualLink: event.virtualLink,
        capacity: event.capacity,
        maxGuestsPerRsvp: event.maxGuestsPerRsvp,
        rsvpDeadline: event.rsvpDeadline,
        status: event.status,
      },
      myRsvp: myRsvp
        ? {
            response: myRsvp.response,
            guestCount: myRsvp.guestCount,
            waitlisted: myRsvp.waitlisted,
          }
        : null,
    },
  };
}

// ─── Upsert RSVP ────────────────────────────────────────────────────

export async function upsertMyEventRsvpAction(input: UpsertRsvpInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const access = await assertAlumnusAccess(ctx, PERMISSIONS.ALUMNI_EVENTS_RSVP, { id: true });
  if ("error" in access) return access;
  const studentId = (access.student as { id: string }).id;
  const alumniProfileId = await resolveAlumniProfileId(studentId);
  if (!alumniProfileId) return { error: "Alumni profile not found" };

  const parsed = upsertRsvpSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { eventId, response, guestCount } = parsed.data;

  const event = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!event || event.status !== "PUBLISHED") {
    return { error: "Event not available" };
  }
  const now = new Date();
  if (event.startAt <= now) {
    return { error: "Event has already taken place" };
  }
  if (event.rsvpDeadline && event.rsvpDeadline <= now) {
    return { error: "RSVP deadline has passed" };
  }
  if (guestCount > event.maxGuestsPerRsvp) {
    return {
      error: `At most ${event.maxGuestsPerRsvp} guest${event.maxGuestsPerRsvp === 1 ? "" : "s"} allowed per RSVP`,
    };
  }

  // Compute waitlisted
  let waitlisted = false;
  if (response === "YES" && event.capacity !== null) {
    const headcountAgg = await db.alumniEventRsvp.aggregate({
      where: {
        eventId,
        response: "YES",
        waitlisted: false,
        NOT: { alumniProfileId },  // exclude self
      },
      _count: { _all: true },
      _sum: { guestCount: true },
    });
    const currentHeadcount =
      (headcountAgg._count._all ?? 0) + (headcountAgg._sum.guestCount ?? 0);
    const newIncoming = 1 + guestCount;
    if (currentHeadcount + newIncoming > event.capacity) {
      waitlisted = true;
    }
  }

  // Detect create vs update for audit action label
  const previous = await db.alumniEventRsvp.findUnique({
    where: { eventId_alumniProfileId: { eventId, alumniProfileId } },
  });

  const rsvp = await db.alumniEventRsvp.upsert({
    where: { eventId_alumniProfileId: { eventId, alumniProfileId } },
    create: {
      eventId,
      alumniProfileId,
      response,
      guestCount,
      waitlisted,
    },
    update: {
      response,
      guestCount,
      waitlisted,
      respondedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: previous ? "UPDATE" : "CREATE",
    entity: "AlumniEventRsvp",
    entityId: rsvp.id,
    module: "alumni",
    description: previous
      ? `Alumnus updated RSVP: ${response}`
      : `Alumnus submitted RSVP: ${response}`,
    previousData: previous,
    newData: rsvp,
  });

  return { data: rsvp };
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/alumni-events/alumni-events.test.ts`
  Expected: all tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/alumni-events/actions/alumni-events.action.ts tests/unit/modules/alumni-events/alumni-events.test.ts
git commit -m "feat(alumni-events): alumni-side actions (list/detail/upsertRSVP)"
```

---

## Task 7: Admin list page + sidebar nav

**Files:**
- Create: `src/app/(dashboard)/graduation/alumni-events/page.tsx`
- Create: `src/app/(dashboard)/graduation/alumni-events/events-list-client.tsx`
- Create: `src/app/(dashboard)/graduation/alumni-events/event-form-modal.tsx`
- Modify: `src/lib/navigation.ts`

### Step 1: Create page.tsx

Create `src/app/(dashboard)/graduation/alumni-events/page.tsx`:

```tsx
import { getAlumniEventListAction } from "@/modules/alumni-events/actions/admin-events.action";
import { EventsListClient } from "./events-list-client";

export default async function AlumniEventsPage() {
  const result = await getAlumniEventListAction({ page: 1, pageSize: 20 });
  if ("error" in result) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }
  return (
    <EventsListClient
      initialRows={result.data}
      initialPagination={result.pagination}
    />
  );
}
```

### Step 2: Create events-list-client.tsx

Create `src/app/(dashboard)/graduation/alumni-events/events-list-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  getAlumniEventListAction,
  publishAlumniEventAction,
  cancelAlumniEventAction,
} from "@/modules/alumni-events/actions/admin-events.action";
import { EventFormModal } from "./event-form-modal";

type Row = {
  id: string;
  title: string;
  startAt: Date | string;
  status: "DRAFT" | "PUBLISHED" | "CANCELED";
  capacity: number | null;
  yesCount: number;
  noCount: number;
  maybeCount: number;
  confirmedHeadcount: number;
  waitlistHeadcount: number;
  createdByUserId: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type StatusFilter = "all" | "DRAFT" | "PUBLISHED" | "CANCELED";

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventsListClient({
  initialRows,
  initialPagination,
}: {
  initialRows: Row[];
  initialPagination: Pagination;
}) {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [creatingNew, setCreatingNew] = useState(false);

  function load(page: number, status: StatusFilter = statusFilter) {
    start(async () => {
      const res = await getAlumniEventListAction({
        status: status === "all" ? undefined : status,
        page,
        pageSize: 20,
      });
      if ("data" in res) {
        setRows(res.data as Row[]);
        setPagination(res.pagination);
      }
    });
  }

  function handlePublish(id: string) {
    if (!window.confirm("Publish this event? This will email all alumni in the school.")) return;
    start(async () => {
      const res = await publishAlumniEventAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Event published.");
      load(pagination.page);
    });
  }

  function handleCancel(id: string) {
    if (!window.confirm("Cancel this event? Existing RSVPs will be preserved.")) return;
    start(async () => {
      const res = await cancelAlumniEventAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Event canceled.");
      load(pagination.page);
    });
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Alumni events</h1>
        <button
          onClick={() => setCreatingNew(true)}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm"
        >
          + New event
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "DRAFT", "PUBLISHED", "CANCELED"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              load(1, s);
            }}
            className={`px-3 py-1.5 rounded-full text-xs ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Start</th>
              <th className="p-3 text-left">YES</th>
              <th className="p-3 text-left">Headcount</th>
              <th className="p-3 text-left">Waitlist</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No alumni events. Click &quot;+ New event&quot; to create your first.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                  <td className="p-3">
                    <Link
                      href={`/graduation/alumni-events/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.status === "PUBLISHED"
                          ? "bg-green-100 text-green-800"
                          : r.status === "DRAFT"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3">{formatDate(r.startAt)}</td>
                  <td className="p-3">{r.yesCount}</td>
                  <td className="p-3">
                    {r.confirmedHeadcount}
                    {r.capacity ? ` / ${r.capacity}` : ""}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {r.waitlistHeadcount > 0 ? r.waitlistHeadcount : "—"}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    {r.status === "DRAFT" && (
                      <button
                        onClick={() => handlePublish(r.id)}
                        disabled={pending}
                        className="text-xs text-primary hover:underline"
                      >
                        Publish
                      </button>
                    )}
                    {r.status === "PUBLISHED" && (
                      <button
                        onClick={() => handleCancel(r.id)}
                        disabled={pending}
                        className="text-xs text-destructive hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => load(pagination.page - 1)}
              disabled={pagination.page <= 1 || pending}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => load(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || pending}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {creatingNew && (
        <EventFormModal
          mode="create"
          onClose={() => setCreatingNew(false)}
          onSaved={() => {
            setCreatingNew(false);
            load(pagination.page);
          }}
        />
      )}
    </div>
  );
}
```

### Step 3: Create event-form-modal.tsx

Create `src/app/(dashboard)/graduation/alumni-events/event-form-modal.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createAlumniEventDraftAction,
  updateAlumniEventAction,
} from "@/modules/alumni-events/actions/admin-events.action";

type EventValues = {
  id?: string;
  title: string;
  description: string;
  startAt: string;  // ISO local datetime
  endAt: string;
  location: string;
  virtualLink: string;
  capacity: string;
  maxGuestsPerRsvp: number;
  rsvpDeadline: string;
};

const blankValues: EventValues = {
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  location: "",
  virtualLink: "",
  capacity: "",
  maxGuestsPerRsvp: 0,
  rsvpDeadline: "",
};

export function EventFormModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: Partial<EventValues>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState<EventValues>({ ...blankValues, ...initial });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        startAt: new Date(form.startAt),
        endAt: form.endAt ? new Date(form.endAt) : null,
        location: form.location || null,
        virtualLink: form.virtualLink || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        maxGuestsPerRsvp: form.maxGuestsPerRsvp,
        rsvpDeadline: form.rsvpDeadline ? new Date(form.rsvpDeadline) : null,
      };

      const res =
        mode === "create"
          ? await createAlumniEventDraftAction(payload)
          : await updateAlumniEventAction(form.id!, payload);

      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(mode === "create" ? "Draft created." : "Event updated.");
      onSaved();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl bg-card p-6 space-y-3 max-h-[85vh] overflow-auto"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "New alumni event" : "Edit alumni event"}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground">
            ✕
          </button>
        </div>

        <Field
          label="Title *"
          value={form.title}
          onChange={(v) => setForm({ ...form, title: v })}
        />

        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            maxLength={5000}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Start *"
            type="datetime-local"
            value={form.startAt}
            onChange={(v) => setForm({ ...form, startAt: v })}
          />
          <Field
            label="End (optional)"
            type="datetime-local"
            value={form.endAt}
            onChange={(v) => setForm({ ...form, endAt: v })}
          />
        </div>

        <Field
          label="Location"
          value={form.location}
          onChange={(v) => setForm({ ...form, location: v })}
        />
        <Field
          label="Virtual link"
          type="url"
          value={form.virtualLink}
          onChange={(v) => setForm({ ...form, virtualLink: v })}
          placeholder="https://..."
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Capacity"
            type="number"
            value={form.capacity}
            onChange={(v) => setForm({ ...form, capacity: v })}
            placeholder="Leave blank for unlimited"
          />
          <label className="block">
            <span className="text-sm font-medium">Max guests per RSVP</span>
            <input
              type="number"
              min={0}
              value={form.maxGuestsPerRsvp}
              onChange={(e) =>
                setForm({ ...form, maxGuestsPerRsvp: Number(e.target.value) || 0 })
              }
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <Field
          label="RSVP deadline"
          type="datetime-local"
          value={form.rsvpDeadline}
          onChange={(v) => setForm({ ...form, rsvpDeadline: v })}
        />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
          >
            {pending ? "Saving…" : mode === "create" ? "Create draft" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
```

### Step 4: Add sidebar nav entry

Open `src/lib/navigation.ts`. Find the existing alumni-related entry (e.g., "Alumni" linked to `/graduation/alumni` from sub-project A). Add immediately after it:

```ts
{
  label: "Alumni events",
  href: "/graduation/alumni-events",
  icon: "CalendarDays",
  permission: PERMISSIONS.GRADUATION_READ,
}
```

Match the existing entry shape (the actual TypeScript shape may differ — read the file first and adapt).

### Step 5: Verify

- [ ] Run: `rm -rf .next/dev && npx tsc --noEmit`
  Expected: clean.

### Step 6: Commit

```bash
git add "src/app/(dashboard)/graduation/alumni-events/" src/lib/navigation.ts
git commit -m "feat(alumni-events): admin list page + form modal + sidebar nav"
```

---

## Task 8: Admin detail page

**Files:**
- Create: `src/app/(dashboard)/graduation/alumni-events/[id]/page.tsx`
- Create: `src/app/(dashboard)/graduation/alumni-events/[id]/event-detail-client.tsx`

### Step 1: Create page.tsx

Create `src/app/(dashboard)/graduation/alumni-events/[id]/page.tsx`:

```tsx
import { getAlumniEventDetailAction } from "@/modules/alumni-events/actions/admin-events.action";
import { EventDetailClient } from "./event-detail-client";

export default async function AlumniEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getAlumniEventDetailAction(id);
  if ("error" in result) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }
  return <EventDetailClient event={result.data.event} rsvps={result.data.rsvps} />;
}
```

### Step 2: Create event-detail-client.tsx

Create `src/app/(dashboard)/graduation/alumni-events/[id]/event-detail-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  publishAlumniEventAction,
  cancelAlumniEventAction,
} from "@/modules/alumni-events/actions/admin-events.action";
import { EventFormModal } from "../event-form-modal";

type Event = {
  id: string;
  schoolId: string;
  title: string;
  description: string | null;
  startAt: Date | string;
  endAt: Date | string | null;
  location: string | null;
  virtualLink: string | null;
  capacity: number | null;
  maxGuestsPerRsvp: number;
  rsvpDeadline: Date | string | null;
  status: "DRAFT" | "PUBLISHED" | "CANCELED";
  publishedAt: Date | string | null;
  canceledAt: Date | string | null;
};

type RsvpRow = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  graduationYear: number;
  currentEmployer: string | null;
  response: "YES" | "NO" | "MAYBE";
  guestCount: number;
  waitlisted: boolean;
  respondedAt: Date | string;
};

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateInputFormat(d: Date | string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().slice(0, 16);
}

export function EventDetailClient({
  event,
  rsvps,
}: {
  event: Event;
  rsvps: RsvpRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);

  const yesCount = rsvps.filter((r) => r.response === "YES" && !r.waitlisted).length;
  const waitlistCount = rsvps.filter((r) => r.response === "YES" && r.waitlisted).length;
  const confirmedHeadcount = rsvps
    .filter((r) => r.response === "YES" && !r.waitlisted)
    .reduce((acc, r) => acc + 1 + r.guestCount, 0);

  function handlePublish() {
    if (!window.confirm("Publish this event? This will email all alumni in the school.")) return;
    start(async () => {
      const res = await publishAlumniEventAction(event.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Event published.");
      router.refresh();
    });
  }

  function handleCancel() {
    if (!window.confirm("Cancel this event? Existing RSVPs will be preserved.")) return;
    start(async () => {
      const res = await cancelAlumniEventAction(event.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Event canceled.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 p-6">
      <header className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{event.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(event.startAt)}
              {event.endAt ? ` — ${formatDate(event.endAt)}` : ""}
            </p>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              event.status === "PUBLISHED"
                ? "bg-green-100 text-green-800"
                : event.status === "DRAFT"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {event.status}
          </span>
        </div>

        {event.location && (
          <p className="text-sm">📍 {event.location}</p>
        )}
        {event.virtualLink && (
          <p className="text-sm">
            💻{" "}
            <a
              href={event.virtualLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {event.virtualLink}
            </a>
          </p>
        )}
        {event.description && (
          <p className="text-sm whitespace-pre-wrap">{event.description}</p>
        )}

        {event.capacity !== null && (
          <div>
            <p className="text-xs text-muted-foreground">
              {confirmedHeadcount} / {event.capacity} confirmed
              {waitlistCount > 0 ? ` · ${waitlistCount} waitlisted` : ""}
            </p>
            <div className="w-full h-2 bg-muted rounded-full mt-1">
              <div
                className="h-2 bg-primary rounded-full"
                style={{
                  width: `${Math.min(100, (confirmedHeadcount / event.capacity) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {event.status === "DRAFT" && (
            <>
              <button
                onClick={handlePublish}
                disabled={pending}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
              >
                Publish
              </button>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Edit
              </button>
            </>
          )}
          {event.status === "PUBLISHED" && (
            <>
              <button
                onClick={handleCancel}
                disabled={pending}
                className="rounded-lg border border-red-300 text-red-700 px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel event
              </button>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Edit
              </button>
            </>
          )}
          {event.status === "CANCELED" && (
            <p className="text-sm text-muted-foreground">
              Canceled on {formatDate(event.canceledAt)}
            </p>
          )}
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">RSVPs ({rsvps.length})</h2>
          <button
            onClick={() => downloadCsv(rsvps, event.title)}
            className="text-xs text-primary hover:underline"
          >
            Download CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Class</th>
              <th className="p-3 text-left">Response</th>
              <th className="p-3 text-left">Guests</th>
              <th className="p-3 text-left">Responded</th>
            </tr>
          </thead>
          <tbody>
            {rsvps.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No RSVPs yet.
                </td>
              </tr>
            ) : (
              rsvps.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-medium">
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="p-3 text-muted-foreground">Class of {r.graduationYear}</td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.response === "YES"
                          ? "bg-green-100 text-green-800"
                          : r.response === "MAYBE"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.response}
                    </span>
                    {r.waitlisted && (
                      <span className="ml-1 text-xs text-muted-foreground">(waitlist)</span>
                    )}
                  </td>
                  <td className="p-3">{r.guestCount}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(r.respondedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EventFormModal
          mode="edit"
          initial={{
            id: event.id,
            title: event.title,
            description: event.description ?? "",
            startAt: toDateInputFormat(event.startAt),
            endAt: toDateInputFormat(event.endAt),
            location: event.location ?? "",
            virtualLink: event.virtualLink ?? "",
            capacity: event.capacity?.toString() ?? "",
            maxGuestsPerRsvp: event.maxGuestsPerRsvp,
            rsvpDeadline: toDateInputFormat(event.rsvpDeadline),
          }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function downloadCsv(rsvps: RsvpRow[], eventTitle: string) {
  const csv = [
    "Name,Class,Response,Guests,Waitlisted,RespondedAt",
    ...rsvps.map((r) =>
      [
        JSON.stringify(`${r.firstName} ${r.lastName}`),
        r.graduationYear,
        r.response,
        r.guestCount,
        r.waitlisted,
        new Date(r.respondedAt).toISOString(),
      ].join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rsvps-${eventTitle.replace(/[^a-z0-9]/gi, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Step 3: Verify

- [ ] Run: `rm -rf .next/dev && npx tsc --noEmit`
  Expected: clean.

### Step 4: Commit

```bash
git add "src/app/(dashboard)/graduation/alumni-events/[id]/"
git commit -m "feat(alumni-events): admin detail page (RSVP table + publish/cancel + CSV)"
```

---

## Task 9: Alumni list page + portal nav

**Files:**
- Create: `src/app/(portal)/alumni/events/page.tsx`
- Create: `src/app/(portal)/alumni/events/events-list-client.tsx`
- Modify: `src/app/(portal)/portal-nav.tsx`

### Step 1: Create page.tsx

Create `src/app/(portal)/alumni/events/page.tsx`:

```tsx
import { getMyAlumniEventsAction } from "@/modules/alumni-events/actions/alumni-events.action";
import { EventsListClient } from "./events-list-client";

export default async function AlumniEventsPage() {
  const result = await getMyAlumniEventsAction({ tab: "upcoming" });
  if ("error" in result) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-xl">
        <p className="text-sm text-gray-500">{result.error}</p>
      </div>
    );
  }
  return <EventsListClient initialRows={result.data} />;
}
```

### Step 2: Create events-list-client.tsx

Create `src/app/(portal)/alumni/events/events-list-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getMyAlumniEventsAction } from "@/modules/alumni-events/actions/alumni-events.action";

type Row = {
  id: string;
  title: string;
  startAt: Date | string;
  endAt: Date | string | null;
  location: string | null;
  virtualLink: string | null;
  status: "DRAFT" | "PUBLISHED" | "CANCELED";
  capacity: number | null;
  confirmedHeadcount: number;
  myRsvp: { response: "YES" | "NO" | "MAYBE"; guestCount: number; waitlisted: boolean } | null;
};

type Tab = "upcoming" | "past";

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function rsvpLabel(myRsvp: Row["myRsvp"]): string {
  if (!myRsvp) return "Not responded";
  if (myRsvp.response === "YES") {
    if (myRsvp.guestCount > 0) {
      return `YES — bringing ${myRsvp.guestCount} guest${myRsvp.guestCount === 1 ? "" : "s"}`;
    }
    return "YES";
  }
  return myRsvp.response;
}

export function EventsListClient({ initialRows }: { initialRows: Row[] }) {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [tab, setTab] = useState<Tab>("upcoming");

  function switchTab(newTab: Tab) {
    setTab(newTab);
    start(async () => {
      const res = await getMyAlumniEventsAction({ tab: newTab });
      if ("data" in res) setRows(res.data as Row[]);
    });
  }

  const isPast = tab === "past";

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">Alumni events</h1>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => switchTab("upcoming")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "upcoming"
              ? "border-b-2 border-teal-600 text-teal-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => switchTab("past")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "past"
              ? "border-b-2 border-teal-600 text-teal-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Past
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          {tab === "upcoming"
            ? "No upcoming alumni events. Check back soon."
            : "No past events to show."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((r) => {
            const locationSummary = r.virtualLink
              ? r.location
                ? "Online + venue"
                : "Online"
              : r.location ?? "Location TBA";
            const fillingUp =
              r.capacity !== null && r.confirmedHeadcount >= r.capacity * 0.8;
            const full = r.capacity !== null && r.confirmedHeadcount >= r.capacity;
            return (
              <Link
                key={r.id}
                href={`/alumni/events/${r.id}`}
                className={`rounded-xl border p-4 hover:bg-gray-50 ${
                  isPast ? "border-gray-200 bg-white opacity-70" : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{r.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(r.startAt)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{locationSummary}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                      r.myRsvp?.response === "YES"
                        ? "bg-green-100 text-green-800"
                        : r.myRsvp?.response === "MAYBE"
                          ? "bg-yellow-100 text-yellow-800"
                          : r.myRsvp?.response === "NO"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {rsvpLabel(r.myRsvp)}
                  </span>
                </div>
                {!isPast && full && (
                  <p className="mt-2 text-xs text-yellow-700">Waitlist only</p>
                )}
                {!isPast && !full && fillingUp && (
                  <p className="mt-2 text-xs text-yellow-700">Filling up</p>
                )}
                {r.status === "CANCELED" && (
                  <p className="mt-2 text-xs text-red-600">Canceled</p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {pending && <p className="text-xs text-gray-500">Loading…</p>}
    </div>
  );
}
```

### Step 3: Add "Events" to the alumni portal nav

Open `src/app/(portal)/portal-nav.tsx`. Find the existing `alumniLinks` array (added in sub-project A's Task 6, containing the "My Profile" + "Directory" entries). Insert "Events" between Profile and Directory:

```ts
const alumniLinks = [
  { href: "/alumni/profile", label: "My Profile" },
  { href: "/alumni/events", label: "Events" },
  { href: "/alumni/directory", label: "Directory" },
];
```

### Step 4: Verify

- [ ] Run: `rm -rf .next/dev && npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add "src/app/(portal)/alumni/events/" "src/app/(portal)/portal-nav.tsx"
git commit -m "feat(alumni-events): alumni list page + portal nav entry"
```

---

## Task 10: Alumni detail page

**Files:**
- Create: `src/app/(portal)/alumni/events/[eventId]/page.tsx`
- Create: `src/app/(portal)/alumni/events/[eventId]/event-detail-client.tsx`

### Step 1: Create page.tsx

Create `src/app/(portal)/alumni/events/[eventId]/page.tsx`:

```tsx
import { getMyAlumniEventDetailAction } from "@/modules/alumni-events/actions/alumni-events.action";
import { EventDetailClient } from "./event-detail-client";

export default async function AlumniEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const result = await getMyAlumniEventDetailAction(eventId);
  if ("error" in result) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-xl">
        <p className="text-sm text-gray-500">{result.error}</p>
      </div>
    );
  }
  return <EventDetailClient event={result.data.event} myRsvp={result.data.myRsvp} />;
}
```

### Step 2: Create event-detail-client.tsx

Create `src/app/(portal)/alumni/events/[eventId]/event-detail-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertMyEventRsvpAction } from "@/modules/alumni-events/actions/alumni-events.action";

type Event = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date | string;
  endAt: Date | string | null;
  location: string | null;
  virtualLink: string | null;
  capacity: number | null;
  maxGuestsPerRsvp: number;
  rsvpDeadline: Date | string | null;
  status: "DRAFT" | "PUBLISHED" | "CANCELED";
};

type MyRsvp = {
  response: "YES" | "NO" | "MAYBE";
  guestCount: number;
  waitlisted: boolean;
} | null;

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventDetailClient({
  event,
  myRsvp: initialMyRsvp,
}: {
  event: Event;
  myRsvp: MyRsvp;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [response, setResponse] = useState<"YES" | "NO" | "MAYBE">(
    initialMyRsvp?.response ?? "YES",
  );
  const [guestCount, setGuestCount] = useState<number>(initialMyRsvp?.guestCount ?? 0);
  const [myRsvp, setMyRsvp] = useState<MyRsvp>(initialMyRsvp);

  const now = new Date();
  const isCanceled = event.status === "CANCELED";
  const deadlinePassed = event.rsvpDeadline && new Date(event.rsvpDeadline) <= now;
  const eventStarted = new Date(event.startAt) <= now;
  const locked = isCanceled || deadlinePassed || eventStarted;

  function handleSubmit() {
    start(async () => {
      const res = await upsertMyEventRsvpAction({
        eventId: event.id,
        response,
        guestCount: response === "YES" ? guestCount : 0,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("RSVP saved.");
      setMyRsvp({
        response: res.data.response as "YES" | "NO" | "MAYBE",
        guestCount: res.data.guestCount,
        waitlisted: res.data.waitlisted,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <p className="text-sm text-gray-700">
          {formatDate(event.startAt)}
          {event.endAt ? ` — ${formatDate(event.endAt)}` : ""}
        </p>
        {event.location && <p className="text-sm">📍 {event.location}</p>}
        {event.virtualLink && (
          <p className="text-sm">
            💻{" "}
            <a
              href={event.virtualLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-700 hover:underline"
            >
              Join meeting
            </a>
          </p>
        )}
        {event.description && (
          <p className="text-sm whitespace-pre-wrap">{event.description}</p>
        )}
      </header>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold">Your RSVP</h2>

        {isCanceled ? (
          <p className="text-sm text-red-700">This event was canceled by the school.</p>
        ) : deadlinePassed ? (
          <p className="text-sm text-gray-700">
            RSVP closed on {formatDate(event.rsvpDeadline)}.
            {myRsvp && (
              <>
                {" "}You said: <strong>{myRsvp.response}</strong>
                {myRsvp.guestCount > 0 ? ` (with ${myRsvp.guestCount} guest${myRsvp.guestCount === 1 ? "" : "s"})` : ""}.
              </>
            )}
          </p>
        ) : eventStarted ? (
          <p className="text-sm text-gray-700">
            Event has already taken place.
            {myRsvp && (
              <>
                {" "}You said: <strong>{myRsvp.response}</strong>.
              </>
            )}
          </p>
        ) : (
          <>
            <div className="flex gap-3">
              {(["YES", "NO", "MAYBE"] as const).map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="response"
                    value={r}
                    checked={response === r}
                    onChange={() => setResponse(r)}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            {response === "YES" && event.maxGuestsPerRsvp > 0 && (
              <label className="block">
                <span className="text-sm font-medium">Number of guests</span>
                <input
                  type="number"
                  min={0}
                  max={event.maxGuestsPerRsvp}
                  value={guestCount}
                  onChange={(e) =>
                    setGuestCount(
                      Math.min(
                        event.maxGuestsPerRsvp,
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    )
                  }
                  className="mt-1 w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                />
                <span className="ml-2 text-xs text-gray-500">
                  Up to {event.maxGuestsPerRsvp}
                </span>
              </label>
            )}

            {myRsvp?.waitlisted && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                This event is at capacity. You&apos;re on the waitlist; the school will let you know if a spot opens.
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={pending || locked}
              className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-sm disabled:opacity-50"
            >
              {pending ? "Saving…" : myRsvp ? "Update RSVP" : "Save RSVP"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

### Step 3: Verify

- [ ] Run: `rm -rf .next/dev && npx tsc --noEmit`
  Expected: clean.

### Step 4: Commit

```bash
git add "src/app/(portal)/alumni/events/[eventId]/"
git commit -m "feat(alumni-events): alumni detail page (RSVP form + locked states)"
```

---

## Task 11: Integration test (live DB)

**Files:**
- Create: `tests/integration/students/alumni-events.test.ts`

### Step 1: Read the precedent

Read `tests/integration/students/alumni-lifecycle.test.ts` (sub-project A) for the fixture-seeding pattern (User + UserRole + UserSchool, Programme + Class + ClassArm, AcademicYear + Term, Student + Enrollment, GraduationBatch + GraduationRecord, AlumniProfile create + role flip).

### Step 2: Write the integration test

Create `tests/integration/students/alumni-events.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolveSeededAdminId, loginAs } from "./setup";
import {
  createAlumniEventDraftAction,
  publishAlumniEventAction,
  cancelAlumniEventAction,
} from "@/modules/alumni-events/actions/admin-events.action";
import {
  upsertMyEventRsvpAction,
  getMyAlumniEventsAction,
} from "@/modules/alumni-events/actions/alumni-events.action";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Alumni events (integration)", () => {
  const db = new PrismaClient();
  const tag = `events-test-${Date.now()}`;

  let adminId: string;
  let schoolId: string;
  let userId1: string;
  let userId2: string;
  let alumniProfileId1: string;
  let alumniProfileId2: string;
  let studentId1: string;
  let studentId2: string;
  let eventId = "";

  async function cleanupSeedData() {
    if (eventId) {
      await db.alumniEventRsvp.deleteMany({ where: { eventId } }).catch(() => {});
      await db.alumniEvent.delete({ where: { id: eventId } }).catch(() => {});
    }
    await db.alumniEvent.deleteMany({ where: { title: { contains: tag } } }).catch(() => {});
    if (alumniProfileId1) await db.alumniProfile.deleteMany({ where: { id: { in: [alumniProfileId1, alumniProfileId2].filter(Boolean) } } }).catch(() => {});
    await db.userRole.deleteMany({ where: { userId: { in: [userId1, userId2].filter(Boolean) } } }).catch(() => {});
    await db.student.deleteMany({ where: { id: { in: [studentId1, studentId2].filter(Boolean) } } }).catch(() => {});
    await db.userSchool.deleteMany({ where: { userId: { in: [userId1, userId2].filter(Boolean) } } }).catch(() => {});
    await db.user.deleteMany({ where: { id: { in: [userId1, userId2].filter(Boolean) } } }).catch(() => {});
  }

  beforeAll(async () => {
    try {
      adminId = await resolveSeededAdminId();
      const admin = await db.user.findUnique({
        where: { id: adminId },
        include: { userSchools: { take: 1 } },
      });
      schoolId = admin!.userSchools[0].schoolId;

      const alumniRole = await db.role.findUnique({ where: { name: "alumni" } });
      if (!alumniRole) throw new Error("alumni role not seeded");

      // Alumnus 1
      const u1 = await db.user.create({
        data: {
          email: `alum1-${tag}@test.local`,
          username: `alum1-${tag}`,
          passwordHash: await bcrypt.hash("test123", 10),
          firstName: "Kofi",
          lastName: "Asante",
        },
      });
      userId1 = u1.id;
      await db.userRole.create({ data: { userId: u1.id, roleId: alumniRole.id } });
      await db.userSchool.create({ data: { userId: u1.id, schoolId, isActive: true } });

      const s1 = await db.student.create({
        data: {
          studentId: `${tag}-S1`,
          firstName: "Kofi",
          lastName: "Asante",
          gender: "MALE",
          dateOfBirth: new Date("2000-01-01"),
          status: "GRADUATED",
          schoolId,
          userId: u1.id,
        },
      });
      studentId1 = s1.id;

      const ap1 = await db.alumniProfile.create({
        data: {
          studentId: s1.id,
          schoolId,
          graduationYear: 2024,
          isPublic: false,
        },
      });
      alumniProfileId1 = ap1.id;

      // Alumnus 2
      const u2 = await db.user.create({
        data: {
          email: `alum2-${tag}@test.local`,
          username: `alum2-${tag}`,
          passwordHash: await bcrypt.hash("test123", 10),
          firstName: "Akua",
          lastName: "Mensah",
        },
      });
      userId2 = u2.id;
      await db.userRole.create({ data: { userId: u2.id, roleId: alumniRole.id } });
      await db.userSchool.create({ data: { userId: u2.id, schoolId, isActive: true } });

      const s2 = await db.student.create({
        data: {
          studentId: `${tag}-S2`,
          firstName: "Akua",
          lastName: "Mensah",
          gender: "FEMALE",
          dateOfBirth: new Date("2000-02-01"),
          status: "GRADUATED",
          schoolId,
          userId: u2.id,
        },
      });
      studentId2 = s2.id;

      const ap2 = await db.alumniProfile.create({
        data: {
          studentId: s2.id,
          schoolId,
          graduationYear: 2024,
          isPublic: false,
        },
      });
      alumniProfileId2 = ap2.id;
    } catch (e) {
      await cleanupSeedData();
      throw e;
    }
  }, 60_000);

  afterAll(async () => {
    await cleanupSeedData();
    await db.$disconnect();
  }, 60_000);

  it("admin creates draft → publishes → alumnus 1 RSVPs YES", async () => {
    loginAs({ id: adminId, schoolId: "default-school" });
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const created = await createAlumniEventDraftAction({
      title: `${tag}-event-1`,
      startAt: future,
      maxGuestsPerRsvp: 2,
    });
    if (!("data" in created)) throw new Error((created as { error: string }).error);
    eventId = created.data.id;
    expect(created.data.status).toBe("DRAFT");

    const published = await publishAlumniEventAction(eventId);
    if (!("data" in published)) throw new Error((published as { error: string }).error);
    expect(published.data.status).toBe("PUBLISHED");

    loginAs({
      id: userId1,
      schoolId: "default-school",
      permissions: ["alumni:events:read", "alumni:events:rsvp"],
    });
    const rsvp = await upsertMyEventRsvpAction({
      eventId,
      response: "YES",
      guestCount: 1,
    });
    if (!("data" in rsvp)) throw new Error((rsvp as { error: string }).error);
    expect(rsvp.data.response).toBe("YES");
    expect(rsvp.data.guestCount).toBe(1);
    expect(rsvp.data.waitlisted).toBe(false);
  });

  it("admin cancels event → RSVP preserved + new RSVPs rejected", async () => {
    loginAs({ id: adminId, schoolId: "default-school" });
    const canceled = await cancelAlumniEventAction(eventId);
    if (!("data" in canceled)) throw new Error((canceled as { error: string }).error);
    expect(canceled.data.status).toBe("CANCELED");

    const existing = await db.alumniEventRsvp.findFirst({
      where: { eventId, alumniProfileId: alumniProfileId1 },
    });
    expect(existing).not.toBeNull();
    expect(existing!.response).toBe("YES");

    loginAs({
      id: userId2,
      schoolId: "default-school",
      permissions: ["alumni:events:read", "alumni:events:rsvp"],
    });
    const rejected = await upsertMyEventRsvpAction({
      eventId,
      response: "YES",
      guestCount: 0,
    });
    expect("error" in rejected).toBe(true);
  });

  it("capacity=2 — first YES non-waitlisted, second YES waitlisted", async () => {
    loginAs({ id: adminId, schoolId: "default-school" });
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const created = await createAlumniEventDraftAction({
      title: `${tag}-event-2`,
      startAt: future,
      capacity: 2,
      maxGuestsPerRsvp: 2,
    });
    if (!("data" in created)) throw new Error((created as { error: string }).error);
    const ev2Id = created.data.id;

    await publishAlumniEventAction(ev2Id);

    loginAs({
      id: userId1,
      schoolId: "default-school",
      permissions: ["alumni:events:read", "alumni:events:rsvp"],
    });
    const r1 = await upsertMyEventRsvpAction({
      eventId: ev2Id,
      response: "YES",
      guestCount: 1,
    });
    if (!("data" in r1)) throw new Error((r1 as { error: string }).error);
    expect(r1.data.waitlisted).toBe(false);  // 2 spots used, capacity 2 — fits

    loginAs({
      id: userId2,
      schoolId: "default-school",
      permissions: ["alumni:events:read", "alumni:events:rsvp"],
    });
    const r2 = await upsertMyEventRsvpAction({
      eventId: ev2Id,
      response: "YES",
      guestCount: 0,
    });
    if (!("data" in r2)) throw new Error((r2 as { error: string }).error);
    expect(r2.data.waitlisted).toBe(true);  // would be 3 spots used, exceeds 2

    await db.alumniEvent.delete({ where: { id: ev2Id } }).catch(() => {});
  });

  it("getMyAlumniEventsAction returns own RSVP joined to event", async () => {
    loginAs({
      id: userId1,
      schoolId: "default-school",
      permissions: ["alumni:events:read", "alumni:events:rsvp"],
    });
    const past = await getMyAlumniEventsAction({ tab: "past" });
    if (!("data" in past)) throw new Error((past as { error: string }).error);
    // The first event is now in the past (canceled). Should appear in past tab.
    const found = past.data.find((e) => e.id === eventId);
    expect(found).toBeDefined();
    expect(found?.status).toBe("CANCELED");
    expect(found?.myRsvp?.response).toBe("YES");
  });

  it("tenant isolation: forged-school query returns null", async () => {
    const sneaky = await db.alumniEvent.findFirst({
      where: { id: eventId, schoolId: "OTHER-SCHOOL" },
    });
    expect(sneaky).toBeNull();
  });
});
```

### Step 3: Run

- [ ] Run: `npm run test:students`
  Expected: 5 new tests pass + existing integration tests still pass. (If Postgres unreachable in dev env, tests skip per the `describeIfDb` guard.)

### Step 4: Commit

```bash
git add tests/integration/students/alumni-events.test.ts
git commit -m "test(alumni-events): live-DB integration coverage"
```

---

## Task 12: End-to-end verification

**Files:** verification only.

### Step 1: Full unit suite

- [ ] Run: `npx vitest run`
  Expected: all passing.

### Step 2: Integration suite

- [ ] Run: `npm run test:students`
  Expected: all passing or skipped per env.

### Step 3: Audit guardrail (if it exists)

- [ ] Run: `npx vitest run tests/unit/guardrails/audit-coverage.test.ts`
  Expected: passing. Mutating actions (create/update/publish/cancel/upsertRsvp) carry `audit()`. Read actions tagged `@no-audit`.

### Step 4: TypeScript

- [ ] Run: `rm -rf .next/dev && npx tsc --noEmit`
  Expected: clean.

### Step 5: Build

- [ ] Run: `npm run build`
  Expected: success. Confirm new routes compile:
  - `/alumni/events`
  - `/alumni/events/[eventId]`
  - `/graduation/alumni-events`
  - `/graduation/alumni-events/[id]`

### Step 6: Lint

- [ ] Run: `npm run lint`
  Expected: 0 errors.

### Step 7: Prisma status

- [ ] Run: `npx prisma migrate status`
  Expected: up to date (new migration applied).

### Step 8: Manual UI walk (deferred — for human tester)

Document but don't execute:
1. Create draft event as admin → publish → alumni receive notification.
2. Alumnus logs in → `/alumni/events` shows the published event → click → RSVP YES with 1 guest → save → toast.
3. Admin opens detail page → sees the alumnus in YES section with guest count.
4. Admin cancels event → alumnus sees "canceled" banner; can no longer change RSVP.
5. Create capacity-2 event → 3 alumni RSVP YES → 3rd is waitlisted; alumni see yellow banner.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Covered by |
|---|---|
| §3 user decisions Q1–Q8 | All embedded in tasks 1-12 |
| §4 architecture | Tasks 1-10 produce every file in §4.1–§4.4 |
| §5 data model + waitlist algorithm | Task 1 (schema), Task 6 (algorithm in upsertMyEventRsvpAction) |
| §6 permissions | Task 2 |
| §7 server actions | Tasks 5 (admin) + 6 (alumni) |
| §8 notifications | Task 3 |
| §9 admin UI | Tasks 7 + 8 |
| §10 alumni UI | Tasks 9 + 10 |
| §11 edge cases | Covered by tests in Tasks 5, 6, 11 |
| §12 testing strategy | Tasks 3 (notifications), 5 (admin), 6 (alumni), 11 (integration), 12 (verification) |

**2. Placeholder scan:** all task steps have concrete code, exact file paths, exact commands, expected outputs. Where the implementer must adapt to existing code shape (sidebar nav file shape, alumni-portal nav array name), the instruction explicitly says "read first then adapt".

**3. Type consistency:** `Row`, `Pagination`, `EventStats`, `MyRsvp`, `AlumniEventStatus`, `RsvpResponse` shapes consistent across tasks. Field names match the Prisma schema.
