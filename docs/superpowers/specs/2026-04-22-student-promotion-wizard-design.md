# Student Promotion Wizard — Design Spec

**Date:** 2026-04-22
**Module:** Students (Tier 1, Item #1 from the Students module depth review)
**Status:** Approved design, pending implementation plan

---

## 1. Context & Goal

The school currently has no UI for end-of-year student promotion. `Enrollment` records must be manually updated student-by-student to move a cohort from one academic year to the next, and graduation requires separate manual status edits. This is the single largest end-of-year operational pain point for administrators, producing errors that cascade into finance, boarding, and attendance modules.

This design adds a **Promotion Wizard** that handles all end-of-year cohort transitions — promotion, retention, graduation, and withdrawal — as a single auditable, reversible workflow. It reuses existing lifecycle actions (`transferStudentAction`, `withdrawStudentAction`, `enrollStudentAction`) where practical and introduces a new `PromotionRun` entity to capture each run as a first-class artifact.

---

## 2. Scope (decided during brainstorming)

| Decision | Choice | Notes |
|---|---|---|
| Outcomes covered | Promote, Retain, Graduate, Withdraw — in one wizard | Q1=E |
| Timing | Per-classArm engine + a "batch create" orchestrator for whole-year runs | Q2=C |
| Decision model | Default outcome (promote / graduate by yearGroup), admin flags exceptions; **no grade integration in v1** | Q3=D |
| Destination arm | "Preserve arm" default: seed matches by `ClassArm.name` within the target-year `Class` whose `(programmeId, yearGroup+1)` corresponds to the source (e.g. "SHS1 Science / A" → "SHS2 Science / A"). If no same-named arm exists, seed leaves destination blank and flags the item for manual selection. Admin overrides per-student; capacity warnings but soft. | Q4=A |
| Commit model | Draft → Commit → Revert within 14-day grace window; backed by `PromotionRun` entity | Q5=B |
| UI shape | Multi-step stepper wizard (4 steps) mirroring the `/students/import` pattern | Approach 1 |

Out of scope for v1: grade-based auto-suggestion, promotion criteria policy engine, re-allocation of boarding beds during promotion, cross-programme stream changes (students staying in same programme only).

---

## 3. Architecture

**Unit of work**: one `ClassArm` in the current academic year = one `PromotionRun` in status DRAFT → COMMITTED → (optionally) REVERTED.

**Entry points**
- `/students/promotion` — list of active drafts + recently committed runs within revert window
- `/students/promotion/batch` — orchestrator: spawn drafts for many source arms at once
- `/students/promotion/[runId]` — the 4-step wizard (DRAFT) or read-only run detail (COMMITTED/REVERTED)

**Module location**
- Actions: `src/modules/student/actions/promotion.action.ts`
- UI: `src/app/(dashboard)/students/promotion/**`

**Permissions**: new `STUDENTS_PROMOTE` added to `src/lib/permissions.ts`, granted to admin roles.

**Preconditions validated before a run can advance past Step 1**
1. A target `AcademicYear` must exist (the next year after the source)
2. For every yearGroup represented by students in the source arm, the next-yearGroup `Class` + `ClassArm` must exist in the target year
3. If missing, Step 1 blocks and links to academics setup

---

## 4. Data Model

New additions in `prisma/schema/student.prisma`:

```prisma
model PromotionRun {
  id                    String              @id @default(cuid())
  schoolId              String
  sourceAcademicYearId  String
  targetAcademicYearId  String
  sourceClassArmId      String
  status                PromotionRunStatus  @default(DRAFT)
  createdBy             String
  committedAt           DateTime?
  committedBy           String?
  revertedAt            DateTime?
  revertedBy            String?
  revertReason          String?
  notes                 String?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  school             School             @relation(fields: [schoolId], references: [id])
  sourceAcademicYear AcademicYear       @relation("SourceYear", fields: [sourceAcademicYearId], references: [id])
  targetAcademicYear AcademicYear       @relation("TargetYear", fields: [targetAcademicYearId], references: [id])
  sourceClassArm     ClassArm           @relation(fields: [sourceClassArmId], references: [id])
  items              PromotionRunItem[]

  @@unique([sourceClassArmId, sourceAcademicYearId])
  @@index([schoolId])
  @@index([status])
  @@index([sourceClassArmId])
}

model PromotionRunItem {
  id                     String            @id @default(cuid())
  runId                  String
  studentId              String
  outcome                PromotionOutcome
  destinationClassArmId  String?
  previousEnrollmentId   String
  previousStatus         StudentStatus
  newEnrollmentId        String?
  notes                  String?

  run                 PromotionRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  student             Student      @relation(fields: [studentId], references: [id])
  destinationClassArm ClassArm?    @relation(fields: [destinationClassArmId], references: [id])

  @@unique([runId, studentId])
  @@index([runId])
  @@index([studentId])
}

enum PromotionRunStatus { DRAFT  COMMITTED  REVERTED }
enum PromotionOutcome   { PROMOTE  RETAIN  GRADUATE  WITHDRAW }
```

**Design rationale**
- `previousEnrollmentId` + `previousStatus` snapshot pre-commit state → revert-friendly
- `newEnrollmentId` populated on commit so revert knows what to delete
- `@@unique([sourceClassArmId, sourceAcademicYearId])` prevents concurrent drafts on the same arm
- Grace window enforced at the action layer (14 days), not schema — configurable later if a school setting is added

---

## 5. UI Flow

**Entry page — `/students/promotion`**
- "Active Drafts" panel + "Recent Committed Runs (revert window open)" panel
- `+ New Run` button (source-arm picker), `Batch Create` link

**Step 1 — Source Review** (`[runId]?step=1`)
Read-only summary + precondition validation. "Start outcomes" seeds items and advances.

**Step 2 — Outcomes Grid** (`[runId]?step=2`)
Table: Student | Outcome dropdown | Destination arm (conditional) | Notes. Bulk toolbar. Auto-saves inline via `updatePromotionRunItemAction`.

**Step 3 — Destination Preview** (`[runId]?step=3`)
Grouped by destination arm with capacity rollup. Over-capacity arms flagged red; advance requires no over-capacity or explicit override.

**Step 4 — Commit** (`[runId]?step=4`)
Final summary + "type COMMIT to confirm" textfield. On commit → redirects to read-only run detail with Revert button (if within grace window).

**Batch page — `/students/promotion/batch`**
Lists current-year classArms with enrollment count, existing-run status, target-year readiness. Multi-select "Create drafts for selected" spawns one DRAFT per arm.

**UX patterns reused**
- Stepper scaffolding from `/students/import`
- Auto-save inline edits from the admissions decision workflow (commit `c39eec8`)
- Validation card pattern from existing forms

---

## 6. Server Actions

All in `src/modules/student/actions/promotion.action.ts`. All require `STUDENTS_PROMOTE` and are school-scoped via `requireSchoolContext`.

**Navigation / read**
- `listPromotionRunsAction({ status?, academicYearId? })`
- `getPromotionRunAction(runId)` — includes items, students, destination arm details, capacity rollup
- `getEligibleSourceArmsAction()` — arms with no open DRAFT in the current year

**Draft lifecycle**
- `createPromotionRunAction({ sourceClassArmId })` — minimal validation only (source arm exists in current year; target year exists). Full precondition check is deferred to Step 1 / `seedPromotionRunItemsAction` so a draft can always be opened and inspected.
- `seedPromotionRunItemsAction(runId)` — runs **full** precondition validation (next-yearGroup classes exist per programme). Idempotent; seeds one item per active enrollment with default outcome and destination. Errors returned structurally so Step 1 can render the linked error card.
- `updatePromotionRunItemAction({ itemId, outcome?, destinationClassArmId?, notes? })`
- `bulkUpdatePromotionRunItemsAction({ itemIds, outcome?, destinationClassArmId? })`
- `deletePromotionRunAction(runId)` — only when DRAFT

**Commit** — `commitPromotionRunAction(runId)` in a single transaction
1. Re-validate DRAFT status and item validity
2. For each item:
   - **PROMOTE / RETAIN**: mark old `Enrollment` as `PROMOTED`; create new `Enrollment` in target year + destination arm; preserve `isFreeShsPlacement`; set `previousClassArmId`; write `newEnrollmentId` back on the item
   - **GRADUATE**: mark old enrollment `COMPLETED`; `student.status = GRADUATED`; vacate active `BedAllocation` rows with `vacatedAt = commitDate`
   - **WITHDRAW**: mark old enrollment `WITHDRAWN`; `student.status = WITHDRAWN`; vacate beds
3. Set run `status = COMMITTED`, `committedAt`, `committedBy`
4. Single `audit()` entry at run level with outcome counts in metadata

**Revert** — `revertPromotionRunAction({ runId, reason })`
- Guard: status == COMMITTED and `(now - committedAt) <= 14 calendar days`
- Transaction:
  1. Delete every `newEnrollmentId` created by the run
  2. Restore `previousEnrollment.status = ACTIVE` and `student.status = previousStatus`
  3. Set run `status = REVERTED`, `revertedAt`, `revertedBy`, `revertReason`
- Boarding bed allocations **not** automatically restored — revert confirmation warns admin

**Reused helpers**
- `requireSchoolContext`, `assertPermission` from `src/lib/auth-context` and `src/lib/permissions`
- `audit()` from `src/lib/audit`
- Transaction + bed-vacation pattern from `transfer.action.ts`

---

## 7. Error Handling & Edge Cases

**Preconditions**: missing target year / missing next-yearGroup classes → block Step 1 with linked error card. Empty source arm → allow draft creation but seed reports nothing; offer delete.

**Mid-draft drift**
- Student no longer ACTIVE → item flagged on Step 2 load, skipped on commit
- New students enrolled into source arm after draft creation → banner + "Re-seed" button (adds new items without disturbing existing edits)
- Target classArm deleted → Step 3 flags, admin must reassign

**Commit race**: re-check preconditions inside transaction; fail the whole transaction on mismatch, surface which item broke. Unique constraint `(studentId, academicYearId)` on `Enrollment` provides a final safety net.

**Revert edges**
- Grade/attendance records against the new enrollment → deleted via cascade; confirmation dialog lists affected counts
- Manual edits since commit → only run-owned changes revert; manual edits preserved where possible or overwritten with a warning
- Outside grace window → action refuses, Revert button hidden

**Capacity**: over-capacity arms flagged red on Step 3; override is explicit, audited.

**Free SHS (`isFreeShsPlacement`)**: copied through on PROMOTE/RETAIN; historical on graduating enrollments.

**Boarding**: beds vacated on GRADUATE/WITHDRAW; untouched on PROMOTE/RETAIN (re-allocation is the boarding module's concern).

---

## 8. Testing Strategy

**Unit** (`src/modules/student/__tests__/promotion.action.test.ts`, TDD)
- `createPromotionRunAction`: preconditions, duplicate-draft guard, permission denial
- `seedPromotionRunItemsAction`: one item per active enrollment, correct defaults by yearGroup, idempotent
- `update` / `bulkUpdate`: outcome-destination validation rules
- `commitPromotionRunAction`: all four outcome paths, Free SHS flag carry-over, mid-draft drift handling, single audit entry
- `revertPromotionRunAction`: grace window, enrollment deletion + restoration, status-guard

**Integration** (one happy path)
- Seed school + current year + next year + classes/arms yearGroups 1/2/3 + ~10 students
- create → seed → edit → commit → revert → verify restoration

**UI verification** (manual, per verification-before-completion skill)
- `npm run dev`; walk the stepper end-to-end with a seeded dataset; screenshot each step; exercise capacity override and revert

---

## 9. Critical Files (to touch / reuse)

**New**
- `prisma/schema/student.prisma` — add `PromotionRun`, `PromotionRunItem`, enums; relation stubs on `School`, `AcademicYear`, `ClassArm`, `Student`
- `src/modules/student/actions/promotion.action.ts`
- `src/modules/student/__tests__/promotion.action.test.ts`
- `src/app/(dashboard)/students/promotion/page.tsx`
- `src/app/(dashboard)/students/promotion/batch/page.tsx`
- `src/app/(dashboard)/students/promotion/[runId]/page.tsx` (+ step client components)

**Extended**
- `src/lib/permissions.ts` — add `STUDENTS_PROMOTE`
- `prisma/schema/school.prisma` — inverse relations on `School`, `AcademicYear`, `ClassArm`
- `src/app/(dashboard)/students/students-client.tsx` — add entry button to promotion flow

**Reused (no changes)**
- `src/modules/student/actions/transfer.action.ts` — pattern reference
- `src/modules/student/actions/import.action.ts` — UX pattern reference
- `src/lib/audit.ts`, `src/lib/auth-context.ts`

---

## 10. Out of Scope for v1 (future)

- Grade-based auto-suggestion (Q3 option B) — can be layered on Step 2 as a "Suggest from results" button later
- Cross-programme stream changes (Science → Business during promotion)
- Custom grace windows per school (currently hard-coded 14 days)
- Automatic boarding bed re-allocation during promotion
- Bulk graduation across multiple arms in one transaction (batch page spawns independent runs by design)

---

## 11. Verification Plan

When implementation lands:
1. `npx prisma migrate dev --name add_promotion_run` on a scratch DB
2. `npm test -- promotion` — unit + integration tests all green
3. `npm run dev` → log in as admin → walk wizard for a seeded arm → screenshot Steps 1–4, commit, revert
4. Verify audit log entries exist for create / commit / revert
5. Log in as non-admin → confirm `/students/promotion` is blocked
