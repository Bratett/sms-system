# Parent Circular Acknowledgements — Design

**Date:** 2026-04-24
**Status:** Approved
**Tier:** 2 — part of item #6 (Parent Portal Upgrade). Sub-project **D1** of the four identified sub-projects; D1 = circulars, D2 = report-card release + acknowledgements (deferred).

## 1. Context

Sub-projects B (Parent↔Teacher Messaging, PR #26) and C (Parent-Initiated Workflows, PR #27) shipped. This is sub-project **D1**: add parent acknowledgement tracking on circulars (announcements).

Today, an `Announcement` model exists in `prisma/schema/communication.prisma` but has no acknowledgement, no per-parent read tracking, and the parent portal has no route that surfaces announcements at all. The parent-side action `getParentAnnouncementsAction` exists but drops class/programme/house targeting entirely (known bug — fixed in scope here).

This design adds: (a) an opt-in `requiresAcknowledgement` flag on announcements, (b) a one-click parent-side acknowledge flow, (c) an admin tracker extending the existing announcements page, and (d) an admin-triggered chase reminder with 24-hour cooldown. Report-card release/acknowledgement (sub-project D2) is deferred.

## 2. Scope

**In scope**
- `CircularAcknowledgement` junction model (announcement × household) + back-relations
- Two new columns on `Announcement`: `requiresAcknowledgement: boolean`, `lastReminderSentAt: DateTime?`
- Two new permissions: `CIRCULAR_ACKNOWLEDGE`, `CIRCULAR_ACKNOWLEDGEMENT_TRACK`
- Two new notification events: `CIRCULAR_ACKNOWLEDGEMENT_REQUIRED`, `CIRCULAR_REMINDER_SENT`
- Pure targeting helper `resolveTargetedHouseholdIds` + `doesAnnouncementTargetGuardian` (also fixes existing targeting bug)
- Server actions: acknowledge, admin stats, admin details, chase, extended create/publish
- Parent portal `/parent/circulars` route with Pending / History tabs + one-click acknowledge
- Admin extension of the existing `/communication/announcements` page with stats column, detail drawer, and chase button

**Out of scope**
- Attachments on circulars (Announcement model has no attachment columns)
- Automatic reminder schedules (admin-triggered only)
- Expiry state machine for unacknowledged circulars
- Un-acknowledgement (reversing an ack is not allowed)
- Report card release + acknowledgement (sub-project D2, deferred)
- Student-portal visibility of circulars
- Typed-name confirmation (one-click is the signature)
- Dashboard callout on `/parent` (optional polish, follow-up)

## 3. Architecture

**Approach: extend the existing communication module.** Place new server actions in `src/modules/communication/actions/circular-acknowledgement.action.ts` and pure helpers in `src/modules/communication/circular-targeting.ts` + `circular-notifications.ts`. The existing `Announcement` model + `announcement.action.ts` gain two columns and a publish-fan-out extension.

No new domain module folder — the feature is tightly coupled to `Announcement` and there's no benefit to a sibling module.

Data invariants (targeted households match the circular's `targetType`/`targetIds`) are computed by the targeting helper at query time, not denormalized. This keeps the schema clean and correctly handles mid-term targeting changes (e.g., a student added to the class after publish).

## 4. Data Model

### Modify `Announcement`

```prisma
model Announcement {
  // ...existing fields unchanged
  requiresAcknowledgement Boolean   @default(false)
  lastReminderSentAt      DateTime?

  // new back-relation
  acknowledgements CircularAcknowledgement[]

  // existing indexes unchanged; add:
  @@index([schoolId, status, requiresAcknowledgement])
}
```

Existing rows get `requiresAcknowledgement = false` and `lastReminderSentAt = null`. Current behavior of routine announcements preserved.

### New model `CircularAcknowledgement`

```prisma
model CircularAcknowledgement {
  id                     String    @id @default(cuid())
  announcementId         String
  householdId            String
  acknowledgedByUserId   String?   // which guardian clicked (nullable for GDPR user-delete)
  acknowledgedAt         DateTime  @default(now())
  createdAt              DateTime  @default(now())

  announcement    Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  household       Household    @relation(fields: [householdId], references: [id], onDelete: Cascade)
  acknowledgedBy  User?        @relation("AcknowledgedCirculars", fields: [acknowledgedByUserId], references: [id], onDelete: SetNull)

  @@unique([announcementId, householdId])
  @@index([announcementId])
  @@index([householdId])
  @@index([acknowledgedByUserId])
}
```

Back-relations:
- `Household.circularAcknowledgements CircularAcknowledgement[]`
- `User.acknowledgedCirculars CircularAcknowledgement[] @relation("AcknowledgedCirculars")`

**Key choices:**
- `@@unique([announcementId, householdId])` — one ack per household per circular, race-safe at the DB layer.
- `onDelete: Cascade` on the two primary FKs — if an announcement is hard-deleted or a household is dissolved, the ack rows vanish. Audit of the act survives in `AuditLog`.
- `onDelete: SetNull` on `acknowledgedByUserId` — if a user is deleted, the ack row persists with "deleted user" labeling.
- No "pending" rows — pending is always computed as `targeted − acknowledged` at query time.
- No `reminderCount` column; 24-hour cooldown is enforced solely via `Announcement.lastReminderSentAt`.

### Guardian-without-household edge case (MVP)

Guardians with `householdId = null` (pre-backfill or emergency-contact-only) are excluded from the targeted set for acknowledgement purposes. They can read the circular (if targeted through their student) but cannot acknowledge. Post-backfill this is rare; if it becomes an operational issue we ship a follow-up with a `singleGuardianUserId` column.

## 5. Targeting Resolution + Pending Computation

### `resolveTargetedHouseholdIds` (pure helper with DB reads)

`src/modules/communication/circular-targeting.ts`:

```ts
export async function resolveTargetedHouseholdIds(input: {
  schoolId: string;
  targetType: "all" | "class" | "programme" | "house" | "specific";
  targetIds: string[] | null;
}): Promise<string[]>;
```

Rules:
- `"all"` → every household with at least one ACTIVE/SUSPENDED student in the school.
- `"class"` → households linked via `Student` with an active `Enrollment` in any class id in `targetIds`.
- `"programme"` → households linked via active enrollment in any programme id in `targetIds`.
- `"house"` → households linked via `StudentHouse` assignment in any house id in `targetIds`.
- `"specific"` → households linked via `Student.id ∈ targetIds`.

Students with status WITHDRAWN/GRADUATED/TRANSFERRED are excluded. Households with no qualifying student are excluded. Malformed `targetIds` returns `[]` with a warning log.

### `doesAnnouncementTargetGuardian`

Sibling helper used by the parent-side action:

```ts
export function doesAnnouncementTargetGuardian(
  announcement: Pick<Announcement, "targetType" | "targetIds">,
  guardianStudentIds: string[],
  guardianStudentContexts: Array<{ id: string; classArmId: string | null; programmeId: string | null; houseId: string | null }>,
): boolean;
```

Pure — the caller loads the guardian's students' context once and checks each announcement inline.

### Pending derivation

No stored "pending" rows. Admin stats query:

```ts
const targeted = await resolveTargetedHouseholdIds({ ... });
const acknowledgedCount = await db.circularAcknowledgement.count({
  where: { announcementId, householdId: { in: targeted } },
});
return { acknowledged: acknowledgedCount, pending: targeted.length - acknowledgedCount };
```

Parent-side "is this pending for me?" is a single unique-key lookup.

### Targeting-bug fix

The existing `getParentAnnouncementsAction` today fetches `targetType IN ("all", "specific")` and ignores `targetIds`. Replace with:

1. Load caller's guardian → linked students with their class/programme/house context.
2. For each published, non-expired announcement in the school, call `doesAnnouncementTargetGuardian`.
3. Include only announcements that target at least one of the guardian's students.

Regression test: a class-targeted circular is visible only to guardians in that class.

## 6. Permissions

Two new constants in `src/lib/permissions.ts`:

```ts
  CIRCULAR_ACKNOWLEDGE:           "communication:circulars:acknowledge",
  CIRCULAR_ACKNOWLEDGEMENT_TRACK: "communication:circulars:acknowledgement-track",
```

Grants:

| Permission | Granted to |
|---|---|
| `CIRCULAR_ACKNOWLEDGE` | `parent` |
| `CIRCULAR_ACKNOWLEDGEMENT_TRACK` | `super_admin`, `school_admin`, `principal`, `vice_principal` (same set as `ANNOUNCEMENTS_CREATE`) |

`super_admin` inherits via `ALL_PERMISSIONS`.

**Reuse of existing permissions:**
- Reading circulars: existing `ANNOUNCEMENTS_READ` (parents already hold it).
- Creating `requiresAcknowledgement: true`: existing `ANNOUNCEMENTS_CREATE` (no tiered permission).

**Eligibility vs permission.** `CIRCULAR_ACKNOWLEDGE` gates the action at all; the per-circular rule "this caller's household is actually targeted" is enforced in `acknowledgeCircularAction` at action time. Non-targeted acknowledge attempts return `{ error: "Circular not found" }` (no leak).

## 7. Server Actions

All paths under `src/modules/communication/actions/`.

### New: `circular-acknowledgement.action.ts`

| Action | Permission | Purpose |
|---|---|---|
| `acknowledgeCircularAction({ announcementId })` | `CIRCULAR_ACKNOWLEDGE` | Validates: announcement exists, is PUBLISHED (not ARCHIVED), `requiresAcknowledgement = true`, caller's household ∈ targeted set, not already acknowledged. Upserts `CircularAcknowledgement`. Audit. Double-tap is idempotent (unique-constraint caught → `{ success: true }`). |
| `getAnnouncementAcknowledgementStatsAction(announcementId)` | `CIRCULAR_ACKNOWLEDGEMENT_TRACK` | Returns `{ targeted, acknowledged, pending, lastReminderSentAt, canSendReminder }`. |
| `getAnnouncementAcknowledgementDetailsAction(announcementId)` | `CIRCULAR_ACKNOWLEDGEMENT_TRACK` | Per-household rows with status + `acknowledgedBy` name + timestamp. Pending-first sort. |
| `chaseAnnouncementAcknowledgementAction(announcementId)` | `CIRCULAR_ACKNOWLEDGEMENT_TRACK` | Cooldown check (24h since `lastReminderSentAt`). Zero-pending rejection. Fires `CIRCULAR_REMINDER_SENT` fan-out to pending households' guardian userIds. Updates `lastReminderSentAt`. Audit. |

### Modifications to existing `announcement.action.ts`

- `createAnnouncementAction` + `updateAnnouncementAction` accept optional `requiresAcknowledgement: boolean` (default `false`). Zod schema updated.
- `publishAnnouncementAction` — fires `notifyCircularPublished` (which dispatches `ANNOUNCEMENT_PUBLISHED` always, plus `CIRCULAR_ACKNOWLEDGEMENT_REQUIRED` when `requiresAcknowledgement = true`).

### Modifications to `src/modules/portal/actions/parent.action.ts`

- Fix the targeting bug in `getParentAnnouncementsAction` per Section 5.
- New sibling action `getParentCircularsAction({ tab: "pending" | "history" })`:
  - `pending`: `requiresAcknowledgement = true` AND not acknowledged by my household.
  - `history`: all others (acknowledged, or no-ack-required).
  - Permission: `ANNOUNCEMENTS_READ`.
  - Each row hydrates `{ isAcknowledged, requiresAcknowledgement, canAcknowledge }` inline.

### Error handling conventions

All actions return `{ data } | { error }` or `{ success } | { error }`. Key errors:
- `{ error: "Circular not found" }` — covers "doesn't exist" and "not targeted" (generic, no leak).
- `{ error: "This circular doesn't require acknowledgement." }`
- `{ error: "This circular is no longer active." }` — ARCHIVED.
- `{ error: "Reminder cooldown: X hours remaining." }` — chase within 24h.
- `{ error: "Everyone has acknowledged. No one to remind." }` — chase with pending = 0.

### Audit

- `acknowledgeCircularAction` — `action: "CREATE"`, entity `"CircularAcknowledgement"`.
- `chaseAnnouncementAcknowledgementAction` — `action: "UPDATE"`, entity `"Announcement"`, description includes recipient count.
- `publishAnnouncementAction` — existing audit unchanged.
- Reads carry `@no-audit` JSDoc.

## 8. Notifications

Two new event keys in `src/lib/notifications/events.ts`:

```ts
  CIRCULAR_ACKNOWLEDGEMENT_REQUIRED: "circular_acknowledgement_required",
  CIRCULAR_REMINDER_SENT:            "circular_reminder_sent",
```

**`EVENT_CHANNELS` defaults:**

| Event | Defaults |
|---|---|
| `CIRCULAR_ACKNOWLEDGEMENT_REQUIRED` | `[in_app, email]` |
| `CIRCULAR_REMINDER_SENT` | `[in_app, email, sms]` |

Existing `ANNOUNCEMENT_PUBLISHED` event (in-app only) is unchanged. For ack-required circulars, both events fire — `ANNOUNCEMENT_PUBLISHED` for in-app surfacing, `CIRCULAR_ACKNOWLEDGEMENT_REQUIRED` for louder email delivery.

### Module: `src/modules/communication/circular-notifications.ts`

```ts
export async function notifyCircularPublished(params: {
  announcementId: string;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  recipientUserIds: string[];
  requiresAcknowledgement: boolean;
}): Promise<void>;

export async function notifyCircularReminder(params: {
  announcementId: string;
  title: string;
  recipientUserIds: string[];
}): Promise<void>;
```

Both honor `NotificationPreference` per recipient, fall back to registry defaults, swallow per-recipient errors with `console.error`. Matches the `parent-requests/notifications.ts` pattern. Urgent-priority reminders carry an `[URGENT]` prefix in the message body.

### Recipient resolution

Inside the calling action:
- **`publishAnnouncementAction`** — resolve targeted households via `resolveTargetedHouseholdIds`, then `db.guardian.findMany({ where: { householdId: { in: targetedIds }, userId: { not: null } }, select: { userId: true } })`, dedupe.
- **`chaseAnnouncementAcknowledgementAction`** — resolve targeted, subtract already-acknowledged households, then resolve pending-household guardian userIds.

No post-ack "parent acknowledged" notification fires — admin tracker shows fresh stats on page load.

## 9. UI Surfaces

### Parent portal — `/parent/circulars` (new)

New route with two tabs: **Pending** and **History**.

**Pending.** `requiresAcknowledgement = true` circulars not yet acknowledged by the caller's household.
- Row: title (bold), priority chip (for `high`/`urgent`), published date, one-line preview, row-level **"I acknowledge"** primary button.
- Click row → drawer with full content + acknowledge button at bottom.

**History.** Everything else — acknowledged circulars (green badge + date) and no-ack-required circulars.
- Click row → drawer (read-only).

**Empty states:**
- Pending: "You're all caught up. No circulars need your acknowledgement."
- History: "No circulars yet."

**Nav:** add `{ href: "/parent/circulars", label: "Circulars" }` to `parentLinks` in `portal-nav.tsx` after `My requests`.

### Admin — extend `/communication/announcements` (existing)

**List view:**
- New column **"Acknowledgements"** — only populated when `requiresAcknowledgement = true`. Shows `{acked} / {targeted}` + slim green progress bar. For `false`, shows a dash.
- Stats fetched via batched `getAnnouncementAcknowledgementStatsAction` when the page renders.

**Detail drawer** (triggered by row click):
- Existing: title, body, targeting, priority.
- New **"Acknowledgements"** section (only for `requiresAcknowledgement = true`):
  - Headline: `"23 of 45 households acknowledged (22 pending)"` + progress bar.
  - Last reminder: `"Last reminder sent: 2 days ago"` or `"No reminders sent yet"`.
  - Primary button **"Send reminder to N pending households"**:
    - Disabled with cooldown tooltip within 24h.
    - Disabled with "Everyone acknowledged" tooltip if pending = 0.
  - Table: **Household** × **Status**. Status = `"Acknowledged by {firstName} on {date}"` or `"Pending"`. Pending-first sort.
  - **"Download CSV"** link — exports the detail table (cap at 2000 rows for MVP).

**Create / Edit form:**
- New checkbox **"Require parents to acknowledge this circular"**.
- Tooltip: "Targeted households will be prompted to click 'I acknowledge' and you can track who has."

### Shared UX conventions

- Status badges match the parent-requests palette: gray=pending, green=acknowledged.
- Toasts via `sonner`, matching messaging + parent-requests.
- Dates via `toLocaleDateString()`.

## 10. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| Acknowledge on a `requiresAcknowledgement = false` circular | `{ error: "This circular doesn't require acknowledgement." }` |
| Acknowledge on a non-targeted circular | `{ error: "Circular not found" }` (no leak) |
| Double-tap acknowledge | First creates; second caught via unique-constraint → `{ success: true }`. Single audit row. |
| Acknowledge on an ARCHIVED circular | `{ error: "This circular is no longer active." }` |
| Admin chases with pending = 0 | `{ error: "Everyone has acknowledged. No one to remind." }` |
| Admin chases within 24h | `{ error: "Reminder cooldown: X hours remaining." }` |
| Student transferred into targeted class post-publish | Next query picks them up; their household enters targeted + pending |
| Household backfilled post-publish | Same — targeted on next query; can acknowledge retroactively |
| Guardian with `userId = null` (no portal account) | Counted in targeted households but can't acknowledge; another household guardian can on their behalf |
| Single-guardian-no-household | Excluded from targeted set for MVP |
| Guardian deleted (GDPR) | `acknowledgedByUserId` set to null via `onDelete: SetNull`; admin tracker shows "(deleted user)" |
| Two admins chase simultaneously | First wins on the transactional `lastReminderSentAt` update; second hits cooldown |
| Announcement hard-deleted | `onDelete: Cascade` drops ack rows; audit log survives |
| Notification throws for one recipient | Swallowed per-recipient; other recipients proceed |
| Malformed `targetIds` JSON | Targeting helper returns `[]` with warning; admin sees `0 targeted` and can fix via edit |
| CSV export > 2000 rows | Cap at 2000; admin can filter to pending via query param |
| Parent acknowledge with no network | Browser toast; row stays in Pending; retry works |
| Tenant isolation | Every query scoped by `schoolId`; targeting helper enforces |
| Audit write failure | Best-effort 3-retry from existing helper; action continues |

## 11. Testing Strategy

### Pure targeting helper — `tests/unit/modules/communication/circular-targeting.test.ts` (~10)

- `resolveTargetedHouseholdIds` for each `targetType`
- WITHDRAWN/GRADUATED/TRANSFERRED excluded
- Households with zero qualifying students excluded
- Malformed `targetIds` → `[]`
- `schoolId` isolation
- `doesAnnouncementTargetGuardian` positive + negative per targetType

### Actions with Prisma mock

- `tests/unit/modules/communication/circular-acknowledgement.test.ts` (~14)
  - Permission gates on all 4 actions
  - Non-required-ack rejection, non-targeted rejection (generic error), archived rejection
  - Idempotent double-tap
  - Audit fires
  - Stats return shape
  - Chase cooldown enforcement
  - Zero-pending chase rejection
  - Chase updates `lastReminderSentAt`

- `tests/unit/modules/communication/announcement-publish-ack.test.ts` (~5)
  - `requiresAcknowledgement = false` publishes fire existing `ANNOUNCEMENT_PUBLISHED` only
  - `true` publishes fire the stronger event
  - `createAnnouncementAction` + `updateAnnouncementAction` accept the new field

- `tests/unit/modules/portal/parent-circulars.test.ts` (~8)
  - `getParentCircularsAction` tab filtering
  - Targeting-bug regression (class/programme/house/specific)
  - Tenant isolation

- `tests/unit/modules/communication/circular-notifications.test.ts` (~5)
  - `notifyCircularPublished` channel selection (`false` → in_app only, `true` → in_app + email)
  - `notifyCircularReminder` → in_app + email + sms
  - Per-recipient error swallowing
  - Preference overrides respected

### Integration — `tests/integration/students/circular-acknowledgements.test.ts` (~5, live DB)

- Happy path: admin creates circular with `requiresAcknowledgement: true` → parent sees Pending → acknowledges → History + stats match
- Cross-household isolation: second household acks independently; stats reflect both
- Chase: publish → chase → `lastReminderSentAt` updated + NotificationMessage row exists
- Chase cooldown: second chase within 24h rejected
- Tenant isolation

### Guardrails

- `audit-coverage.test.ts`: acknowledge + chase carry `audit()`; reads carry `@no-audit`.
- `permissions.test.ts`: new 2 permissions + expected role grants + negative grants.

**Net-new tests:** ~48.

## 12. Verification Plan

1. `npx vitest run` — all unit tests pass
2. `npm run test:students` — integration suite including new `circular-acknowledgements.test.ts`
3. `npx vitest run tests/unit/guardrails/audit-coverage.test.ts` — passing
4. `npx tsc --noEmit` — clean
5. `npm run build` — success; confirm `/parent/circulars` compiles
6. `npm run lint` — 0 errors, no new baseline warnings
7. `npx prisma migrate dev --name add_circular_acknowledgements` — applies cleanly
8. `npx prisma migrate status` — DB up to date
9. Manual UI walk:
   - Admin creates circular with `requiresAcknowledgement: true` targeting a class → publish
   - Parent of a targeted student → `/parent/circulars` shows it in Pending → click "I acknowledge"
   - Reload → circular in History with green "Acknowledged {date}" badge
   - Admin reopens detail drawer → "1 of N acknowledged", pending table
   - Admin clicks "Send reminder" → within 24h button greys out
   - Second parent in targeted class → sees circular in Pending despite first household ack
   - Targeting regression: parent whose child is in a non-targeted class does NOT see the circular
   - `requiresAcknowledgement: false` circular → no acknowledge UI, appears in History immediately

## 13. Critical Files

**New**
- `prisma/schema/communication.prisma` — add `requiresAcknowledgement` + `lastReminderSentAt` to `Announcement`; append `CircularAcknowledgement` model
- `prisma/schema/migrations/<timestamp>_add_circular_acknowledgements/migration.sql`
- `src/modules/communication/circular-targeting.ts`
- `src/modules/communication/circular-notifications.ts`
- `src/modules/communication/actions/circular-acknowledgement.action.ts`
- `src/app/(portal)/parent/circulars/page.tsx` + client
- Tests enumerated in §11

**Modified**
- `src/lib/permissions.ts` — 2 new permissions + grants
- `src/lib/notifications/events.ts` — 2 new event keys + EVENT_CHANNELS
- `src/app/(portal)/portal-nav.tsx` — add `Circulars` link under `parentLinks`
- `src/modules/communication/actions/announcement.action.ts` — accept `requiresAcknowledgement` in create/update; fan out stronger event on publish
- `src/modules/portal/actions/parent.action.ts` — fix targeting bug in `getParentAnnouncementsAction`; add `getParentCircularsAction`
- `src/app/(dashboard)/communication/announcements/announcements-client.tsx` — add stats column + detail drawer with Send reminder + CSV export
- Back-relations on `Household`, `User` in their Prisma files
