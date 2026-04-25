# Alumni Lifecycle — Foundation + Self-Service (Sub-project A)

**Date:** 2026-04-25
**Tier 2 #7 sub-project A** (foundation; B/C/D are separate sub-projects covering events, donations, mentorship)

## 1. Summary

Build the foundational alumni surface so graduates can claim, maintain, and discover each other's profiles. This is the base layer that subsequent sub-projects (events, donations, mentorship) build on — they all depend on alumni being able to log in.

Concretely, this sub-project:
- Auto-seeds an `AlumniProfile` and flips the linked `User.role` to `alumni` inside the existing `confirmGraduationRecordAction` transaction.
- Adds an alumni-facing portal at `/alumni/*` with two pages: profile self-service and a read-only directory of public profiles.
- Replaces the existing admin alumni page (`/graduation/alumni`) with a richer dashboard powered by `AlumniProfile` rather than the Student-status query, surfacing profile completeness, public/private status, "needs invite" callouts, year breakdowns, and top industries.
- Introduces a new `alumni` role with two new permission constants (`ALUMNI_PROFILE_UPDATE_OWN`, `ALUMNI_DIRECTORY_READ`).

## 2. Goals & non-goals

**Goals**
- Graduates with an existing student-portal `User` row land on `/alumni/*` after their next login post-graduation, with a populated profile they can edit.
- Alumni who toggle `isPublic = true` are visible to other alumni in the same school via a directory.
- Admins get an alumni dashboard that's actually backed by `AlumniProfile` and prioritises outreach work (incomplete profiles, needs-invite callouts).
- Strict tenant isolation: alumni from School X cannot see alumni from School Y; `isPublic` does not mean internet-public.
- Defense-in-depth authorization: alumni-side actions check both the new `alumni` role and `student.status === GRADUATED`.

**Non-goals**
- Alumni events, RSVPs, donations, mentorship — separate sub-projects.
- Magic-link or auto-invite-on-graduation for graduates without a User row — admin sees a "needs invite" callout but actually issuing the invite is deferred.
- Internet-public alumni pages with SEO/redaction — a future-only consideration. `isPublic` is strictly intra-school.
- Reverse hooks (un-graduating a student doesn't auto-revert the alumni profile or User role).
- Migration to extract every existing graduate into AlumniProfile rows — only graduates confirmed *after* this lands get auto-seeded. Pre-existing graduates can be onboarded via the existing `upsertAlumniProfileAction`.

## 3. User decisions (recorded from brainstorming)

| Q | Decision |
|---|---|
| Q1 — Authentication | A — same User row as before, role flips student → alumni on confirmed graduation |
| Q2 — Auto-seed trigger | A — inside `confirmGraduationRecordAction` only; promotion-flow path is rare and stays manual |
| Q3 — Portal scope | B — profile self-service + read-only directory; no DMs, no friend connections |
| Q4 — `isPublic` semantics | B — visible to authenticated alumni in same school + admins always see all |
| Q5 — Role + permissions | C — new `alumni` role plus defense-in-depth `student.status === GRADUATED` check on every alumni-side server action |
| Q6 — Graduation hook side effects | B — auto-flip `User.role` if `student.userId` is set; if null, just create the profile and surface "needs invite" to admins |
| Q7 — Admin page | C — replace with richer dashboard powered by AlumniProfile (year groupings, industry breakdown, "needs invite" callout, completeness filters) |

## 4. Architecture

### 4.1 New module: `src/modules/alumni/`

- `actions/alumni-self.action.ts` — alumni-side actions (`getMyAlumniProfileAction`, `updateMyAlumniProfileAction`, `getAlumniDirectoryAction`, `getPublicAlumniProfileAction`).
- `actions/alumni-admin.action.ts` — `getAlumniDashboardAction` (replaces `getAlumniAction` for the admin page; existing `upsertAlumniProfileAction` stays in `graduation/actions/alumni.action.ts` and remains the admin write path).
- `alumni-graduation-hook.ts` — pure helper `seedAlumniOnGraduation(tx, { studentId, schoolId, graduationRecord })` called from `confirmGraduationRecordAction` inside the existing transaction.
- `schemas/alumni-self.schema.ts` — zod schemas for the self-service update input.

### 4.2 New portal surfaces

- `src/app/(portal)/alumni/layout.tsx` — gates the route group on `alumni` role. Mirrors the parent-portal layout pattern.
- `src/app/(portal)/alumni/profile/page.tsx` + `profile-client.tsx` — alumnus reads + edits their own profile.
- `src/app/(portal)/alumni/directory/page.tsx` + `directory-client.tsx` — alumnus browses other public profiles.

### 4.3 Revamped admin surface

- `src/app/(dashboard)/graduation/alumni/page.tsx` — replaces the data source from `getAlumniAction` to `getAlumniDashboardAction`.
- `src/app/(dashboard)/graduation/alumni/alumni-client.tsx` — rewritten with stat cards, filters, completeness column, side widgets.
- `src/app/(dashboard)/graduation/alumni/alumni-edit-modal.tsx` — admin edit modal calling existing `upsertAlumniProfileAction`.

### 4.4 Edits to existing files

- `src/modules/graduation/actions/graduation.action.ts::confirmGraduationRecordAction` — calls `seedAlumniOnGraduation(tx, ...)` inside the transaction.
- `src/lib/permissions.ts` — two new permission constants + `alumni` role array.
- `src/lib/navigation.ts` — sidebar entry for `/alumni/profile` and `/alumni/directory`.
- `src/lib/auth.ts` — `alumni` role recognised in role-based redirects (after login, alumni land at `/alumni/profile`).

## 5. Data model

### 5.1 No schema changes

`AlumniProfile` already has every field needed:

```
studentId @unique, schoolId, graduationYear,
email, phone, address,
currentEmployer, currentPosition, industry, highestEducation, linkedinUrl, bio,
isPublic (default false), createdAt, updatedAt
```

The existing `studentId @unique` constraint guarantees idempotent upsert from the graduation hook.

### 5.2 Derived fields (computed at query time, not stored)

- **`profileCompleteness`** — heuristic 0–100 score based on which of these are populated: `email`, `phone`, `currentEmployer`, `currentPosition`, `industry`, `highestEducation`, `linkedinUrl`, `bio`. Each populated field contributes 12.5%; rounded to nearest integer. Surfaced in admin dashboard.
- **`needsInvite`** — `linked Student.userId === null`. Surfaced as a count in the admin stat strip and as a row badge.

### 5.3 Role mutation behaviour

`User.role` is a free-form string used by the role-permission map. On graduation hook:
- If `student.userId !== null`: `tx.user.update({ where: { id: student.userId }, data: { role: "alumni" } })`.
- If `student.userId === null`: skip the user update entirely.

No enum migration needed; `User.role` already accepts arbitrary strings (existing roles include `parent`, `student`, `class_teacher`, etc.).

## 6. Permissions

### 6.1 New constants in `src/lib/permissions.ts`

```ts
ALUMNI_PROFILE_UPDATE_OWN: "alumni:profile:update-own",
ALUMNI_DIRECTORY_READ:     "alumni:directory:read",
```

### 6.2 New role + grants

```ts
alumni: [
  PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN,
  PERMISSIONS.ALUMNI_DIRECTORY_READ,
],
```

The new role inherits nothing else — strictly scoped to the alumni surface.

### 6.3 Existing admin permissions

`GRADUATION_READ` and `GRADUATION_CREATE` continue to gate the admin alumni dashboard and the existing `upsertAlumniProfileAction`. No changes to admin role grants.

### 6.4 Server-action gating pattern

Every alumni-side action follows this pattern:

```ts
const ctx = await requireSchoolContext();
if ("error" in ctx) return ctx;
const denied = assertPermission(ctx.session, PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN);
if (denied) return denied;

const student = await db.student.findFirst({
  where: { userId: ctx.session.user.id, schoolId: ctx.schoolId, status: "GRADUATED" },
  select: { id: true },
});
if (!student) return { error: "Alumni access not available." };
```

Both checks must pass: role grants the permission, status confirms eligibility. Two locks > one.

## 7. Server actions

### 7.1 `alumni-self.action.ts`

#### `getMyAlumniProfileAction()`
- Gates: `ALUMNI_PROFILE_UPDATE_OWN` + `student.status === GRADUATED`.
- Reads the AlumniProfile via `student.userId === session.user.id` (joined). Returns full row + linked Student name/photo/studentId/dateOfBirth + GraduationRecord (if any) for ceremony/honours/certificate display.
- Tagged `/** @no-audit */`.

#### `updateMyAlumniProfileAction(input)`
- Gates: `ALUMNI_PROFILE_UPDATE_OWN` + status check.
- Input shape (zod-validated):
  ```ts
  {
    email?: string,         // RFC email
    phone?: string,         // 6–32 chars, loose
    address?: string,       // max 500
    currentEmployer?: string, // max 200
    currentPosition?: string, // max 200
    industry?: string,      // max 200
    highestEducation?: string, // max 200
    linkedinUrl?: string,   // valid URL or empty string
    bio?: string,           // max 2000
    isPublic?: boolean,
  }
  ```
- Resolves the alumnus's own AlumniProfile via the linked Student, then updates only the supplied fields. `graduationYear`, `studentId`, `schoolId` are NOT in the input shape.
- Audits `UPDATE` with `entity: "AlumniProfile"`, `entityId: profile.id`, previousData and newData diffs.

#### `getAlumniDirectoryAction(filters)`
- Gates: `ALUMNI_DIRECTORY_READ` + status check.
- Filters: `{ search?: string, graduationYear?: number, industry?: string, page?: number, pageSize?: number }`.
- Queries `AlumniProfile` where `schoolId === ctx.schoolId`, `isPublic === true`, and `studentId !== ownStudentId`.
- Search: case-insensitive contains on linked Student firstName/lastName.
- Field projection (the alumni-public shape): `id`, `studentId`, `firstName`, `lastName`, `photoUrl`, `graduationYear`, `currentEmployer`, `currentPosition`, `industry`, `highestEducation`, `linkedinUrl`, `bio`. NEVER `email`, `phone`, `address`.
- Pagination: defaults `page=1, pageSize=20`. Returns `{ data, pagination: { page, pageSize, total, totalPages } }`.
- Tagged `/** @no-audit */`.

#### `getPublicAlumniProfileAction(studentId)`
- Gates: `ALUMNI_DIRECTORY_READ` + status check.
- Returns the alumni-public shape (same projection as directory) for one profile, scoped to same school + `isPublic === true`.
- 404 shape (`{ error: "Profile not found" }`) for private profiles, other-school profiles, or non-existent IDs — to avoid leaking existence.
- Tagged `/** @no-audit */`.

### 7.2 `alumni-admin.action.ts`

#### `getAlumniDashboardAction(filters)`
- Gates: `GRADUATION_READ`.
- Filters: `{ search?: string, graduationYear?: number, industry?: string, status?: "all"|"public"|"private"|"incomplete"|"needs_invite", page?: number, pageSize?: number }`.
- Queries `AlumniProfile` left-joined to Student (and User for `needsInvite` derivation).
- `status === "incomplete"`: `bio == null && currentEmployer == null` (heuristic).
- `status === "needs_invite"`: linked `Student.userId === null`.
- Returns `{ data: rows, pagination, aggregates: { total, publicCount, privateCount, needsInviteCount, byYear: { year, count }[], topIndustries: { industry, count }[] } }`.
- Each row includes computed `profileCompleteness` (0–100).
- Tagged `/** @no-audit */`.

### 7.3 Existing actions kept

- `upsertAlumniProfileAction` (in `graduation/actions/alumni.action.ts`) — admin-side full edit; UI calls this from the dashboard's edit modal. Already gated on `GRADUATION_CREATE`. No changes.
- `getAlumniGraduationYearsAction` — reused for filter dropdowns (alumni directory and admin dashboard).

## 8. Graduation hook

### 8.1 Hook helper

`src/modules/alumni/alumni-graduation-hook.ts::seedAlumniOnGraduation(tx, input)`:

```ts
export async function seedAlumniOnGraduation(
  tx: Prisma.TransactionClient,
  input: {
    studentId: string;
    schoolId: string;
    graduationRecord: { batch: { ceremonyDate: Date | null } };
  },
): Promise<{ profileId: string; userRoleFlipped: boolean }>
```

Steps inside the transaction:
1. Read `student.userId` + `student.user?.email` (selectively).
2. Derive `graduationYear` from `record.batch.ceremonyDate.getFullYear()` or fallback to current year (with `console.warn` for the fallback path).
3. `tx.alumniProfile.upsert({ where: { studentId }, create: { ... isPublic: false }, update: {} })` — empty update to preserve existing edits if re-confirmed.
4. If `student.userId !== null`: `tx.user.update({ where: { id }, data: { role: "alumni" } })`.
5. Return `{ profileId, userRoleFlipped }`.

### 8.2 Caller integration

`confirmGraduationRecordAction` — wrap the existing two updates and the new hook in a single `db.$transaction`:

```ts
const result = await db.$transaction(async (tx) => {
  const updated = await tx.graduationRecord.update({ ... });
  await tx.student.update({ ... });
  const seeded = await seedAlumniOnGraduation(tx, {
    studentId: record.studentId,
    schoolId: ctx.schoolId,
    graduationRecord: { batch: record.batch },
  });
  return { updated, seeded };
});

await audit({ ... existing GraduationRecord audit ... });
await audit({
  userId: ctx.session.user.id,
  action: "CREATE",
  entity: "AlumniProfile",
  entityId: result.seeded.profileId,
  module: "alumni",
  description: `Auto-seeded alumni profile on graduation confirmation`,
  metadata: { studentId: record.studentId, autoSeeded: true, userRoleFlipped: result.seeded.userRoleFlipped },
});
```

Both audits land after commit; either failure rolls back the transaction.

## 9. Alumni-facing portal UI

### 9.1 Layout

`src/app/(portal)/alumni/layout.tsx`:
- `auth()` → if no session: redirect `/login`.
- If session.user.role !== "alumni": redirect to the role's natural home (`/parent/*` for parents, `/student/*` for students, `/dashboard` for staff). Defensive — should not normally trigger.
- Renders sidebar with two entries: "My profile" (`/alumni/profile`), "Directory" (`/alumni/directory`).

### 9.2 `/alumni/profile`

- `page.tsx` server-loads via `getMyAlumniProfileAction()`. If `{ error: "Alumni access not available." }` (status check failed), show a polite "This account isn't recognised as an alumni account" message with a logout link.
- `profile-client.tsx` renders an editable form. Fields per Section 6 of brainstorming. `isPublic` toggle has helper text: "Make my profile visible to other alumni from this school".
- Save calls `updateMyAlumniProfileAction` via `useTransition`. Success → sonner toast "Profile updated". Error → error toast with the action's error string, plus per-field zod errors inline. Form library follows whatever pattern the surrounding portal pages already use (most existing portal forms use plain `useState` rather than `react-hook-form` — implementer matches the precedent).
- Read-only header: name, photo, graduationYear, certificateNumber + honours from GraduationRecord.

### 9.3 `/alumni/directory`

- `page.tsx` server-loads first page via `getAlumniDirectoryAction({ page: 1, pageSize: 20 })`.
- `directory-client.tsx`:
  - Filter bar at top: name search input, graduation-year dropdown (populated by `getAlumniGraduationYearsAction`), industry dropdown (free-text autocomplete from values present in current page).
  - Card grid (3-up desktop, 1-up mobile): photo, name, graduation year, employer + position, industry, LinkedIn icon link.
  - Click card → modal showing the alumni-public shape (full bio, education).
  - Pagination: Previous / Next + "Page X of Y, N total".
  - Empty states: "No alumni have made their profiles public yet. Be the first — toggle visibility on your profile." / "No alumni match these filters."
- No write actions in directory.

## 10. Admin dashboard rework

### 10.1 Page composition

`/graduation/alumni/page.tsx` server-loads via `getAlumniDashboardAction({ page: 1, pageSize: 20 })`. Existing breadcrumb + nav entry stay.

### 10.2 Stat strip (top)

Three cards:
- **Total alumni** — `aggregates.total`
- **Public profiles** — `aggregates.publicCount` + percentage of total
- **Needs invite** — `aggregates.needsInviteCount`. Click filters the table to `status: "needs_invite"`.

### 10.3 Filter bar

- Search input (name or studentId)
- Graduation-year dropdown (from `getAlumniGraduationYearsAction`)
- Industry dropdown (from `aggregates.topIndustries` plus a freeform option)
- Status pills: "All" / "Public" / "Private" / "Incomplete" / "Needs invite"

### 10.4 Main table

Columns:
- Photo + name (clickable → opens edit modal)
- Student ID
- Graduation year
- Profile completeness (0–100% as a small bar)
- Public/Private badge
- Employer + position (truncated)
- Last updated (relative time, e.g. "3 days ago")
- Action: pencil icon → opens edit modal

Pagination matches existing pattern (Previous / Next).

### 10.5 Side widgets

- **Top industries** — top-5 from `aggregates.topIndustries`. Plain text bars (no chart lib needed).
- **Graduation-year breakdown** — vertical list, year + count, sorted desc.

### 10.6 Edit modal

`alumni-edit-modal.tsx`:
- Display-only: studentId, schoolId, graduationYear (admin can edit graduationYear if needed via the input below).
- Editable: graduationYear, email, phone, address, currentEmployer, currentPosition, industry, highestEducation, linkedinUrl, bio, isPublic.
- Calls existing `upsertAlumniProfileAction`. Success → close + refresh. Error → error toast.

## 11. Edge cases & error handling

| Scenario | Behavior |
|---|---|
| Graduation reverted (admin manually flips status away from GRADUATED) | AlumniProfile + User role stay; defense-in-depth status check rejects further alumni-side actions with "Alumni access not available." |
| `student.userId === null` at confirmation | Profile auto-seeds; no role flip; admin sees "Needs invite" callout |
| Email collision on auto-seed | `email` is a one-time copy from `student.user.email`. Subsequent alumnus-side edits modify only the AlumniProfile.email; User.email stays auth-managed |
| Idempotent re-confirmation | `alumniProfile.upsert` with empty `update` payload → no-op for existing profiles; preserves any alumnus edits |
| Directory shows alumnus's own profile | `getAlumniDirectoryAction` filters `studentId !== ownStudentId` |
| Cross-school leakage | Every action scopes by `ctx.schoolId`; every `findUnique` followed by explicit `result.schoolId === ctx.schoolId` check (mirrors PR #29 pattern) |
| Invalid input on update | zod field-specific errors returned in `{ error }`; form surfaces inline |
| Missing GraduationRecord at seed time | Defensive fallback to current year + `console.warn` (shouldn't happen — hook is called from `confirmGraduationRecordAction`) |
| Concurrent re-confirmation of the same record | Transaction serialises; second call's upsert update branch is empty → no observable double-write |

## 12. Testing strategy

### 12.1 Unit tests

- `tests/unit/modules/alumni/alumni-graduation-hook.test.ts` — hook idempotency, role-flip happens iff userId set, profile created with `isPublic: false`, graduationYear derivation + fallback.
- `tests/unit/modules/alumni/alumni-self.test.ts` — all 4 self-service actions: auth reject, status reject, happy paths, update with invalid email, directory excludes self + private + other-school, public-profile-by-id 404 on private/missing.
- `tests/unit/modules/alumni/alumni-admin.test.ts` — `getAlumniDashboardAction` returns rows + aggregates; filter pills work; permission rejects unauthorized.
- `tests/unit/auth/permissions.test.ts` — extend with one regression test asserting `alumni` role contains exactly the two new permissions; `student` role does NOT contain them; cross-checks for parent and class_teacher.

### 12.2 Integration tests (live DB)

`tests/integration/students/alumni-lifecycle.test.ts`:
1. Student with linked User row → `confirmGraduationRecordAction` → assert AlumniProfile created + User.role flipped.
2. Student with no User row → `confirmGraduationRecordAction` → assert AlumniProfile created + no User flip + dashboard shows `needsInvite: true`.
3. Alumnus toggles `isPublic: true` → second alumnus calls `getAlumniDirectoryAction` → first appears with redacted fields (no email/phone/address).
4. Tenant isolation: profile from school A invisible to alumnus in school B.

### 12.3 Verification gates

Mirror PR #29 (Tier 2 #6 D2):
- `npx vitest run` — all pass
- `npm run test:students` — pass
- `npx tsc --noEmit` — clean
- `npm run build` — `/alumni/profile`, `/alumni/directory` compile
- `npm run lint` — 0 errors
- `npx prisma migrate status` — up to date (no new migration)
- Audit guardrail — `updateMyAlumniProfileAction` carries audit; read actions tagged `@no-audit`

## 13. Critical files for implementation

| File | Action |
|---|---|
| `src/modules/alumni/alumni-graduation-hook.ts` | Create |
| `src/modules/alumni/actions/alumni-self.action.ts` | Create |
| `src/modules/alumni/actions/alumni-admin.action.ts` | Create |
| `src/modules/alumni/schemas/alumni-self.schema.ts` | Create |
| `src/app/(portal)/alumni/layout.tsx` | Create |
| `src/app/(portal)/alumni/profile/page.tsx` + `profile-client.tsx` | Create |
| `src/app/(portal)/alumni/directory/page.tsx` + `directory-client.tsx` | Create |
| `src/app/(dashboard)/graduation/alumni/page.tsx` | Modify (replace data source) |
| `src/app/(dashboard)/graduation/alumni/alumni-client.tsx` | Modify (rewrite) |
| `src/app/(dashboard)/graduation/alumni/alumni-edit-modal.tsx` | Create |
| `src/modules/graduation/actions/graduation.action.ts::confirmGraduationRecordAction` | Modify (call hook in transaction) |
| `src/lib/permissions.ts` | Modify (2 permissions + alumni role) |
| `src/lib/navigation.ts` | Modify (alumni sidebar) |
| `src/lib/auth.ts` | Modify (alumni role redirect) |
| `tests/unit/modules/alumni/*` | Create (3 test files) |
| `tests/unit/auth/permissions.test.ts` | Modify (1 regression test) |
| `tests/integration/students/alumni-lifecycle.test.ts` | Create |

## 14. Open follow-ups (deferred to future sub-projects)

- **Alumni invite flow** — bulk-invite/email magic-link for graduates without User rows. Surfaces as the natural follow-up to "needs invite" callouts.
- **Sub-project B** — Alumni events + RSVPs.
- **Sub-project C** — Donation pledges (alumni-facing; finance integration).
- **Sub-project D** — Mentorship matching.
- **Internet-public profile pages** — `/schools/<slug>/alumni/<id>` for SEO/discoverability with field redaction. Adds GDPR scope.
- **Bulk migration of pre-existing graduates** — populate AlumniProfile rows for graduates confirmed before this lands. One-shot script or admin "backfill" action.
- **Reverse hook** — admin "ungraduate" with auto-revert of profile + role.
