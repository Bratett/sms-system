# Household / Family Grouping + Guardian Deduplication — Design

**Date:** 2026-04-23
**Status:** Approved
**Tier:** 2 — item #5 from the Students module review

## 1. Context

Guardians and students currently relate via a `StudentGuardian` join table (many-to-many with an `isPrimary` flag). There's no explicit notion of a "household" — siblings are implicit from shared guardian links, and the system offers no UI signal for the relationship. Worse, the create path on `Guardian` is unguarded: any admin can create a second record for an existing guardian by typo or careless paste, silently splitting one family into two.

This spec introduces a `Household` entity that directly owns both guardians and students, plus a deduplication workflow that checks on guardian create and via an admin scan, and a sibling card on the student profile proving the model end-to-end.

A latent security bug in `getGuardiansAction` (no `schoolId` filter on the where clause — cross-tenant leak) is **in scope** and fixed as part of Task 1 because we're already editing the file.

## 2. Scope

**In scope**
- New `Household` Prisma model + optional `householdId` on `Guardian` and `Student`
- Two-stage migration: schema additions + data backfill script
- Guardian deduplication: pure matching helpers, create-time check, admin scan page, merge workflow with survivor selection
- Sibling card on the student profile overview tab
- Fix the latent schoolId leak on `getGuardiansAction`
- Three new permissions + three new admin pages

**Out of scope**
- Sibling-discount rule in finance (downstream — Tier 3 work)
- Grouped parent communications (Tier 2 #6 territory)
- Single parent login seeing all children (Tier 2 #6 parent-portal upgrade)
- A full "Family" tab on the student profile (deferred until parent portal work)

## 3. Architecture

**Approach: split by concern.** Pure matching logic sits in `src/lib/guardian-matching.ts` (no Prisma), household CRUD in `src/modules/student/actions/household.action.ts`, the destructive merge in its own `guardian-merge.action.ts`, and sibling reads in `sibling.action.ts`. The existing `guardian.action.ts` gains a dedup hook at create time and a security-fix on read.

Data invariants (student's household matches guardians' households) are enforced at the action layer — not via DB constraint — because cross-table CHECK is awkward in Postgres + Prisma and the write paths are a narrow, controlled set.

```
UI Layer          actions                     pure helpers              Prisma
─────────         ────────────────────         ─────────────────         ──────
Siblings card ──► sibling.action.ts ───────────────────────────────────► db
Dedup prompt  ──► guardian.action.ts ─► guardian-matching.ts ──────────► db
Households    ──► household.action.ts ─────────────────────────────────► db
Merge UI      ──► guardian-merge.action.ts ────────────────────────────► db
Scan page     ──► guardian-merge.action.ts ─► guardian-matching.ts ────► db
```

## 4. Data Model

### New model: `Household`

```prisma
model Household {
  id        String   @id @default(cuid())
  schoolId  String
  name      String
  address   String?
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  guardians Guardian[]
  students  Student[]
  school    School @relation("SchoolHousehold", fields: [schoolId], references: [id])

  @@index([schoolId])
  @@index([schoolId, name])
}
```

### Modified models

```prisma
model Guardian {
  // existing fields unchanged
  householdId String?
  household   Household? @relation(fields: [householdId], references: [id], onDelete: SetNull)
  @@index([householdId])
}

model Student {
  // existing fields unchanged
  householdId String?
  household   Household? @relation(fields: [householdId], references: [id], onDelete: SetNull)
  @@index([householdId])
}
```

**Nullable FK choice.** A guardian or student can legitimately exist without a household (newly imported pre-backfill; emergency-contact-only guardians). `onDelete: SetNull` keeps the entity if its household is deleted. No CHECK constraint across tables — the action layer reconciles.

**Student ↔ Household invariant.** A student's `householdId` should equal the household of its primary guardian when one is linked. `linkGuardianToStudentAction` is modified to reconcile on every write: if the student has no household and the guardian does, the student is moved into the guardian's household. If both have conflicting households, the action returns an error instructing the admin to reconcile first.

## 5. Permissions

**New constants** (`src/lib/permissions.ts`):
```ts
HOUSEHOLDS_READ:   "students:households:read",
HOUSEHOLDS_MANAGE: "students:households:manage",
GUARDIANS_MERGE:   "students:guardians:merge",
```

**Grants:**

| Permission | Granted to |
|---|---|
| `HOUSEHOLDS_READ` | Every role that holds `STUDENTS_READ` (class_teacher, housemaster, nurse, counsellor, admissions, headmaster + assistants, subject_teacher, hod) |
| `HOUSEHOLDS_MANAGE` | `headmaster`, `assistant_headmaster_academic`, `assistant_headmaster_admin`, `admissions_officer` |
| `GUARDIANS_MERGE` | `headmaster`, `assistant_headmaster_admin` only |

`super_admin` inherits all three via `ALL_PERMISSIONS`.

The merge permission is the tightest because it's destructive and can break parent-portal accounts if the survivor is wrong. `HOUSEHOLDS_MANAGE` is moderate — creating/editing households is non-destructive to the underlying guardian/student data.

## 6. Pure Helpers — `src/lib/guardian-matching.ts`

```ts
/**
 * Strips non-digits and returns the last 9 digits.
 * Returns null if fewer than 9 digits after stripping.
 */
export function normalizePhone(phone: string | null | undefined): string | null;

/** Standard Levenshtein distance. Case-sensitive — caller normalises. */
export function levenshtein(a: string, b: string): number;

/**
 * Canonical name key: `${firstName}_${lastName}` lowercased + trimmed.
 */
export function nameKey(firstName: string, lastName: string): string;

type GuardianLite = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
};

export type MatchReason = "phone" | "email" | "name-fuzzy";

export type DuplicateMatch = {
  guardian: GuardianLite;
  reasons: MatchReason[];
};

/**
 * Given a candidate and a list of existing guardians (pre-filtered by
 * schoolId by the caller), returns matches whose normalised phone OR email
 * exactly equals the candidate's, OR whose nameKey has Levenshtein
 * distance <= 2 from the candidate's. Reasons list records every signal
 * that fired, ordered strongest-first: phone > email > name-fuzzy.
 */
export function findPotentialDuplicates(
  candidate: GuardianLite,
  existing: GuardianLite[],
): DuplicateMatch[];
```

**Performance.** `findPotentialDuplicates` is O(n) over `existing`. ~10k guardians per school → a few ms, acceptable for interactive create-time checks. Background scan uses a phone/email hash-map fast path.

## 7. Server Actions

### New: `src/modules/student/actions/household.action.ts`

| Action | Permission | Purpose |
|---|---|---|
| `getHouseholdsAction({ search? })` | `STUDENTS_READ` | List, search by name |
| `getHouseholdAction(id)` | `STUDENTS_READ` | Detail: guardians[] + students[] |
| `createHouseholdAction({ name, address?, notes? })` | `HOUSEHOLDS_MANAGE` | Create empty household |
| `updateHouseholdAction(id, patch)` | `HOUSEHOLDS_MANAGE` | Update name/address/notes |
| `deleteHouseholdAction(id)` | `HOUSEHOLDS_MANAGE` | Blocks on non-empty; clear error |
| `moveGuardianToHouseholdAction(guardianId, householdId \| null)` | `HOUSEHOLDS_MANAGE` | Reassign/remove |
| `moveStudentToHouseholdAction(studentId, householdId \| null)` | `HOUSEHOLDS_MANAGE` | Reassign/remove |

All mutations `audit()`.

### New: `src/modules/student/actions/guardian-merge.action.ts`

```ts
/**
 * Returns the merge impact without writing. Callers display the diff
 * and any blocking conflicts before user confirmation.
 */
previewMergeAction({ duplicateId, survivorId }): Promise<{
  data: {
    survivor: Guardian;
    duplicate: Guardian;
    fieldFills: Record<string, { from: unknown; to: unknown }>; // null fields that would be filled
    linksToTransfer: number;
    linksAlreadyShared: number;
  };
  conflicts: string[]; // e.g., ["both have parent portal accounts", "different households"]
} | { error: string }>

/**
 * Transactionally merges duplicate into survivor.
 */
performMergeAction({ duplicateId, survivorId }): Promise<{ data: { survivorId; absorbedLinks: number } } | { error: string }>

/**
 * Admin-triggered scan of all guardians in the current school. Returns
 * duplicate clusters for manual review.
 */
scanGuardianDuplicatesAction(): Promise<{
  data: Array<{ cluster: DuplicateMatch[]; confidence: "high" | "medium" }>;
} | { error: string }>
```

All three require `GUARDIANS_MERGE`. `performMergeAction` re-runs conflict checks inside the transaction (defense in depth) before mutating.

### New: `src/modules/student/actions/sibling.action.ts`

```ts
/** @no-audit read-only */
getSiblingsAction(studentId: string): Promise<{
  data: Array<{
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
    classArmName: string | null;
    programmeName: string | null;
  }>;
} | { error: string }>
```

Logic:
1. Load `Student.householdId`
2. If null → `{ data: [] }`
3. Fetch household.students WHERE id != input AND status != "WITHDRAWN"
4. Join current-year enrollment → classArm → class → programme for display
5. Sort by firstName

### Extended: `src/modules/student/actions/guardian.action.ts`

**Fix A (security — in scope because we're editing the file):** add `schoolId: ctx.schoolId` to the `where` clause in `getGuardiansAction`. Ship a regression test.

**Fix B (feature):** `createGuardianAction` gains an optional `options?: { skipDedupCheck?: boolean }` param. When unset (default), the action loads existing guardians in the school, runs `findPotentialDuplicates`, and if any match returns `{ duplicates: DuplicateMatch[], input }` without creating. UI handles. When `skipDedupCheck: true`, skips the check and creates as normal.

## 8. Data Backfill

Existing schools have guardians + students with no household. Two Prisma migrations and one idempotent script:

1. **`add_household_model`** — schema migration (table + 2 FK columns + indexes)
2. **Script at `scripts/backfill-households.ts`** — idempotent, skips already-backfilled records

### Algorithm

Per school:
1. Load every `StudentGuardian` row
2. Build an undirected graph: nodes = students ∪ guardians, edges = links
3. Compute connected components (union-find)
4. For each component:
   - Find the "primary guardian's last name" via `isPrimary = true`
   - Fallback: first guardian alphabetically by lastName
   - Create `Household { name: "{lastName} Family" }`
   - Set `Guardian.householdId` and `Student.householdId` for every member
5. Edge cases:
   - Isolated guardian (no linked students) → single-guardian household
   - Student with no linked guardians → leave `householdId` null
   - Mixed-surname component → primary's surname wins; otherwise alphabetic

### Operation

```
npx tsx scripts/backfill-households.ts              # production run
npx tsx scripts/backfill-households.ts --dry-run    # preview only
```

Manual invocation during a deploy window. Idempotent — re-run safely.

## 9. UI Surfaces

### Siblings card (student profile overview)

`src/app/(dashboard)/students/[id]/siblings-section.tsx` — client component. Loads via `getSiblingsAction(studentId)`. Renders:

```
┌─ Siblings ──────────────────────────────┐
│ Kofi Asante       SCH/2024/0012  SHS2A │
│ Akua Asante       SCH/2025/0034  SHS1B │
└─────────────────────────────────────────┘
```

Rows link to each sibling's profile. Empty states:
- No household: *"Not assigned to a household"* + link to the Households page (gated on `HOUSEHOLDS_MANAGE`)
- Household with no siblings: *"No siblings in household"*

### Households admin page

Route: `/students/households` (list) + `/students/households/[id]` (detail).

**List:** table with search box; columns name, address, guardian count, student count, created; "Create household" button (gated); "Scan duplicates" button (gated on `GUARDIANS_MERGE`) linking to `/students/households/duplicates`.

**Detail:** editable name/address/notes form; guardians section with remove button; students section with remove button; "Add guardian" / "Add student" search-pickers.

### Dedup prompt on guardian create

Identified during implementation in the existing guardian-create form. When `createGuardianAction` returns `{ duplicates }`, show a modal:

```
We found 2 existing guardians that might be this person:

  ● Kwame Asante • 024 123 4567 • phone, name
  ○ Akua Asante  • 020 987 6543 • name-fuzzy

[Use existing]  [Create new anyway]  [Cancel]
```

"Use existing" calls `linkGuardianToStudentAction(selectedGuardian)`. "Create new anyway" re-invokes with `skipDedupCheck: true`.

### Duplicate scan page

Route: `/students/households/duplicates`. Gated on `GUARDIANS_MERGE`. Calls `scanGuardianDuplicatesAction` and renders clusters. "Preview merge" → modal showing diff from `previewMergeAction` with conflicts flagged. "Confirm merge" fires `performMergeAction`.

## 10. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| `createGuardianAction` dedup match, no skip | Returns `{ duplicates, input }`, no DB write |
| `createGuardianAction` dedup with `skipDedupCheck: true` | Creates regardless (admin override) |
| Merge: both sides have `userId` | Preview flags `conflicts: ["both have parent portal accounts"]`; perform refuses |
| Merge: different households | Preview flags `conflicts: ["different households"]`; perform refuses |
| Merge: shared StudentGuardian link | Transfer skips duplicates; `isPrimary` preserved from duplicate if survivor's was false |
| `deleteHouseholdAction` on non-empty household | `{ error: "Cannot delete non-empty household (N guardians, M students)" }` |
| `getSiblingsAction` no household | `{ data: [] }` — quiet success |
| `getSiblingsAction` deleted household | `SetNull` FK clears; effectively empty |
| Concurrent merges on same duplicate | Second hits "Record not found" on delete; returns `{ error: "Guardian no longer exists" }` |
| Backfill re-run | Idempotent — filters `WHERE householdId IS NULL` |
| `linkGuardianToStudentAction` conflicting households | Returns `{ error: "Student and guardian are in different households" }` — admin reconciles first |
| Tenant isolation | Every query carries `schoolId`; `findPotentialDuplicates` receives pre-filtered list |
| Audit fails | Retries 3× per existing helper, then stderr; action continues |
| `getGuardiansAction` (pre-existing bug) | Fixed as part of Task 1: `where.schoolId = ctx.schoolId` added |

## 11. Testing Strategy

### Pure helpers — `tests/unit/lib/guardian-matching.test.ts` (~12)
- `normalizePhone`: strip punctuation, Ghana formats, `<9` digits returns null, null/undefined input
- `levenshtein`: identity, single edit, transposition, empty inputs
- `nameKey`: canonicalisation
- `findPotentialDuplicates`: each match reason fires alone, combined reasons order, no-match case

### Actions with Prisma mock
- `tests/unit/student/household.test.ts` (~10)
- `tests/unit/student/guardian-merge.test.ts` (~10)
- `tests/unit/student/sibling.test.ts` (~4)
- Extend `tests/unit/student/guardian.test.ts` (~5) — incl. schoolId regression

### Backfill script — `tests/unit/scripts/backfill-households.test.ts` (~4)
- Connected-component grouping
- Isolated-guardian case
- Idempotent re-run
- Dry-run writes nothing

### Integration — `tests/integration/students/households.test.ts` (~8, live DB)
- Seed 3 siblings + 2 guardians, run backfill, verify 1 household
- `getSiblingsAction` symmetric across all three
- Create-time dedup check fires
- Merge happy path: links transferred, duplicate deleted, audit written
- Tenant isolation across all endpoints

### Guardrails
- `audit-coverage.test.ts`: all new mutating actions have `audit()` calls; `getSiblingsAction` carries `@no-audit`
- `tests/unit/auth/permissions.test.ts`: assert the three new permissions exist and the expected role grants

**Net-new tests:** ~53.

## 12. Verification Plan

1. `npx vitest run` — all unit + helper + script tests pass
2. `npm run test:students` — integration suite including new households test
3. `npx vitest run tests/unit/guardrails/audit-coverage.test.ts` — passing
4. `npx tsc --noEmit` — clean
5. `npm run build` — success
6. `npm run lint` — no new errors
7. `npx prisma migrate dev --name add_household_model` — applies cleanly (no FK drift)
8. `npx tsx scripts/backfill-households.ts --dry-run` — prints sensible report
9. `npx tsx scripts/backfill-households.ts` — writes; re-run as no-op
10. Manual UI walkthrough:
    - Student profile → Siblings card shows household members
    - Admin creates duplicate guardian → dedup modal triggers
    - Admin runs duplicate scan → clusters shown, merge succeeds, audit row visible
    - Households admin page: create, rename, add/remove members, delete empty

## 13. Critical Files

**New**
- `prisma/schema/student.prisma` — add Household model, `householdId` on Guardian + Student
- `prisma/schema/migrations/<timestamp>_add_household_model/migration.sql`
- `scripts/backfill-households.ts`
- `src/lib/guardian-matching.ts`
- `src/modules/student/actions/household.action.ts`
- `src/modules/student/actions/guardian-merge.action.ts`
- `src/modules/student/actions/sibling.action.ts`
- `src/app/(dashboard)/students/[id]/siblings-section.tsx`
- `src/app/(dashboard)/students/households/page.tsx`
- `src/app/(dashboard)/students/households/households-client.tsx`
- `src/app/(dashboard)/students/households/[id]/page.tsx`
- `src/app/(dashboard)/students/households/[id]/household-detail-client.tsx`
- `src/app/(dashboard)/students/households/duplicates/page.tsx`
- `src/app/(dashboard)/students/households/duplicates/duplicates-client.tsx`
- Tests listed in §11

**Modified**
- `src/lib/permissions.ts` — three constants + grants
- `src/modules/student/actions/guardian.action.ts` — fix schoolId leak + dedup hook + optional `skipDedupCheck` + `linkGuardianToStudentAction` reconciles household conflict if both guardian + student have conflicting households
- `src/app/(dashboard)/students/[id]/student-profile.tsx` — embed siblings section
