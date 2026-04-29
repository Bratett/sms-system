# Alumni Events + RSVPs (Sub-project B)

**Date:** 2026-04-29
**Tier 2 #7 sub-project B** (alumni events + RSVPs; sub-project C covers donations, D covers mentorship)

**Depends on:** sub-project A (`feat/alumni-foundation`) — alumni role, alumni portal layout, `assertAlumnusAccess` helper.

## 1. Summary

Adds alumni-event lifecycle on top of sub-project A's foundation. Admins create draft events, publish them (which fans out a notification to all alumni in the school), and cancel them when needed. Alumni see upcoming and past events, RSVP yes/no/maybe with optional guest count, and get a waitlist flag when soft-capacity is exceeded.

This is the second of four sub-projects under Tier 2 #7. Subsequent sub-projects (C — donations, D — mentorship) build on the same alumni surface.

## 2. Goals & non-goals

**Goals**
- Admin can create, publish, edit, and cancel alumni events from a dedicated admin page.
- Alumni see upcoming and past events with their own RSVP status; can respond yes/no/maybe + guest count up to a per-event admin-set cap.
- Single fan-out notification on publish (in_app + email defaults; per-user prefs respected).
- Soft capacity with waitlist flag — admin gets the planning signal without UX punishment for late RSVPers.
- Optional `rsvpDeadline` locks responses automatically.
- Strict tenant isolation; defense-in-depth status check on every alumnus action (mirrors sub-project A).

**Non-goals**
- Attendance check-in (yes/no after the event). Separate sub-project.
- Audience targeting (year-cohort or industry filters). All alumni in the school see all events.
- Reminder notifications (24h-before push). Future addition.
- Edit-and-renotify after publish. Silent edits only; admin handles communication offline.
- Automatic waitlist promotion when slots free up. Admin handles offline.
- RSVP messages / "bringing my spouse" notes. Admin contacts the alumnus offline if extra detail is needed.
- Recurring events (weekly meetups). Each event is one-off.
- Event ticketing / paid events. Free events only at this stage.
- Public-internet event pages. Strictly authenticated alumni-portal-only.

## 3. User decisions (recorded from brainstorming)

| Q | Decision |
|---|---|
| Q1 — Scope | A — events + RSVPs only; no attendance check-in |
| Q2 — Data model | A — new `AlumniEvent` model (separate from `AcademicEvent`) |
| Q3 — RSVP shape | B — YES/NO/MAYBE + optional guest count, admin-set max-per-RSVP |
| Q4 — Capacity | B — soft cap + `waitlisted` flag, plus optional `rsvpDeadline` |
| Q5 — Audience | A — all alumni see all events; no targeting |
| Q6 — Notifications | B — single fire on publish only (in_app + email) |
| Q7 — Lifecycle | B — DRAFT / PUBLISHED / CANCELED |
| Q8 — Permissions | A — reuse `GRADUATION_CREATE` admin-side; new `ALUMNI_EVENTS_READ` + `ALUMNI_EVENTS_RSVP` alumni-side |

## 4. Architecture

### 4.1 New module: `src/modules/alumni-events/`

- `actions/admin-events.action.ts` — 6 admin actions (`createAlumniEventDraftAction`, `updateAlumniEventAction`, `publishAlumniEventAction`, `cancelAlumniEventAction`, `getAlumniEventListAction`, `getAlumniEventDetailAction`).
- `actions/alumni-events.action.ts` — 3 alumni-side actions (`getMyAlumniEventsAction`, `getMyAlumniEventDetailAction`, `upsertMyEventRsvpAction`).
- `events-notifications.ts` — fan-out helper `notifyAlumniEventPublished`. Mirrors `release-notifications.ts` from PR #29.
- `schemas/event.schema.ts` — zod schemas for create/update/RSVP inputs.

### 4.2 New admin surfaces (under existing `/graduation/`)

- `src/app/(dashboard)/graduation/alumni-events/page.tsx` + `events-list-client.tsx` — list with status filter, headcount/waitlist columns, pagination.
- `src/app/(dashboard)/graduation/alumni-events/[id]/page.tsx` + `event-detail-client.tsx` — event detail with RSVP table, edit/publish/cancel controls, CSV export.
- `src/app/(dashboard)/graduation/alumni-events/event-form-modal.tsx` — shared create/edit modal.

### 4.3 New alumni-facing surfaces (under `/alumni/`)

- `src/app/(portal)/alumni/events/page.tsx` + `events-list-client.tsx` — upcoming + past tabs, card grid with own-RSVP pill.
- `src/app/(portal)/alumni/events/[eventId]/page.tsx` + `event-detail-client.tsx` — detail page with RSVP form (yes/no/maybe + guest count).

### 4.4 Edits to existing files

- `prisma/schema/communication.prisma` — append `AlumniEvent` + `AlumniEventRsvp` models + 2 enums (collocated with the existing `AlumniProfile` model).
- `src/lib/permissions.ts` — 2 new constants + alumni role bundle update.
- `prisma/seed/index.ts` — same additions.
- `src/lib/notifications/events.ts` — register `ALUMNI_EVENT_PUBLISHED` + EVENT_CHANNELS entry.
- `src/lib/navigation.ts` — add "Alumni events" admin sidebar entry.
- `src/app/(portal)/portal-nav.tsx` — add "Events" to the alumni nav links.
- `tests/unit/auth/permissions.test.ts` — extend alumni-role regression to expect 4 perms.

## 5. Data model

### 5.1 `AlumniEvent`

```prisma
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

  school        School              @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  createdBy     User?               @relation("CreatedAlumniEvents", fields: [createdByUserId], references: [id], onDelete: SetNull)
  rsvps         AlumniEventRsvp[]

  @@index([schoolId, status, startAt])
  @@index([schoolId, startAt])
}

enum AlumniEventStatus {
  DRAFT
  PUBLISHED
  CANCELED
}
```

### 5.2 `AlumniEventRsvp`

```prisma
model AlumniEventRsvp {
  id              String        @id @default(cuid())
  eventId         String
  alumniProfileId String
  response        RsvpResponse
  guestCount      Int           @default(0)
  waitlisted      Boolean       @default(false)
  respondedAt     DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  event           AlumniEvent   @relation(fields: [eventId], references: [id], onDelete: Cascade)
  alumniProfile   AlumniProfile @relation(fields: [alumniProfileId], references: [id], onDelete: Cascade)

  @@unique([eventId, alumniProfileId])
  @@index([eventId, response])
  @@index([alumniProfileId])
}

enum RsvpResponse {
  YES
  NO
  MAYBE
}
```

### 5.3 Back-relations on existing models

- `User.createdAlumniEvents AlumniEvent[] @relation("CreatedAlumniEvents")` — new relation on User.
- `School.alumniEvents AlumniEvent[]` — new relation on School.
- `AlumniProfile.eventRsvps AlumniEventRsvp[]` — new relation on AlumniProfile.

### 5.4 Computed at read time, not stored

- `yesCount`, `noCount`, `maybeCount` — counts of RSVPs by response.
- `confirmedHeadcount` — sum of `(1 + guestCount)` over non-waitlisted YES RSVPs.
- `waitlistHeadcount` — sum over waitlisted YES RSVPs.

### 5.5 Waitlist algorithm

Computed at RSVP-write time inside `upsertMyEventRsvpAction`:

1. If event has no `capacity` → `waitlisted = false`. Skip the rest.
2. If `response !== "YES"` → `waitlisted = false`. Skip the rest.
3. Compute current headcount excluding the alumnus's own row: `sum(1 + guestCount) over non-waitlisted YES rows where alumniProfileId != self`.
4. New incoming headcount = `1 + thisGuestCount`.
5. If `currentHeadcount + newIncoming > capacity` → `waitlisted = true`. Else `false`.

The exclusion of the caller's own row in step 3 lets an alumnus update their guest count without spuriously waitlisting themselves.

**Concurrency limitation (documented)**: count + write are not atomic. Two simultaneous YES RSVPs at the capacity boundary could both land non-waitlisted (small overflow). Acceptable trade-off; future improvement.

## 6. Permissions

Two new permission constants in `src/lib/permissions.ts`:

```ts
ALUMNI_EVENTS_READ: "alumni:events:read",
ALUMNI_EVENTS_RSVP: "alumni:events:rsvp",
```

Updated `alumni` role bundle (sub-project A's two perms + this sub-project's two):

```ts
alumni: [
  PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN,
  PERMISSIONS.ALUMNI_DIRECTORY_READ,
  PERMISSIONS.ALUMNI_EVENTS_READ,
  PERMISSIONS.ALUMNI_EVENTS_RSVP,
],
```

Admin-side gating reuses `GRADUATION_CREATE` (write) and `GRADUATION_READ` (read). No new admin role grants needed.

Same additions mirrored into `prisma/seed/index.ts`. `npm run db:seed` is idempotent and creates the two new Permission rows + RolePermission rows linking them to the alumni Role.

Defense-in-depth: every alumnus action goes through sub-project A's `assertAlumnusAccess` helper which checks both the new role grant AND `student.status === GRADUATED`.

## 7. Server actions

### 7.1 `admin-events.action.ts`

#### `createAlumniEventDraftAction(input)`
- Gates: `requireSchoolContext` + `assertPermission(GRADUATION_CREATE)`.
- Input (zod): `title` (1–200), `description?` (max 5000), `startAt` (ISO date, must be in future), `endAt?` (must be ≥ startAt if present), `location?` (max 500), `virtualLink?` (URL or empty), `capacity?` (int ≥ 1), `maxGuestsPerRsvp?` (int ≥ 0, default 0), `rsvpDeadline?` (ISO date, must be ≤ startAt if present).
- Creates row with `status: DRAFT`, `createdByUserId: ctx.session.user.id`, `schoolId: ctx.schoolId`.
- Audits `CREATE` with `entity: "AlumniEvent"`, `entityId: event.id`, `module: "alumni"`, `newData: event`.
- Returns `{ data: { id, ...event } }`.
- No fan-out (still draft).

#### `updateAlumniEventAction(eventId, input)`
- Gates: same as create.
- Loads event scoped by `schoolId`. Returns `{ error: "Event not found" }` on miss.
- Rejects edits when `status === CANCELED` with `{ error: "Cannot edit a canceled event" }`.
- Partial update (zod-validated against the same schema with all fields optional) — only writes fields present in input.
- Audits `UPDATE` with `previousData` + `newData`.
- Returns `{ data: event }`.
- No fan-out.

#### `publishAlumniEventAction(eventId)`
- Gates: same.
- Loads event scoped by school.
- Idempotent: if `status === PUBLISHED`, returns `{ data: event }` without re-firing fan-out.
- Otherwise: flips `status: PUBLISHED`, sets `publishedAt: now`. Cannot publish a CANCELED event (returns `{ error: "Cannot publish a canceled event" }`).
- Calls `notifyAlumniEventPublished({ eventId, schoolId, ...metadata })` wrapped in try/catch — fan-out failure does NOT roll back publish.
- Audits `UPDATE` with `description: "Published alumni event"`, `metadata: { eventTitle, recipientCount }` (the recipientCount populated by the fan-out helper or 0 on failure).
- Returns `{ data: event }`.

#### `cancelAlumniEventAction(eventId)`
- Gates: same.
- Idempotent: if `status === CANCELED`, returns `{ data: event }`.
- Sets `status: CANCELED`, `canceledAt: now`. RSVP rows preserved.
- No fan-out (admin handles communication offline).
- Audits `UPDATE` with `description: "Canceled alumni event"`.
- Returns `{ data: event }`.

#### `getAlumniEventListAction(filters?)`
- Gates: `requireSchoolContext` + `assertPermission(GRADUATION_READ)`.
- Filters: `{ status?: AlumniEventStatus, fromDate?: Date, toDate?: Date, page?, pageSize? }`. Defaults: page 1, pageSize 20, sort by `startAt desc`.
- Returns `{ data: rows[], pagination, aggregates }`. Each row includes computed `yesCount`, `noCount`, `maybeCount`, `confirmedHeadcount`, `waitlistHeadcount`.
- Aggregates (school-wide, not page-filtered): `totalEvents`, `draftCount`, `publishedCount`, `canceledCount`.
- Tagged `@no-audit`.

#### `getAlumniEventDetailAction(eventId)`
- Gates: same as list.
- Returns event + sorted RSVP table joined to AlumniProfile + Student. Shape:
  ```ts
  { event, rsvps: { studentId, firstName, lastName, photoUrl, graduationYear, currentEmployer, response, guestCount, waitlisted, respondedAt }[] }
  ```
- Sort order: YES non-waitlisted first (alphabetical), then YES waitlisted (alphabetical), then MAYBE, then NO.
- Cross-school 404: returns `{ error: "Event not found" }` if `event.schoolId !== ctx.schoolId`.
- Tagged `@no-audit`.

### 7.2 `alumni-events.action.ts`

All three actions go through `assertAlumnusAccess(ctx, <permission>, { id: true })` (using `ALUMNI_EVENTS_READ` for read actions; `ALUMNI_EVENTS_RSVP` for the upsert action) plus a follow-up `db.alumniProfile.findUnique({ where: { studentId: student.id }, select: { id: true } })` to get `alumniProfileId`.

#### `getMyAlumniEventsAction(filters?)`
- Gates: `ALUMNI_EVENTS_READ`.
- Filters: `{ tab: "upcoming" | "past" }`. Default `"upcoming"`.
  - `upcoming` → `startAt >= now AND status === PUBLISHED`. Sort startAt asc.
  - `past` → `startAt < now AND status IN (PUBLISHED, CANCELED)`. Sort startAt desc.
- Returns `{ data: rows[] }` where each row includes the alumnus's own RSVP joined via `(eventId, alumniProfileId)`. Shape:
  ```ts
  {
    id, title, startAt, endAt, location, virtualLink,
    status, capacity, confirmedHeadcount,
    myRsvp: { response, guestCount, waitlisted } | null
  }
  ```
- Tagged `@no-audit`.

#### `getMyAlumniEventDetailAction(eventId)`
- Gates: `ALUMNI_EVENTS_READ`.
- Loads single event scoped by `schoolId` (with explicit post-fetch `event.schoolId === ctx.schoolId` check).
- Filters out DRAFT events with `{ error: "Event not found" }`.
- Returns full event + alumnus's own RSVP. Shape:
  ```ts
  {
    event: { ...all fields except createdByUserId, capacity, confirmedHeadcount, waitlistHeadcount },
    myRsvp: { response, guestCount, waitlisted } | null
  }
  ```
- Tagged `@no-audit`.

#### `upsertMyEventRsvpAction({ eventId, response, guestCount })`
- Gates: `ALUMNI_EVENTS_RSVP`.
- Validations:
  - Event exists in same school. Generic 404 otherwise.
  - `event.status === PUBLISHED`. (Reject DRAFT and CANCELED.)
  - `event.startAt > now` ("Event has already taken place").
  - `event.rsvpDeadline === null OR event.rsvpDeadline > now` ("RSVP deadline has passed").
  - `0 ≤ guestCount ≤ event.maxGuestsPerRsvp`.
- Computes `waitlisted` per Section 5.5 algorithm.
- Performs `prisma.alumniEventRsvp.upsert` keyed on `(eventId, alumniProfileId)`. Create OR update both work.
- Audits `CREATE` on first RSVP, `UPDATE` on subsequent edits (distinguished by checking if a row existed before the upsert).
- Returns `{ data: rsvp }` including the computed `waitlisted` flag.

## 8. Notifications

One new event:

```ts
ALUMNI_EVENT_PUBLISHED: "alumni_event_published",
```

`EVENT_CHANNELS[ALUMNI_EVENT_PUBLISHED] = ["in_app", "email"]`.

### 8.1 Fan-out helper `notifyAlumniEventPublished(input)`

Input: `{ eventId, schoolId, eventTitle, startAt }`.

Steps (mirrors `release-notifications.ts` from PR #29):
1. Resolve recipients: `db.alumniProfile.findMany({ where: { schoolId } })` join through `Student.userId`. Filter out null userIds.
2. Look up `NotificationPreference` for `eventKey: "alumni_event_published"` for those userIds.
3. For each userId: pick override channels if present, else defaults from `EVENT_CHANNELS`.
4. For each channel: `sendMessage(channel, { to: userId, body, metadata })` wrapped in per-call try/catch.
5. Returns `{ recipientCount }` for the audit-row metadata.

Body template:
```
{eventTitle} — {humanDate}

{schoolName} has published a new alumni event. Log in to RSVP.
```
Where `humanDate` = `Sat, June 15, 2026 — 6:00 PM` style.

Metadata:
```ts
{ eventId, eventTitle, startAt: startAt.toISOString() }
```

Per-recipient errors are logged via `console.error` and do not abort fan-out.

## 9. Admin UI

### 9.1 `/graduation/alumni-events` list page

`page.tsx` server-loads the first page via `getAlumniEventListAction({ page: 1, pageSize: 20 })`. Renders `<EventsListClient initialRows initialPagination aggregates />`.

`events-list-client.tsx`:
- Top: status pill filter (All / Drafts / Published / Canceled), date-range filter (defaults: upcoming + past 30 days), "+ New event" button (opens create modal).
- Table columns: Title (clickable → detail) · Status badge · StartAt · YES count · Confirmed headcount (with capacity if set) · Waitlist count · Created by · Actions (Edit, Publish if draft, Cancel if published).
- Pagination footer.
- Edit/create modal mounted via `setEditing(row|null)` — uses shared `EventFormModal`.

Empty state: "No alumni events yet. Click '+ New event' to create your first."

### 9.2 `/graduation/alumni-events/[id]` detail page

`page.tsx` server-loads via `getAlumniEventDetailAction(eventId)`. Renders `<EventDetailClient event rsvps />`.

`event-detail-client.tsx`:
- Header: title, status badge, start/end times, location, virtualLink (click-to-copy + "Open" link), capacity progress bar (`confirmedHeadcount / capacity` if set).
- Action buttons (status-dependent):
  - DRAFT → "Publish" (primary) + "Edit".
  - PUBLISHED → "Cancel event" (destructive, confirm dialog) + "Edit".
  - CANCELED → no action buttons; "Canceled on {date}" banner.
- RSVP table: Photo · Name · Class of {year} · Response pill · Guest count · Waitlisted? (badge) · Responded at. Sortable by response.
- "Download CSV" button at bottom — exports the RSVP rows.

### 9.3 `event-form-modal.tsx`

Single modal handles create + edit. Fields per Section 7.1's input shape. Fixed position overlay; backdrop click closes; submit calls the appropriate action (create or update); success → toast + close + parent refresh.

### 9.4 Sidebar nav

Add to `src/lib/navigation.ts` under the existing graduation/alumni group:
```
{ label: "Alumni events", href: "/graduation/alumni-events", icon: "CalendarDays", permission: PERMISSIONS.GRADUATION_READ }
```

## 10. Alumni-facing UI

### 10.1 `/alumni/events` list

`page.tsx` server-loads via `getMyAlumniEventsAction({ tab: "upcoming" })`. Renders `<EventsListClient initialRows />`.

`events-list-client.tsx`:
- Tab strip: Upcoming / Past. Switch via `useTransition` calling `getMyAlumniEventsAction({ tab })`.
- Card grid (1-up mobile, 2-up desktop). Each card:
  - Title (clickable → detail page)
  - Start date/time (humanized) + duration if endAt set
  - Location summary ("Online" if only `virtualLink`; "Online + venue" if both; raw location otherwise)
  - Own-RSVP pill (right side): "YES — bringing 1 guest" / "MAYBE" / "NO" / "Not responded".
  - "Filling up" or "Waitlist only" hint when `confirmedHeadcount` near or at `capacity`.
- Past tab: cards greyed; RSVP pill read-only; CANCELED events show "Canceled" badge.

Empty states: upcoming = "No upcoming alumni events. Check back soon." Past = "No past events to show."

### 10.2 `/alumni/events/[eventId]` detail

`page.tsx` server-loads via `getMyAlumniEventDetailAction(eventId)`. Renders `<EventDetailClient event myRsvp />`.

`event-detail-client.tsx`:
- Header: title, humanized startAt/endAt, location, virtualLink (click-to-copy + "Join now" link).
- Description: rendered as plain text with whitespace preserved (`whitespace-pre-wrap`). No markdown rendering at MVP — keeps the surface predictable and avoids XSS concerns. Future enhancement if needed.
- RSVP card at bottom:
  - Three radio buttons: Yes / No / Maybe (default = current `myRsvp.response`).
  - Guest count number input (visible only when `response === "YES"` AND `event.maxGuestsPerRsvp > 0`; range `0..max`).
  - "Save RSVP" button → `upsertMyEventRsvpAction(...)`. Toast on success/failure.
  - After save, if `waitlisted: true`: yellow banner "This event is at capacity. You're on the waitlist; the school will let you know if a spot opens."
  - Locked states (read-only card):
    - `event.status === CANCELED` → "This event was canceled by the school."
    - `event.rsvpDeadline < now` → "RSVP closed on {date}".
    - `event.startAt < now` → "Event has already taken place."

### 10.3 Portal nav

Add "Events" entry to `src/app/(portal)/portal-nav.tsx`'s `alumniLinks` array. Link → `/alumni/events`. Order: Profile, Events, Directory.

## 11. Edge cases & error handling

| Scenario | Behavior |
|---|---|
| Admin edits PUBLISHED event | Silent update; no re-fan-out. Documented limitation: alumni who said YES not alerted. |
| Admin cancels event | RSVPs preserved; new RSVP attempts rejected; alumni see banner. |
| Alumnus RSVPs after `rsvpDeadline` | `{ error: "RSVP deadline has passed" }`. UI shows read-only card pre-emptively. |
| Alumnus RSVPs after `startAt` | `{ error: "Event has already taken place" }`. |
| Alumnus RSVPs on DRAFT or CANCELED | Generic `{ error: "Event not available" }` (avoids leaking draft existence). |
| `guestCount > maxGuestsPerRsvp` | zod rejects: `{ error: "At most {N} guests allowed" }`. |
| Alumnus changes YES → NO when previously waitlisted | Clear `waitlisted: false` on their own row. **No automatic promotion** of others. |
| Alumnus changes YES guests=2 → guests=0 | Same: capacity may now allow promotion, but admin handles offline. |
| Two alumni RSVP YES at exact capacity boundary | Both reads see `headcount < capacity`; both writes land non-waitlisted (small overflow). Acceptable for MVP. |
| Tenant isolation | Every action scopes by `ctx.schoolId`; explicit post-fetch `event.schoolId === ctx.schoolId` on `findUnique` calls. |
| Alumnus with `student.userId === null` | Excluded from publish fan-out (filter on null userId in helper). |
| Alumnus ungraduated post-RSVP | Defense-in-depth status check fails on next request; existing RSVP row preserved. |
| Notification fan-out failure | Caught in publish-action try/catch; publish state-transition still commits; logged with eventId. |
| `virtualLink` invalid URL | zod URL validator rejects. |
| Description very long | Capped at 5000 chars (events allow more than profile bio's 2000). |
| Concurrent admin publish clicks | Idempotent — already-PUBLISHED returns existing event without re-firing fan-out. |
| Cascade deletes | AlumniEvent → School: Cascade. AlumniEvent.createdBy → User: SetNull. AlumniEventRsvp → AlumniEvent: Cascade. AlumniEventRsvp → AlumniProfile: Cascade. |

## 12. Testing strategy

### 12.1 Unit tests (vitest + prismaMock)

- `tests/unit/modules/alumni-events/admin-events.test.ts` — covers all 6 admin actions: auth reject, zod validation, CANCELED-edit reject, idempotent publish, idempotent cancel, fan-out failure non-rollback, headcount/waitlist aggregates correct, sort order on detail.
- `tests/unit/modules/alumni-events/alumni-events.test.ts` — covers 3 alumnus actions: auth + status reject, upcoming vs past tab logic, DRAFT events hidden, CANCELED events shown in past, RSVP-on-DRAFT rejected, deadline-passed reject, startAt-passed reject, guest-count-over-max reject, capacity-not-set means waitlisted=false always, capacity-exceeded sets waitlisted=true, idempotent upsert.
- `tests/unit/modules/alumni-events/events-notifications.test.ts` — fan-out helper: default channels respected, prefs override, per-recipient error swallowed (assert second recipient still reached), null-userId alumni filtered out, empty recipient list short-circuits.
- `tests/unit/auth/permissions.test.ts` — extend alumni-role assertion to expect 4 perms.

### 12.2 Integration test (live DB)

`tests/integration/students/alumni-events.test.ts`:
1. Seed admin + 3 graduated alumni (one with userId, two without). Reuse cleanup-ordering pattern from `alumni-lifecycle.test.ts`.
2. As admin: create draft → publish → assert status=PUBLISHED, fan-out helper called.
3. Alumnus #1 (with userId): RSVP YES guests=1 → assert row, waitlisted=false (capacity null).
4. Admin cancels event → assert status=CANCELED, RSVP preserved, RSVP attempts now rejected.
5. Create event with capacity=2 → publish. Alumnus #1 RSVPs YES guests=1 (headcount=2) → not waitlisted. Alumnus #2 RSVPs YES guests=0 → waitlisted=true.
6. Tenant isolation: forged-school `findFirst` returns null.

### 12.3 Verification gates (mirror PR #29 / sub-project A)

- `npx vitest run` — all pass
- `npm run test:students` — pass (or skip if DB unreachable)
- `npx tsc --noEmit` — clean
- `npm run build` — `/alumni/events`, `/alumni/events/[eventId]`, `/graduation/alumni-events`, `/graduation/alumni-events/[id]` all in route manifest
- `npm run lint` — 0 errors
- `npx prisma migrate status` — new migration applied
- Audit guardrail — write actions audit; read actions tagged `@no-audit`

## 13. Critical files for implementation

| File | Action |
|---|---|
| `prisma/schema/communication.prisma` (or adjacent) | Modify (append `AlumniEvent`, `AlumniEventRsvp`, 2 enums; add back-relations on School/User/AlumniProfile) |
| `prisma/schema/migrations/<timestamp>_add_alumni_events/migration.sql` | Create |
| `src/lib/permissions.ts` | Modify (2 new perms, alumni role bundle update) |
| `prisma/seed/index.ts` | Modify (mirror) |
| `src/lib/notifications/events.ts` | Modify (1 new event + EVENT_CHANNELS) |
| `src/modules/alumni-events/events-notifications.ts` | Create |
| `src/modules/alumni-events/schemas/event.schema.ts` | Create |
| `src/modules/alumni-events/actions/admin-events.action.ts` | Create |
| `src/modules/alumni-events/actions/alumni-events.action.ts` | Create |
| `src/app/(dashboard)/graduation/alumni-events/page.tsx` + `events-list-client.tsx` | Create |
| `src/app/(dashboard)/graduation/alumni-events/[id]/page.tsx` + `event-detail-client.tsx` | Create |
| `src/app/(dashboard)/graduation/alumni-events/event-form-modal.tsx` | Create |
| `src/app/(portal)/alumni/events/page.tsx` + `events-list-client.tsx` | Create |
| `src/app/(portal)/alumni/events/[eventId]/page.tsx` + `event-detail-client.tsx` | Create |
| `src/lib/navigation.ts` | Modify (admin sidebar entry) |
| `src/app/(portal)/portal-nav.tsx` | Modify (alumni nav row) |
| `tests/unit/modules/alumni-events/*` | Create (3 test files) |
| `tests/unit/auth/permissions.test.ts` | Modify (extend alumni role test) |
| `tests/integration/students/alumni-events.test.ts` | Create |

## 14. Open follow-ups (deferred to future work)

- **Attendance check-in** — admin-side post-event marking of who actually attended; QR-code on RSVP confirmation; mobile-friendly check-in surface.
- **Reminder notifications** — automatic 24h-before push to YES + MAYBE alumni; cron / scheduled-job dependency.
- **Edit-and-renotify** — explicit "Notify of change" button on PUBLISHED-event edit modal.
- **Automatic waitlist promotion** — when a YES alumnus drops their RSVP or reduces guests, auto-promote a waitlisted alumnus and notify them.
- **Audience targeting** — graduation-year ranges, industry tags.
- **Recurring events** — series of weekly meetups under one parent event.
- **Ticketing / paid events** — fee per RSVP via the existing finance module.
- **Public-internet event pages** — SEO-discoverable event listings with field redaction.
- **Concurrency tightening on waitlist computation** — wrap count + write in a transaction.
- **Per-RSVP message field** — alumnus can leave a short note ("bringing my spouse and 2 kids").
