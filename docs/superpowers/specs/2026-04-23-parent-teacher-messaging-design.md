# Parent ↔ Teacher Messaging — Design

**Date:** 2026-04-23
**Status:** Approved
**Tier:** 2 — part of item #6 (Parent Portal Upgrade). This is sub-project **B** of the four identified sub-projects.

## 1. Context

The parent portal has matured considerably: dashboard, children list, fees, results, attendance, statement, and settings pages all exist and are wired to real backend actions. The student portal has analogous surfaces plus a full exeat flow with OTP. What is conspicuously missing is teacher↔parent conversational messaging. The existing `/parent/messages` route is a literal "Coming Soon" stub (40 lines, 100% placeholder text).

This sub-project builds the in-app threaded messaging feature that replaces that stub. It layers on top of the existing `NotificationPreference` / `NotificationChannel` infrastructure (from the phase-2 offline/OTP templates migration) and the R2 storage layer used for document vault attachments.

**Explicitly out of scope** (other sub-projects of #6):
- **C** — parent-initiated workflows (excuse absence, medical disclosure updates)
- **D** — acknowledgements for circulars / report cards
- Portal UI polish and audit of other existing parent/student pages

## 2. Scope

**In scope**
- `MessageThread` + `Message` + `MessageThreadRead` + `MessageReport` models
- Eligibility rules: class_teacher and housemaster-for-boarders as the only staff; household guardians as parents
- Server actions: thread list/get/create/archive/mark-read, message post/report, moderation (report review, lock/unlock)
- Two new notification events: `MESSAGE_RECEIVED_PARENT`, `MESSAGE_RECEIVED_TEACHER`
- File attachments (1 per message, ≤ 5 MB, MIME allowlist)
- Rate limiting (10 messages/hour/author/thread)
- Per-thread unread tracking (`MessageThreadRead.lastReadAt`)
- 3 UI surfaces: parent portal `/parent/messages`, staff portal `/staff/messages`, admin review `/students/messaging`
- Student-lifecycle hooks: auto-archive on WITHDRAWN/TRANSFERRED/GRADUATED; teacher-rotation updates thread participant with a system message
- 7-year retention + hard-delete cron
- 4 new permissions

**Out of scope for this sub-project**
- Voice notes
- Rich text formatting
- Multiple attachments per message
- SMS/email digest (daily rollup) — only per-message channel fan-out based on the user's NotificationPreference
- Push notifications via dedicated service worker (we use the existing IN_APP channel)
- Subject teachers as thread participants (reserved for future expansion)

## 3. Architecture

**Approach: split by concern.** A `src/modules/messaging/` module with:
- `eligibility.ts` — pure functions (can-message logic, rate-limit calculation)
- `notifications.ts` — fan-out wrapper over existing `sendMultiChannel`
- `attachments.ts` — R2 upload/download wrapper with MIME/size enforcement
- `actions/thread.action.ts` — thread CRUD
- `actions/message.action.ts` — message post + report
- `actions/message-moderation.action.ts` — admin review + lock/unlock
- `actions/attachment.action.ts` — signed URL generators

Integration hooks modify existing files minimally:
- `src/modules/student/actions/transfer.action.ts`, `withdraw.action.ts`, `graduate.action.ts` — call `archiveThreadsForStudent` after status change
- `src/modules/student/actions/promotion.action.ts` — call `rotateTeacherOnThreads` when class_teacher changes

Data invariants (eligibility matches active assignments) are enforced at the action layer, not via DB constraint, because they span multiple tables (Class, ClassArm, House, StudentHouse, StudentGuardian).

## 4. Data Model

```prisma
model MessageThread {
  id        String            @id @default(cuid())
  schoolId  String
  studentId String
  teacherUserId String
  status    MessageThreadStatus @default(ACTIVE)
  lockedAt  DateTime?
  lockedBy  String?
  lockReason String?
  lastMessageAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  school    School  @relation("SchoolMessageThread", fields: [schoolId], references: [id])
  teacher   User    @relation("TeacherThreads", fields: [teacherUserId], references: [id])
  messages  Message[]
  reads     MessageThreadRead[]

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

  thread         MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  author         User          @relation("AuthoredMessages", fields: [authorUserId], references: [id])
  reports        MessageReport[]

  @@index([threadId, createdAt])
  @@index([authorUserId])
}

model MessageThreadRead {
  id         String   @id @default(cuid())
  threadId   String
  userId     String
  lastReadAt DateTime @default(now())

  thread     MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@unique([threadId, userId])
  @@index([userId])
}

model MessageReport {
  id               String        @id @default(cuid())
  messageId        String
  reportedByUserId String
  reason           String
  status           MessageReportStatus @default(PENDING)
  createdAt        DateTime      @default(now())
  resolvedAt       DateTime?
  resolvedByUserId String?

  message          Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([status, createdAt])
  @@index([messageId])
}

enum MessageReportStatus {
  PENDING
  DISMISSED
  ACTIONED
}
```

Migration: one schema change with the four models and enums, plus back-relation additions on `Student`, `School`, `User`.

## 5. Permissions

New constants in `src/lib/permissions.ts`:

```ts
MESSAGING_PORTAL_USE:   "messaging:portal:use",
MESSAGING_REPORT:       "messaging:reports:create",
MESSAGING_ADMIN_READ:   "messaging:admin:read",
MESSAGING_ADMIN_REVIEW: "messaging:admin:review",
```

Grants:

| Permission | Granted to |
|---|---|
| `MESSAGING_PORTAL_USE` | `parent`, `class_teacher`, `housemaster` |
| `MESSAGING_REPORT` | `parent`, `class_teacher`, `housemaster` |
| `MESSAGING_ADMIN_READ` | `headmaster`, `assistant_headmaster_academic`, `assistant_headmaster_admin` |
| `MESSAGING_ADMIN_REVIEW` | `headmaster`, `assistant_headmaster_admin` |

`super_admin` inherits all via `ALL_PERMISSIONS`.

Eligibility (who can post in which thread) is NOT a permission — it's a domain rule computed in `eligibility.ts` at action time.

## 6. Pure Eligibility Helpers

`src/modules/messaging/eligibility.ts` — no DB, no side effects:

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

export function eligibleStaffRole(
  staff: StaffAssignment,
  student: StudentContext,
): "class_teacher" | "housemaster" | null;

export function parentCanMessageAbout(
  guardianLinks: GuardianLink[],
  userId: string,
  studentId: string,
): boolean;

export function eligibleTeachersForStudent(
  student: StudentContext,
  assignments: StaffAssignment[],
): StaffAssignment[];

export function isRateLimited(
  recentMessageTimestamps: Date[],
  now?: Date,
  windowMs?: number,
  limit?: number,
): boolean;
```

Rules:
- Staff eligibility: `class_teacher` of matching `classArmId` OR `housemaster` of matching `houseId` AND `boardingStatus === "BOARDING"`. Student must be `ACTIVE` or `SUSPENDED` (suspension is precisely when parent-teacher communication is most needed). Blocked for `TRANSFERRED`, `WITHDRAWN`, `GRADUATED`.
- Parent eligibility: any household guardian with `userId === caller`. Status check piggybacks on the teacher-side rule because thread creation requires at least one eligible teacher; for existing threads, the thread-status gate (archived threads reject posts) handles lifecycle transitions.
- Rate limit: ≥ 10 messages in the last 60 minutes from the same author in the same thread.

## 7. Server Actions

All paths under `src/modules/messaging/actions/`.

### `thread.action.ts`

| Action | Permission | Purpose |
|---|---|---|
| `getMessageThreadsAction({ filters })` | `MESSAGING_PORTAL_USE` (+ `MESSAGING_ADMIN_READ` for cross-user listing) | Inbox with unread counts + last-message preview |
| `getMessageThreadAction(threadId, { limit })` | `MESSAGING_PORTAL_USE` OR `MESSAGING_ADMIN_READ` | Thread with messages; bumps `lastReadAt` for participants only |
| `createMessageThreadAction({ studentId, teacherUserId, initialBody, attachmentKey? })` | `MESSAGING_PORTAL_USE` | Idempotent — returns existing or creates; validates eligibility |
| `markThreadReadAction(threadId)` | `MESSAGING_PORTAL_USE` | Upserts `MessageThreadRead` |
| `archiveThreadAction(threadId)` | `MESSAGING_ADMIN_REVIEW` | Manually archive one thread. Separate internal helper `archiveThreadsForStudent(studentId)` (unexposed) is called by lifecycle hooks without a permission check because the lifecycle action itself is already gated. |

### `message.action.ts`

| Action | Permission | Purpose |
|---|---|---|
| `postMessageAction({ threadId, body, attachmentKey?, attachmentName?, attachmentSize?, attachmentMime? })` | `MESSAGING_PORTAL_USE` | Re-checks status + locked + eligibility + rate limit; triggers notify fan-out |
| `reportMessageAction({ messageId, reason })` | `MESSAGING_REPORT` | Creates report row; audit-logged |

### `message-moderation.action.ts`

| Action | Permission | Purpose |
|---|---|---|
| `getMessageReportsAction({ status? })` | `MESSAGING_ADMIN_REVIEW` | Admin queue |
| `resolveReportAction({ reportId, action: "DISMISS" \| "ACTION", note? })` | `MESSAGING_ADMIN_REVIEW` | Transitions report status; audit-logged |
| `lockThreadAction({ threadId, reason })` | `MESSAGING_ADMIN_REVIEW` | Sets `lockedAt`/`lockedBy`; audit-logged |
| `unlockThreadAction(threadId)` | `MESSAGING_ADMIN_REVIEW` | Clears lock; audit-logged |

### `attachment.action.ts`

| Action | Permission | Purpose |
|---|---|---|
| `getMessageAttachmentUploadUrlAction({ threadId, filename, mimeType, size })` | `MESSAGING_PORTAL_USE` + participant check | Validates MIME + size + eligibility; returns signed PUT URL (5 min) |
| `getMessageAttachmentUrlAction(messageId)` | Participant or `MESSAGING_ADMIN_READ` | Returns signed GET URL (5 min) |

### Integration hooks (modifications)

- `transfer.action.ts`, `withdraw.action.ts`, `graduate.action.ts`: call `archiveThreadsForStudent(studentId)` after status change
- `promotion.action.ts`: when class_teacher rotates on a class_arm, call `rotateTeacherOnThreadsForArm(classArmId, newTeacherUserId)` which updates `teacherUserId` and appends a system-note message

Helpers live in `src/modules/messaging/lifecycle.ts` (new file, small).

## 8. Notifications

`src/modules/messaging/notifications.ts`:

```ts
export async function notifyNewMessage(params: {
  messageId: string;
  threadId: string;
  recipientUserIds: string[];
  authorRole: "parent" | "teacher";
  studentName: string;
  authorName: string;
  bodyPreview: string;
}): Promise<void>;
```

- Reads each recipient's `NotificationPreference` for the appropriate event key; falls back to defaults
- Event keys + defaults:
  - `MESSAGE_RECEIVED_PARENT` — defaults `[IN_APP, EMAIL]`
  - `MESSAGE_RECEIVED_TEACHER` — defaults `[IN_APP]`
- Empty-channels pref = opt-out, skip
- Fires via existing `sendMultiChannel` hub
- Errors swallowed per recipient (logged, no throw)

Templates registered in the existing notification-templates system (implementer locates exact file). `bodyPreview` is the first 120 characters of the message body, with `[attachment: filename.pdf]` appended if there's a file.

Recipient resolution in `postMessageAction`:
- Author is teacher → recipients are all `User.id` of household guardians with `userId != null`
- Author is parent → recipient is `thread.teacherUserId`

## 9. Attachments

`src/modules/messaging/attachments.ts`:

- MIME allowlist: `application/pdf`, `image/jpeg`, `image/png`, `image/heic`, `image/webp`
- Max size: 5 MB (5 * 1024 * 1024 bytes)
- R2 key format: `messages/{schoolId}/{threadId}/{uuid}-{sanitizedFilename}`
- Upload flow: client requests signed PUT URL → PUTs directly to R2 → client calls `postMessageAction` with attachment metadata → server HEAD-verifies R2 object exists + Content-Type matches claim + Content-Length matches claim → persists message (or rejects + deletes orphan)
- Download flow: `getMessageAttachmentUrlAction` returns a 5-minute signed GET URL
- Deletion: when a message is deleted (admin path only in MVP), R2 object is deleted. Thread hard-delete cascades via the archived-threads retention cron

Reuses `src/lib/storage/r2.ts` helpers (`uploadFile`, `getSignedDownloadUrl`, `deleteFile`, `generateFileKey`) from Tier 1 #2 document vault.

## 10. UI Surfaces

### Parent portal (`/parent/messages`)
Replaces the "Coming Soon" stub. Inbox + thread view. "New conversation" modal. Report menu on each message. Empty states for no-threads and no-messages-yet-in-thread.

### Staff portal (`/staff/messages`)
New route. Adds `Messages` link to `staffLinks` in `src/app/(portal)/portal-nav.tsx`. Same UX as parent portal but inbox scoped to threads where `teacherUserId = currentUser`. New-conversation modal lets teacher pick a student from their assigned arm/house.

### Admin review (`/students/messaging`)
New admin-only dashboard surface. Read-only thread listing + viewer. Separate tab `/students/messaging/reports` for the report queue. Actions: Lock/Unlock thread, Dismiss/Action report.

### Notification preferences
No UI code changes. The existing notifications-settings page iterates the event registry — adding the two new events in code is enough for them to render.

## 11. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| Non-guardian tries to create thread | Eligibility rejects before DB write |
| Teacher not in student's arm/house tries to create | Eligibility rejects |
| Post to archived thread | Rejected with clear error |
| Post exceeding rate limit | Rejected with clear error |
| Attachment MIME mismatch vs claimed | Rejected; orphan deleted by sweeper |
| Attachment exceeds 5 MB | Rejected at upload-URL action |
| Admin attempts to post | Rejected — admins are read-only |
| Admin locks mid-conversation | Subsequent posts rejected; reads still work |
| Message reported after deletion | Cascade delete via FK; report disappears with message |
| Multiple household guardians each have their own read state | Independent `MessageThreadRead` rows per user |
| Unclaimed guardian (no userId) | Can't authenticate, can't receive in-app; SMS fallback is future work |
| Teacher rotation mid-term | Thread's `teacherUserId` updated; system-note message posted; parents retain history |
| Concurrent archive + post | Transaction re-reads status inside post; safe |
| GDPR-style user deletion | User relations preserved; UI displays "(deleted user)" |
| `notifyNewMessage` throws | Swallowed per recipient; message stays posted |
| Tenant isolation | Every query carries `schoolId`; R2 keys scoped by schoolId |

## 12. Testing Strategy

### Pure helpers — `tests/unit/modules/messaging/eligibility.test.ts` (~16)
- `eligibleStaffRole` across all role/status/boarding permutations
- `parentCanMessageAbout` positive + negative
- `eligibleTeachersForStudent` filtering
- `isRateLimited` under/at/over limit; window boundaries

### Actions with Prisma mock (~36 total)
- `tests/unit/modules/messaging/thread.test.ts` (~12) — permissions, tenant isolation, list scoping, idempotent create, mark-read, archive
- `tests/unit/modules/messaging/message.test.ts` (~12) — post rejections (archived, locked, non-participant, rate-limited), MIME/size rejections, notification fan-out triggered, audit on report
- `tests/unit/modules/messaging/moderation.test.ts` (~8) — admin-review permission gate, lock/unlock/resolve with audit
- `tests/unit/modules/messaging/notifications.test.ts` (~4) — pref lookup, default fallback, opt-out, error swallowing

### Integration — `tests/integration/students/messaging.test.ts` (~7, live DB)
- Teacher + housemaster thread creation with eligibility
- Day-student + housemaster rejected
- Parent reply + notification path
- Archive-on-graduation auto-trigger
- Admin lock → post fails → unlock → post succeeds
- Tenant isolation

### Guardrail coverage
- `audit-coverage.test.ts`: admin mutations (`archiveThreadAction`, `lockThreadAction`, `unlockThreadAction`, `resolveReportAction`) carry `audit()`; `postMessageAction`, `createMessageThreadAction`, `reportMessageAction`, `markThreadReadAction` carry `@no-audit` JSDoc (too high volume)
- `tests/unit/auth/permissions.test.ts`: assertion that the four new permissions exist + granted to expected roles

**Net-new tests:** ~60.

## 13. Verification Plan

1. `npx vitest run` — all unit tests pass
2. `npm run test:students` — integration suite including new `messaging.test.ts`
3. `npx vitest run tests/unit/guardrails/audit-coverage.test.ts` — passing
4. `npx tsc --noEmit` — clean
5. `npm run build` — success; confirm new routes compile
6. `npm run lint` — no new errors
7. `npx prisma migrate dev --name add_messaging_models` — applies cleanly, no spurious FK drift
8. Manual UI: parent creates thread → teacher replies → parent replies → attachment upload → report a message → admin locks → admin unlocks → archive via student graduation flow

## 14. Critical Files

**New**
- `prisma/schema/communication.prisma` — append `MessageThread`, `Message`, `MessageThreadRead`, `MessageReport` models + enums
- `prisma/schema/migrations/<timestamp>_add_messaging_models/migration.sql`
- `src/modules/messaging/eligibility.ts`
- `src/modules/messaging/notifications.ts`
- `src/modules/messaging/attachments.ts`
- `src/modules/messaging/lifecycle.ts`
- `src/modules/messaging/actions/thread.action.ts`
- `src/modules/messaging/actions/message.action.ts`
- `src/modules/messaging/actions/message-moderation.action.ts`
- `src/modules/messaging/actions/attachment.action.ts`
- `src/app/(portal)/parent/messages/messages-client.tsx` — REWRITE (was stub)
- `src/app/(portal)/parent/messages/page.tsx` — update to wire data + client
- `src/app/(portal)/staff/messages/page.tsx` — new
- `src/app/(portal)/staff/messages/messages-client.tsx` — new
- `src/app/(dashboard)/students/messaging/page.tsx` + client — new admin surface
- `src/app/(dashboard)/students/messaging/reports/page.tsx` + client — new admin queue
- Tests enumerated in §12

**Modified**
- `src/lib/permissions.ts` — 4 new permissions + grants
- `src/app/(portal)/portal-nav.tsx` — add `Messages` to `staffLinks`
- `src/modules/student/actions/transfer.action.ts` + `withdraw.action.ts` + `graduate.action.ts` — call `archiveThreadsForStudent`
- `src/modules/student/actions/promotion.action.ts` — call `rotateTeacherOnThreadsForArm`
- Existing notification-events file (implementer identifies) — register `MESSAGE_RECEIVED_PARENT` and `MESSAGE_RECEIVED_TEACHER`
- Back-relation additions on `Student`, `School`, `User` in their respective Prisma files
