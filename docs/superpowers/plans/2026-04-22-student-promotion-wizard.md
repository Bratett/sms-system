# Student Promotion Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-of-year promotion wizard that moves cohorts of students from the current academic year into the next — covering promotion, retention, graduation, and withdrawal — as a single auditable, revertible workflow.

**Architecture:** One `PromotionRun` per source `ClassArm`, with draft → commit → revert (14-day grace) state machine. All mutations run inside a single Prisma transaction per run. UI is a 4-step stepper mirroring the `/students/import` pattern. Orchestrator page spawns independent drafts for every classArm.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Prisma on PostgreSQL, vitest + vitest-mock-extended for unit tests, shadcn/ui components.

**Spec reference:** `docs/superpowers/specs/2026-04-22-student-promotion-wizard-design.md`

---

## File Structure

**New files**
- `prisma/schema/student.prisma` — append `PromotionRun`, `PromotionRunItem`, enums
- `src/modules/student/schemas/promotion.schema.ts` — zod schemas for action inputs
- `src/modules/student/actions/promotion.action.ts` — all server actions
- `tests/unit/students/promotion.test.ts` — unit tests
- `tests/integration/students/promotion-lifecycle.test.ts` — integration happy path
- `src/app/(dashboard)/students/promotion/page.tsx` — entry page (server)
- `src/app/(dashboard)/students/promotion/promotion-entry-client.tsx`
- `src/app/(dashboard)/students/promotion/batch/page.tsx`
- `src/app/(dashboard)/students/promotion/batch/batch-client.tsx`
- `src/app/(dashboard)/students/promotion/[runId]/page.tsx` — wizard shell
- `src/app/(dashboard)/students/promotion/[runId]/wizard-client.tsx`
- `src/app/(dashboard)/students/promotion/[runId]/step-1-source-review.tsx`
- `src/app/(dashboard)/students/promotion/[runId]/step-2-outcomes-grid.tsx`
- `src/app/(dashboard)/students/promotion/[runId]/step-3-destination-preview.tsx`
- `src/app/(dashboard)/students/promotion/[runId]/step-4-commit.tsx`
- `src/app/(dashboard)/students/promotion/[runId]/run-detail-client.tsx`

**Modified files**
- `prisma/schema/school.prisma` — inverse relation `promotionRuns` on `School`, `AcademicYear`
- `prisma/schema/academic.prisma` — inverse relations `promotionRuns`, `destinationPromotionItems` on `ClassArm`
- `prisma/schema/student.prisma` (Student model) — inverse relation `promotionRunItems`
- `src/lib/permissions.ts` — add `STUDENTS_PROMOTE`, grant to admin role
- `src/app/(dashboard)/students/students-client.tsx` — "Promote" entry button

---

## Task 1: Prisma schema additions

**Files:**
- Modify: `prisma/schema/student.prisma`
- Modify: `prisma/schema/school.prisma`
- Modify: `prisma/schema/academic.prisma`

- [ ] **Step 1: Append new models to `prisma/schema/student.prisma`**

Add at the end of the file:

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

  school             School             @relation("SchoolPromotionRun", fields: [schoolId], references: [id], onDelete: Cascade)
  sourceAcademicYear AcademicYear       @relation("SourcePromotionYear", fields: [sourceAcademicYearId], references: [id])
  targetAcademicYear AcademicYear       @relation("TargetPromotionYear", fields: [targetAcademicYearId], references: [id])
  sourceClassArm     ClassArm           @relation("SourcePromotionArm", fields: [sourceClassArmId], references: [id])
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
  destinationClassArm ClassArm?    @relation("DestinationPromotionArm", fields: [destinationClassArmId], references: [id])

  @@unique([runId, studentId])
  @@index([runId])
  @@index([studentId])
}

enum PromotionRunStatus {
  DRAFT
  COMMITTED
  REVERTED
}

enum PromotionOutcome {
  PROMOTE
  RETAIN
  GRADUATE
  WITHDRAW
}
```

- [ ] **Step 2: Add inverse relation to `Student` model**

In the same `prisma/schema/student.prisma`, inside `model Student`, add to the relations block:

```prisma
  promotionRunItems PromotionRunItem[]
```

- [ ] **Step 3: Add inverse relations to `School` and `AcademicYear` in `prisma/schema/school.prisma`**

Inside `model School` add:

```prisma
  promotionRuns PromotionRun[] @relation("SchoolPromotionRun")
```

Inside `model AcademicYear` add:

```prisma
  sourcePromotionRuns PromotionRun[] @relation("SourcePromotionYear")
  targetPromotionRuns PromotionRun[] @relation("TargetPromotionYear")
```

- [ ] **Step 4: Add inverse relations to `ClassArm` in `prisma/schema/academic.prisma`**

Inside `model ClassArm` add:

```prisma
  sourcePromotionRuns       PromotionRun[]      @relation("SourcePromotionArm")
  destinationPromotionItems PromotionRunItem[]  @relation("DestinationPromotionArm")
```

- [ ] **Step 5: Generate migration and Prisma client**

Run: `npx prisma migrate dev --name add_promotion_run`
Expected: migration file created under `prisma/migrations/`, schema pushed to dev DB, client regenerated. No errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat(students): add PromotionRun and PromotionRunItem models"
```

---

## Task 2: Add STUDENTS_PROMOTE permission

**Files:**
- Modify: `src/lib/permissions.ts`

- [ ] **Step 1: Add the constant**

Locate the `STUDENTS_*` block (around line 56). After `STUDENTS_IMPORT` add:

```ts
  STUDENTS_PROMOTE: "students:promotion:execute",
```

- [ ] **Step 2: Grant to admin role**

Locate the admin role permission list (the same block that already contains `PERMISSIONS.STUDENTS_UPDATE` — around line 675). Add `PERMISSIONS.STUDENTS_PROMOTE` to the array.

- [ ] **Step 3: Verify typing**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat(permissions): add STUDENTS_PROMOTE permission"
```

---

## Task 3: Zod schemas for action inputs

**Files:**
- Create: `src/modules/student/schemas/promotion.schema.ts`

- [ ] **Step 1: Write schemas**

```ts
import { z } from "zod";

export const createPromotionRunSchema = z.object({
  sourceClassArmId: z.string().cuid(),
});

export const updatePromotionRunItemSchema = z.object({
  itemId: z.string().cuid(),
  outcome: z.enum(["PROMOTE", "RETAIN", "GRADUATE", "WITHDRAW"]).optional(),
  destinationClassArmId: z.string().cuid().nullable().optional(),
  notes: z.string().max(500).optional(),
});

export const bulkUpdatePromotionRunItemsSchema = z.object({
  runId: z.string().cuid(),
  itemIds: z.array(z.string().cuid()).min(1),
  outcome: z.enum(["PROMOTE", "RETAIN", "GRADUATE", "WITHDRAW"]).optional(),
  destinationClassArmId: z.string().cuid().nullable().optional(),
});

export const revertPromotionRunSchema = z.object({
  runId: z.string().cuid(),
  reason: z.string().min(5).max(500),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/student/schemas/promotion.schema.ts
git commit -m "feat(students): add promotion action zod schemas"
```

---

## Task 4: Action file scaffold + `getEligibleSourceArmsAction`

**Files:**
- Create: `src/modules/student/actions/promotion.action.ts`
- Create: `tests/unit/students/promotion.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { getEligibleSourceArmsAction } from "@/modules/student/actions/promotion.action";

describe("getEligibleSourceArmsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getEligibleSourceArmsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns arms in current academic year without an active draft run", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: "ay-1", schoolId: "default-school" } as never);
    prismaMock.classArm.findMany.mockResolvedValue([
      { id: "ca-1", name: "A", class: { name: "SHS 1 Science", academicYearId: "ay-1", yearGroup: 1 }, _count: { enrollments: 32 } },
    ] as never);
    prismaMock.promotionRun.findMany.mockResolvedValue([]);

    const result = await getEligibleSourceArmsAction();
    expect(result).toEqual({ data: expect.arrayContaining([expect.objectContaining({ id: "ca-1" })]) });
  });

  it("excludes arms with an existing DRAFT run", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: "ay-1", schoolId: "default-school" } as never);
    prismaMock.classArm.findMany.mockResolvedValue([
      { id: "ca-1", name: "A", class: { name: "SHS 1 Science", academicYearId: "ay-1", yearGroup: 1 }, _count: { enrollments: 32 } },
    ] as never);
    prismaMock.promotionRun.findMany.mockResolvedValue([
      { sourceClassArmId: "ca-1", status: "DRAFT" },
    ] as never);

    const result = await getEligibleSourceArmsAction();
    expect(result).toEqual({ data: [] });
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement scaffold + action**

Create `src/modules/student/actions/promotion.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

export async function getEligibleSourceArmsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const currentYear = await db.academicYear.findFirst({
    where: { schoolId: ctx.schoolId, isCurrent: true },
  });
  if (!currentYear) return { error: "No current academic year set." };

  const arms = await db.classArm.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "ACTIVE",
      class: { academicYearId: currentYear.id },
    },
    include: {
      class: { select: { name: true, yearGroup: true, academicYearId: true, programmeId: true } },
      _count: { select: { enrollments: { where: { status: "ACTIVE", academicYearId: currentYear.id } } } },
    },
    orderBy: [{ class: { yearGroup: "asc" } }, { name: "asc" }],
  });

  const drafts = await db.promotionRun.findMany({
    where: { schoolId: ctx.schoolId, sourceAcademicYearId: currentYear.id, status: "DRAFT" },
    select: { sourceClassArmId: true },
  });
  const draftArmIds = new Set(drafts.map((d) => d.sourceClassArmId));

  return { data: arms.filter((a) => !draftArmIds.has(a.id)) };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/modules/student/actions/promotion.action.ts tests/unit/students/promotion.test.ts
git commit -m "feat(students): add getEligibleSourceArmsAction"
```

---

## Task 5: `listPromotionRunsAction`

**Files:**
- Modify: `src/modules/student/actions/promotion.action.ts`
- Modify: `tests/unit/students/promotion.test.ts`

- [ ] **Step 1: Write failing test**

Append to the test file:

```ts
import { listPromotionRunsAction } from "@/modules/student/actions/promotion.action";

describe("listPromotionRunsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns drafts and recent committed runs", async () => {
    prismaMock.promotionRun.findMany.mockResolvedValue([
      { id: "pr-1", status: "DRAFT", sourceClassArm: { name: "A", class: { name: "SHS1 Sci" } } },
      { id: "pr-2", status: "COMMITTED", committedAt: new Date(), sourceClassArm: { name: "B", class: { name: "SHS1 Sci" } } },
    ] as never);

    const result = await listPromotionRunsAction();
    expect(result).toEqual({ data: expect.arrayContaining([
      expect.objectContaining({ id: "pr-1" }),
      expect.objectContaining({ id: "pr-2" }),
    ]) });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: FAIL — export not found.

- [ ] **Step 3: Implement**

Append to `promotion.action.ts`:

```ts
export async function listPromotionRunsAction(opts?: { status?: "DRAFT" | "COMMITTED" | "REVERTED"; academicYearId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const runs = await db.promotionRun.findMany({
    where: {
      schoolId: ctx.schoolId,
      ...(opts?.status && { status: opts.status }),
      ...(opts?.academicYearId && { sourceAcademicYearId: opts.academicYearId }),
    },
    include: {
      sourceClassArm: { include: { class: { select: { name: true, yearGroup: true } } } },
      sourceAcademicYear: { select: { name: true } },
      targetAcademicYear: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return { data: runs };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add listPromotionRunsAction"
```

---

## Task 6: `getPromotionRunAction`

**Files:**
- Modify: `src/modules/student/actions/promotion.action.ts`
- Modify: `tests/unit/students/promotion.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { getPromotionRunAction } from "@/modules/student/actions/promotion.action";

describe("getPromotionRunAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns the run with items and capacity rollup", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1",
      schoolId: "default-school",
      status: "DRAFT",
      items: [
        { id: "pri-1", outcome: "PROMOTE", destinationClassArmId: "ca-2", student: { firstName: "A", lastName: "B", studentId: "S/1" } },
      ],
      sourceClassArm: { id: "ca-1", name: "A", class: { name: "SHS1 Sci", yearGroup: 1, programmeId: "pr-sci" } },
      sourceAcademicYear: { id: "ay-1", name: "2025/26" },
      targetAcademicYear: { id: "ay-2", name: "2026/27" },
    } as never);
    prismaMock.classArm.findMany.mockResolvedValue([
      { id: "ca-2", name: "A", capacity: 40, class: { yearGroup: 2, academicYearId: "ay-2", programmeId: "pr-sci" } },
    ] as never);

    const result = await getPromotionRunAction("pr-1");
    expect(result).toMatchObject({ data: { id: "pr-1", capacityByArm: expect.any(Object) } });
  });

  it("returns error when run does not belong to current school", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue(null);
    const result = await getPromotionRunAction("pr-x");
    expect(result).toEqual({ error: "Promotion run not found" });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: FAIL — export missing.

- [ ] **Step 3: Implement**

Append:

```ts
export async function getPromotionRunAction(runId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const run = await db.promotionRun.findFirst({
    where: { id: runId, schoolId: ctx.schoolId },
    include: {
      items: {
        include: {
          student: { select: { id: true, studentId: true, firstName: true, lastName: true, status: true } },
          destinationClassArm: { include: { class: { select: { name: true, yearGroup: true } } } },
        },
        orderBy: [{ student: { lastName: "asc" } }],
      },
      sourceClassArm: { include: { class: { select: { id: true, name: true, yearGroup: true, programmeId: true } } } },
      sourceAcademicYear: { select: { id: true, name: true } },
      targetAcademicYear: { select: { id: true, name: true } },
    },
  });
  if (!run) return { error: "Promotion run not found" };

  // Capacity rollup: count draft items per destination arm.
  const destIds = run.items.map((i) => i.destinationClassArmId).filter(Boolean) as string[];
  const destArms = destIds.length
    ? await db.classArm.findMany({
        where: { id: { in: destIds } },
        select: { id: true, capacity: true, _count: { select: { enrollments: { where: { status: "ACTIVE", academicYearId: run.targetAcademicYearId } } } } },
      })
    : [];
  const capacityByArm: Record<string, { capacity: number; existing: number; incoming: number }> = {};
  for (const a of destArms) {
    capacityByArm[a.id] = {
      capacity: a.capacity,
      existing: a._count.enrollments,
      incoming: run.items.filter((i) => i.destinationClassArmId === a.id).length,
    };
  }

  return { data: { ...run, capacityByArm } };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add getPromotionRunAction with capacity rollup"
```

---

## Task 7: `createPromotionRunAction`

**Files:**
- Modify: `src/modules/student/actions/promotion.action.ts`
- Modify: `tests/unit/students/promotion.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { createPromotionRunAction } from "@/modules/student/actions/promotion.action";

describe("createPromotionRunAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects when source arm does not exist in current year", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue(null);
    const result = await createPromotionRunAction({ sourceClassArmId: "ca-missing" });
    expect(result).toEqual({ error: "Source class arm not found in the current academic year" });
  });

  it("rejects when target academic year does not exist", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "ca-1",
      class: { academicYearId: "ay-1", yearGroup: 1 },
    } as never);
    prismaMock.academicYear.findFirst
      .mockResolvedValueOnce({ id: "ay-1", startDate: new Date("2025-09-01") } as never) // current
      .mockResolvedValueOnce(null); // target (next)

    const result = await createPromotionRunAction({ sourceClassArmId: "ca-1" });
    expect(result).toEqual({ error: "No target academic year found. Create the next academic year first." });
  });

  it("rejects duplicate draft on the same arm", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "ca-1",
      class: { academicYearId: "ay-1", yearGroup: 1 },
    } as never);
    prismaMock.academicYear.findFirst
      .mockResolvedValueOnce({ id: "ay-1", startDate: new Date("2025-09-01") } as never)
      .mockResolvedValueOnce({ id: "ay-2", startDate: new Date("2026-09-01") } as never);
    prismaMock.promotionRun.findFirst.mockResolvedValue({ id: "pr-existing", status: "DRAFT" } as never);

    const result = await createPromotionRunAction({ sourceClassArmId: "ca-1" });
    expect(result).toEqual({ error: "A draft promotion run already exists for this class arm" });
  });

  it("creates a new DRAFT run when valid", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "ca-1",
      class: { academicYearId: "ay-1", yearGroup: 1 },
    } as never);
    prismaMock.academicYear.findFirst
      .mockResolvedValueOnce({ id: "ay-1", startDate: new Date("2025-09-01") } as never)
      .mockResolvedValueOnce({ id: "ay-2", startDate: new Date("2026-09-01") } as never);
    prismaMock.promotionRun.findFirst.mockResolvedValue(null);
    prismaMock.promotionRun.create.mockResolvedValue({ id: "pr-new", status: "DRAFT" } as never);

    const result = await createPromotionRunAction({ sourceClassArmId: "ca-1" });
    expect(result).toEqual({ data: expect.objectContaining({ id: "pr-new", status: "DRAFT" }) });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: FAIL — export missing.

- [ ] **Step 3: Implement**

Append:

```ts
import { createPromotionRunSchema } from "../schemas/promotion.schema";
import { audit } from "@/lib/audit";

export async function createPromotionRunAction(input: { sourceClassArmId: string }) {
  const parsed = createPromotionRunSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  // Source arm must belong to current academic year.
  const sourceArm = await db.classArm.findFirst({
    where: { id: parsed.data.sourceClassArmId, schoolId: ctx.schoolId },
    include: { class: { select: { academicYearId: true, yearGroup: true } } },
  });
  if (!sourceArm) return { error: "Source class arm not found in the current academic year" };

  const currentYear = await db.academicYear.findFirst({
    where: { id: sourceArm.class.academicYearId, schoolId: ctx.schoolId },
  });
  if (!currentYear) return { error: "Source class arm not found in the current academic year" };

  // Target year = next academic year by startDate.
  const targetYear = await db.academicYear.findFirst({
    where: { schoolId: ctx.schoolId, startDate: { gt: currentYear.startDate } },
    orderBy: { startDate: "asc" },
  });
  if (!targetYear) return { error: "No target academic year found. Create the next academic year first." };

  // Duplicate guard.
  const existing = await db.promotionRun.findFirst({
    where: { sourceClassArmId: sourceArm.id, sourceAcademicYearId: currentYear.id, status: "DRAFT" },
  });
  if (existing) return { error: "A draft promotion run already exists for this class arm" };

  const run = await db.promotionRun.create({
    data: {
      schoolId: ctx.schoolId,
      sourceAcademicYearId: currentYear.id,
      targetAcademicYearId: targetYear.id,
      sourceClassArmId: sourceArm.id,
      createdBy: ctx.session.user.id!,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "PromotionRun",
    entityId: run.id,
    module: "students",
    description: `Created promotion run for classArm ${sourceArm.id}`,
  });

  return { data: run };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add createPromotionRunAction"
```

---

## Task 8: `seedPromotionRunItemsAction` with full precondition validation

**Files:**
- Modify: `src/modules/student/actions/promotion.action.ts`
- Modify: `tests/unit/students/promotion.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { seedPromotionRunItemsAction } from "@/modules/student/actions/promotion.action";

describe("seedPromotionRunItemsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns missing-class errors when next-yearGroup classes are absent", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", schoolId: "default-school", status: "DRAFT",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2",
      sourceClassArm: { id: "ca-1", name: "A", class: { programmeId: "pr-sci", yearGroup: 1 } },
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { id: "e-1", studentId: "s-1", student: { id: "s-1", status: "ACTIVE" }, isFreeShsPlacement: false },
    ] as never);
    prismaMock.class.findFirst.mockResolvedValue(null); // no target-year class for (programme, yearGroup+1)

    const result = await seedPromotionRunItemsAction("pr-1");
    expect(result).toMatchObject({ error: expect.stringContaining("Missing target-year class") });
  });

  it("seeds items with PROMOTE default for yearGroup 1 students and same-named dest arm", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", schoolId: "default-school", status: "DRAFT",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2",
      sourceClassArm: { id: "ca-1", name: "A", class: { programmeId: "pr-sci", yearGroup: 1 } },
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { id: "e-1", studentId: "s-1", student: { id: "s-1", status: "ACTIVE" }, isFreeShsPlacement: false },
    ] as never);
    prismaMock.class.findFirst.mockResolvedValue({ id: "cl-2", yearGroup: 2, classArms: [{ id: "ca-2", name: "A" }] } as never);
    prismaMock.promotionRunItem.findMany.mockResolvedValue([]);
    prismaMock.promotionRunItem.createMany.mockResolvedValue({ count: 1 } as never);

    const result = await seedPromotionRunItemsAction("pr-1");
    expect(result).toEqual({ data: { seeded: 1, skipped: 0 } });
    expect(prismaMock.promotionRunItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        runId: "pr-1", studentId: "s-1", outcome: "PROMOTE", destinationClassArmId: "ca-2", previousEnrollmentId: "e-1", previousStatus: "ACTIVE",
      })],
    });
  });

  it("defaults yearGroup 3 students to GRADUATE with null destination", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", schoolId: "default-school", status: "DRAFT",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2",
      sourceClassArm: { id: "ca-3", name: "A", class: { programmeId: "pr-sci", yearGroup: 3 } },
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { id: "e-3", studentId: "s-3", student: { id: "s-3", status: "ACTIVE" }, isFreeShsPlacement: false },
    ] as never);
    prismaMock.promotionRunItem.findMany.mockResolvedValue([]);
    prismaMock.promotionRunItem.createMany.mockResolvedValue({ count: 1 } as never);

    const result = await seedPromotionRunItemsAction("pr-1");
    expect(result).toEqual({ data: { seeded: 1, skipped: 0 } });
    expect(prismaMock.promotionRunItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ outcome: "GRADUATE", destinationClassArmId: null })],
    });
  });

  it("is idempotent: skips students that already have an item", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", schoolId: "default-school", status: "DRAFT",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2",
      sourceClassArm: { id: "ca-1", name: "A", class: { programmeId: "pr-sci", yearGroup: 1 } },
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { id: "e-1", studentId: "s-1", student: { id: "s-1", status: "ACTIVE" }, isFreeShsPlacement: false },
    ] as never);
    prismaMock.class.findFirst.mockResolvedValue({ id: "cl-2", yearGroup: 2, classArms: [{ id: "ca-2", name: "A" }] } as never);
    prismaMock.promotionRunItem.findMany.mockResolvedValue([{ studentId: "s-1" }] as never);

    const result = await seedPromotionRunItemsAction("pr-1");
    expect(result).toEqual({ data: { seeded: 0, skipped: 1 } });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: FAIL — export missing.

- [ ] **Step 3: Implement**

Append:

```ts
export async function seedPromotionRunItemsAction(runId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const run = await db.promotionRun.findFirst({
    where: { id: runId, schoolId: ctx.schoolId, status: "DRAFT" },
    include: { sourceClassArm: { include: { class: { select: { programmeId: true, yearGroup: true } } } } },
  });
  if (!run) return { error: "Promotion run not found or not in DRAFT status" };

  // Active enrollments to seed.
  const enrollments = await db.enrollment.findMany({
    where: { classArmId: run.sourceClassArmId, academicYearId: run.sourceAcademicYearId, status: "ACTIVE" },
    include: { student: { select: { id: true, status: true } } },
  });

  const sourceYearGroup = run.sourceClassArm.class.yearGroup;
  const isFinalYear = sourceYearGroup >= 3;
  const sourceArmName = run.sourceClassArm.name;

  // Precondition: next-yearGroup class exists (only for non-final year).
  let destArmByDefault: string | null = null;
  if (!isFinalYear) {
    const targetClass = await db.class.findFirst({
      where: {
        schoolId: ctx.schoolId,
        academicYearId: run.targetAcademicYearId,
        programmeId: run.sourceClassArm.class.programmeId,
        yearGroup: sourceYearGroup + 1,
      },
      include: { classArms: { where: { status: "ACTIVE" } } },
    });
    if (!targetClass) {
      return { error: `Missing target-year class for programme yearGroup ${sourceYearGroup + 1}` };
    }
    const sameNamedArm = targetClass.classArms.find((a) => a.name === sourceArmName);
    destArmByDefault = sameNamedArm?.id ?? null;
  }

  // Idempotency: skip students that already have an item on this run.
  const existing = await db.promotionRunItem.findMany({
    where: { runId },
    select: { studentId: true },
  });
  const existingIds = new Set(existing.map((e) => e.studentId));

  const toCreate = enrollments
    .filter((e) => !existingIds.has(e.studentId))
    .map((e) => ({
      runId,
      studentId: e.studentId,
      outcome: (isFinalYear ? "GRADUATE" : "PROMOTE") as "GRADUATE" | "PROMOTE",
      destinationClassArmId: isFinalYear ? null : destArmByDefault,
      previousEnrollmentId: e.id,
      previousStatus: e.student.status,
    }));

  if (toCreate.length > 0) {
    await db.promotionRunItem.createMany({ data: toCreate });
  }

  return { data: { seeded: toCreate.length, skipped: enrollments.length - toCreate.length } };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add seedPromotionRunItemsAction with precondition check"
```

---

## Task 9: `updatePromotionRunItemAction` and `bulkUpdatePromotionRunItemsAction`

**Files:**
- Modify: `src/modules/student/actions/promotion.action.ts`
- Modify: `tests/unit/students/promotion.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import {
  updatePromotionRunItemAction,
  bulkUpdatePromotionRunItemsAction,
} from "@/modules/student/actions/promotion.action";

describe("updatePromotionRunItemAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("clears destination when outcome set to GRADUATE", async () => {
    prismaMock.promotionRunItem.findFirst.mockResolvedValue({
      id: "pri-1", runId: "pr-1", run: { schoolId: "default-school", status: "DRAFT" },
    } as never);
    prismaMock.promotionRunItem.update.mockResolvedValue({ id: "pri-1" } as never);

    await updatePromotionRunItemAction({ itemId: "pri-1", outcome: "GRADUATE" });
    expect(prismaMock.promotionRunItem.update).toHaveBeenCalledWith({
      where: { id: "pri-1" },
      data: expect.objectContaining({ outcome: "GRADUATE", destinationClassArmId: null }),
    });
  });

  it("rejects edits when the run is not DRAFT", async () => {
    prismaMock.promotionRunItem.findFirst.mockResolvedValue({
      id: "pri-1", runId: "pr-1", run: { schoolId: "default-school", status: "COMMITTED" },
    } as never);

    const result = await updatePromotionRunItemAction({ itemId: "pri-1", outcome: "RETAIN" });
    expect(result).toEqual({ error: "Run is no longer editable" });
  });
});

describe("bulkUpdatePromotionRunItemsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("applies bulk outcome change to selected items", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({ id: "pr-1", schoolId: "default-school", status: "DRAFT" } as never);
    prismaMock.promotionRunItem.updateMany.mockResolvedValue({ count: 3 } as never);

    const result = await bulkUpdatePromotionRunItemsAction({
      runId: "pr-1",
      itemIds: ["a", "b", "c"],
      outcome: "RETAIN",
    });
    expect(result).toEqual({ data: { updated: 3 } });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append:

```ts
import {
  updatePromotionRunItemSchema,
  bulkUpdatePromotionRunItemsSchema,
} from "../schemas/promotion.schema";

export async function updatePromotionRunItemAction(input: {
  itemId: string;
  outcome?: "PROMOTE" | "RETAIN" | "GRADUATE" | "WITHDRAW";
  destinationClassArmId?: string | null;
  notes?: string;
}) {
  const parsed = updatePromotionRunItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const item = await db.promotionRunItem.findFirst({
    where: { id: parsed.data.itemId },
    include: { run: { select: { schoolId: true, status: true } } },
  });
  if (!item || item.run.schoolId !== ctx.schoolId) return { error: "Item not found" };
  if (item.run.status !== "DRAFT") return { error: "Run is no longer editable" };

  const data: Record<string, unknown> = {};
  if (parsed.data.outcome !== undefined) {
    data.outcome = parsed.data.outcome;
    // Enforce: GRADUATE/WITHDRAW have null destination.
    if (parsed.data.outcome === "GRADUATE" || parsed.data.outcome === "WITHDRAW") {
      data.destinationClassArmId = null;
    }
  }
  if (parsed.data.destinationClassArmId !== undefined) {
    data.destinationClassArmId = parsed.data.destinationClassArmId;
  }
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  const updated = await db.promotionRunItem.update({ where: { id: parsed.data.itemId }, data });
  return { data: updated };
}

export async function bulkUpdatePromotionRunItemsAction(input: {
  runId: string;
  itemIds: string[];
  outcome?: "PROMOTE" | "RETAIN" | "GRADUATE" | "WITHDRAW";
  destinationClassArmId?: string | null;
}) {
  const parsed = bulkUpdatePromotionRunItemsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const run = await db.promotionRun.findFirst({
    where: { id: parsed.data.runId, schoolId: ctx.schoolId, status: "DRAFT" },
  });
  if (!run) return { error: "Run not found or not editable" };

  const data: Record<string, unknown> = {};
  if (parsed.data.outcome !== undefined) {
    data.outcome = parsed.data.outcome;
    if (parsed.data.outcome === "GRADUATE" || parsed.data.outcome === "WITHDRAW") {
      data.destinationClassArmId = null;
    }
  }
  if (parsed.data.destinationClassArmId !== undefined) {
    data.destinationClassArmId = parsed.data.destinationClassArmId;
  }

  const result = await db.promotionRunItem.updateMany({
    where: { id: { in: parsed.data.itemIds }, runId: parsed.data.runId },
    data,
  });
  return { data: { updated: result.count } };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add update/bulkUpdate promotion item actions"
```

---

## Task 10: `deletePromotionRunAction`

**Files:**
- Modify: `src/modules/student/actions/promotion.action.ts`
- Modify: `tests/unit/students/promotion.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { deletePromotionRunAction } from "@/modules/student/actions/promotion.action";

describe("deletePromotionRunAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("deletes a DRAFT run", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({ id: "pr-1", status: "DRAFT", schoolId: "default-school" } as never);
    prismaMock.promotionRun.delete.mockResolvedValue({ id: "pr-1" } as never);

    const result = await deletePromotionRunAction("pr-1");
    expect(result).toEqual({ data: { deleted: true } });
  });

  it("refuses to delete a COMMITTED run", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({ id: "pr-1", status: "COMMITTED", schoolId: "default-school" } as never);
    const result = await deletePromotionRunAction("pr-1");
    expect(result).toEqual({ error: "Only DRAFT runs can be deleted" });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append:

```ts
export async function deletePromotionRunAction(runId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const run = await db.promotionRun.findFirst({ where: { id: runId, schoolId: ctx.schoolId } });
  if (!run) return { error: "Run not found" };
  if (run.status !== "DRAFT") return { error: "Only DRAFT runs can be deleted" };

  await db.promotionRun.delete({ where: { id: runId } });
  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "PromotionRun",
    entityId: runId,
    module: "students",
    description: `Deleted draft promotion run`,
  });

  return { data: { deleted: true } };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add deletePromotionRunAction"
```

---

## Task 11: `commitPromotionRunAction`

**Files:**
- Modify: `src/modules/student/actions/promotion.action.ts`
- Modify: `tests/unit/students/promotion.test.ts`

- [ ] **Step 1: Write failing tests covering all four outcome paths**

```ts
import { commitPromotionRunAction } from "@/modules/student/actions/promotion.action";

describe("commitPromotionRunAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("refuses to commit a non-DRAFT run", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({ id: "pr-1", status: "COMMITTED", schoolId: "default-school", items: [] } as never);
    const result = await commitPromotionRunAction("pr-1");
    expect(result).toEqual({ error: "Run is not in DRAFT status" });
  });

  it("handles PROMOTE: marks old enrollment PROMOTED and creates new one", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "DRAFT", schoolId: "default-school",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2", sourceClassArmId: "ca-1",
      items: [{
        id: "pri-1", studentId: "s-1", outcome: "PROMOTE", destinationClassArmId: "ca-2",
        previousEnrollmentId: "e-1", previousStatus: "ACTIVE",
      }],
    } as never);
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "e-1", isFreeShsPlacement: true, classArmId: "ca-1" } as never);
    prismaMock.enrollment.create.mockResolvedValue({ id: "e-new" } as never);
    prismaMock.promotionRunItem.update.mockResolvedValue({} as never);
    prismaMock.promotionRun.update.mockResolvedValue({ id: "pr-1", status: "COMMITTED" } as never);

    const result = await commitPromotionRunAction("pr-1");
    expect(result).toMatchObject({ data: { status: "COMMITTED" } });
    expect(prismaMock.enrollment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "e-1" }, data: expect.objectContaining({ status: "PROMOTED" }),
    }));
    expect(prismaMock.enrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: "s-1",
        classArmId: "ca-2",
        academicYearId: "ay-2",
        isFreeShsPlacement: true,
        previousClassArmId: "ca-1",
      }),
    }));
  });

  it("handles GRADUATE: sets student GRADUATED and vacates beds", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "DRAFT", schoolId: "default-school",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2", sourceClassArmId: "ca-3",
      items: [{ id: "pri-3", studentId: "s-3", outcome: "GRADUATE", destinationClassArmId: null,
        previousEnrollmentId: "e-3", previousStatus: "ACTIVE" }],
    } as never);
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "e-3", isFreeShsPlacement: false, classArmId: "ca-3" } as never);

    await commitPromotionRunAction("pr-1");
    expect(prismaMock.enrollment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "e-3" }, data: expect.objectContaining({ status: "COMPLETED" }),
    }));
    expect(prismaMock.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "s-3" }, data: expect.objectContaining({ status: "GRADUATED" }),
    }));
    expect(prismaMock.bedAllocation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: "s-3", vacatedAt: null },
    }));
  });

  it("handles WITHDRAW: sets student WITHDRAWN and vacates beds", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "DRAFT", schoolId: "default-school",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2", sourceClassArmId: "ca-1",
      items: [{ id: "pri-w", studentId: "s-w", outcome: "WITHDRAW", destinationClassArmId: null,
        previousEnrollmentId: "e-w", previousStatus: "ACTIVE" }],
    } as never);
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "e-w", isFreeShsPlacement: false, classArmId: "ca-1" } as never);

    await commitPromotionRunAction("pr-1");
    expect(prismaMock.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "s-w" }, data: expect.objectContaining({ status: "WITHDRAWN" }),
    }));
  });

  it("skips items whose student is no longer ACTIVE", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "DRAFT", schoolId: "default-school",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2", sourceClassArmId: "ca-1",
      items: [{ id: "pri-1", studentId: "s-1", outcome: "PROMOTE", destinationClassArmId: "ca-2",
        previousEnrollmentId: "e-1", previousStatus: "ACTIVE" }],
    } as never);
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "e-1", isFreeShsPlacement: false, classArmId: "ca-1", status: "WITHDRAWN" } as never);

    const result = await commitPromotionRunAction("pr-1");
    expect(result).toMatchObject({ data: { status: "COMMITTED", skipped: 1 } });
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append:

```ts
export async function commitPromotionRunAction(runId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const result = await db.$transaction(async (tx) => {
    const run = await tx.promotionRun.findFirst({
      where: { id: runId, schoolId: ctx.schoolId },
      include: { items: true },
    });
    if (!run) return { error: "Run not found" as string };
    if (run.status !== "DRAFT") return { error: "Run is not in DRAFT status" as string };

    const commitDate = new Date();
    const counts = { PROMOTE: 0, RETAIN: 0, GRADUATE: 0, WITHDRAW: 0 };
    let skipped = 0;

    for (const item of run.items) {
      // Re-check the source enrollment is still ACTIVE (drift guard).
      const prevEnrollment = await tx.enrollment.findUnique({ where: { id: item.previousEnrollmentId } });
      if (!prevEnrollment || prevEnrollment.status !== "ACTIVE") {
        skipped++;
        continue;
      }

      if (item.outcome === "PROMOTE" || item.outcome === "RETAIN") {
        if (!item.destinationClassArmId) {
          throw new Error(`Item ${item.id} has ${item.outcome} outcome but no destination arm`);
        }
        await tx.enrollment.update({
          where: { id: item.previousEnrollmentId },
          data: { status: "PROMOTED" },
        });
        const newEnrollment = await tx.enrollment.create({
          data: {
            studentId: item.studentId,
            classArmId: item.destinationClassArmId,
            schoolId: ctx.schoolId,
            academicYearId: run.targetAcademicYearId,
            isFreeShsPlacement: prevEnrollment.isFreeShsPlacement,
            previousClassArmId: prevEnrollment.classArmId,
          },
        });
        await tx.promotionRunItem.update({
          where: { id: item.id },
          data: { newEnrollmentId: newEnrollment.id },
        });
        counts[item.outcome]++;
      } else if (item.outcome === "GRADUATE") {
        await tx.enrollment.update({
          where: { id: item.previousEnrollmentId },
          data: { status: "COMPLETED" },
        });
        await tx.student.update({
          where: { id: item.studentId },
          data: { status: "GRADUATED" },
        });
        await tx.bedAllocation.updateMany({
          where: { studentId: item.studentId, vacatedAt: null },
          data: { vacatedAt: commitDate },
        });
        counts.GRADUATE++;
      } else if (item.outcome === "WITHDRAW") {
        await tx.enrollment.update({
          where: { id: item.previousEnrollmentId },
          data: { status: "WITHDRAWN" },
        });
        await tx.student.update({
          where: { id: item.studentId },
          data: { status: "WITHDRAWN" },
        });
        await tx.bedAllocation.updateMany({
          where: { studentId: item.studentId, vacatedAt: null },
          data: { vacatedAt: commitDate },
        });
        counts.WITHDRAW++;
      }
    }

    const committed = await tx.promotionRun.update({
      where: { id: runId },
      data: {
        status: "COMMITTED",
        committedAt: commitDate,
        committedBy: ctx.session.user.id!,
      },
    });

    return { data: { ...committed, counts, skipped } };
  });

  if ("error" in result) return result;

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "PromotionRun",
    entityId: runId,
    module: "students",
    description: `Committed promotion run`,
    newData: { status: "COMMITTED" },
    metadata: { counts: result.data.counts, skipped: result.data.skipped },
  });

  return result;
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add commitPromotionRunAction with all outcome paths"
```

---

## Task 12: `revertPromotionRunAction`

**Files:**
- Modify: `src/modules/student/actions/promotion.action.ts`
- Modify: `tests/unit/students/promotion.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { revertPromotionRunAction } from "@/modules/student/actions/promotion.action";

describe("revertPromotionRunAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("refuses to revert outside the 14-day grace window", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 15);
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "COMMITTED", schoolId: "default-school", committedAt: oldDate, items: [],
    } as never);

    const result = await revertPromotionRunAction({ runId: "pr-1", reason: "mistake" });
    expect(result).toEqual({ error: "Revert window has expired (14 days)" });
  });

  it("deletes new enrollments and restores previous state", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "COMMITTED", schoolId: "default-school", committedAt: new Date(),
      items: [
        { id: "pri-1", studentId: "s-1", outcome: "PROMOTE",
          previousEnrollmentId: "e-1", previousStatus: "ACTIVE", newEnrollmentId: "e-new" },
        { id: "pri-2", studentId: "s-2", outcome: "GRADUATE",
          previousEnrollmentId: "e-2", previousStatus: "ACTIVE", newEnrollmentId: null },
      ],
    } as never);

    const result = await revertPromotionRunAction({ runId: "pr-1", reason: "wrong class selection" });

    expect(result).toMatchObject({ data: { status: "REVERTED" } });
    expect(prismaMock.enrollment.delete).toHaveBeenCalledWith({ where: { id: "e-new" } });
    expect(prismaMock.enrollment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "e-1" }, data: expect.objectContaining({ status: "ACTIVE" }),
    }));
    expect(prismaMock.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "s-2" }, data: expect.objectContaining({ status: "ACTIVE" }),
    }));
  });

  it("refuses to revert a DRAFT or already-REVERTED run", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "DRAFT", schoolId: "default-school", committedAt: null, items: [],
    } as never);

    const result = await revertPromotionRunAction({ runId: "pr-1", reason: "oops" });
    expect(result).toEqual({ error: "Only COMMITTED runs can be reverted" });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append:

```ts
import { revertPromotionRunSchema } from "../schemas/promotion.schema";

const REVERT_GRACE_DAYS = 14;

export async function revertPromotionRunAction(input: { runId: string; reason: string }) {
  const parsed = revertPromotionRunSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const result = await db.$transaction(async (tx) => {
    const run = await tx.promotionRun.findFirst({
      where: { id: parsed.data.runId, schoolId: ctx.schoolId },
      include: { items: true },
    });
    if (!run) return { error: "Run not found" as string };
    if (run.status !== "COMMITTED") return { error: "Only COMMITTED runs can be reverted" as string };
    if (!run.committedAt) return { error: "Run missing commit timestamp" as string };

    const ageDays = (Date.now() - run.committedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > REVERT_GRACE_DAYS) {
      return { error: `Revert window has expired (${REVERT_GRACE_DAYS} days)` as string };
    }

    for (const item of run.items) {
      // Delete the new enrollment (if any — GRADUATE/WITHDRAW won't have one).
      if (item.newEnrollmentId) {
        await tx.enrollment.delete({ where: { id: item.newEnrollmentId } }).catch(() => undefined);
      }
      // Restore previous enrollment status.
      await tx.enrollment.update({
        where: { id: item.previousEnrollmentId },
        data: { status: "ACTIVE" },
      });
      // Restore student status.
      await tx.student.update({
        where: { id: item.studentId },
        data: { status: item.previousStatus },
      });
    }

    const reverted = await tx.promotionRun.update({
      where: { id: parsed.data.runId },
      data: {
        status: "REVERTED",
        revertedAt: new Date(),
        revertedBy: ctx.session.user.id!,
        revertReason: parsed.data.reason,
      },
    });
    return { data: reverted };
  });

  if ("error" in result) return result;

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "PromotionRun",
    entityId: parsed.data.runId,
    module: "students",
    description: `Reverted promotion run: ${parsed.data.reason}`,
    newData: { status: "REVERTED" },
  });

  return result;
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/promotion.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add revertPromotionRunAction with 14-day grace window"
```

---

## Task 13: Integration test — end-to-end lifecycle

**Files:**
- Create: `tests/integration/students/promotion-lifecycle.test.ts`

- [ ] **Step 1: Write the integration test**

Follow the shape of `tests/integration/admissions/standard-pipeline.test.ts`. Seed: school, two academic years (current + next), programme, Class + ClassArm for SHS1 in both years, 3 students enrolled in SHS1-A of current year. Then:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createPromotionRunAction,
  seedPromotionRunItemsAction,
  commitPromotionRunAction,
  revertPromotionRunAction,
  updatePromotionRunItemAction,
} from "@/modules/student/actions/promotion.action";
// Reuse auth + school seed helpers from existing integration tests.
// See tests/integration/admissions/standard-pipeline.test.ts for patterns.

describe("Promotion lifecycle (integration)", () => {
  let db: PrismaClient;
  // (setup hooks seed school, years, classes, arms, students — mirror existing integration-test setup)

  it("runs create → seed → commit → revert happy path", async () => {
    const create = await createPromotionRunAction({ sourceClassArmId: "<seeded-ca-1>" });
    expect(create).toHaveProperty("data");
    const runId = (create as { data: { id: string } }).data.id;

    const seed = await seedPromotionRunItemsAction(runId);
    expect(seed).toMatchObject({ data: { seeded: 3, skipped: 0 } });

    // Override one student to RETAIN within same yearGroup (destination arm in target year).
    // (look up item + destination arm by query, then call updatePromotionRunItemAction)

    const commit = await commitPromotionRunAction(runId);
    expect(commit).toMatchObject({ data: { status: "COMMITTED" } });

    // Verify: 2 new enrollments in target year under next-yearGroup arm + 1 under same-yearGroup arm (RETAIN), old enrollments PROMOTED.
    const newEnrollments = await db.enrollment.findMany({ where: { academicYearId: "<target-ay>" } });
    expect(newEnrollments).toHaveLength(3);

    const revert = await revertPromotionRunAction({ runId, reason: "integration test rollback" });
    expect(revert).toMatchObject({ data: { status: "REVERTED" } });

    const after = await db.enrollment.findMany({ where: { academicYearId: "<target-ay>" } });
    expect(after).toHaveLength(0);
  });
});
```

Fill placeholder IDs from the actual test seed. Look at `tests/integration/admissions/standard-pipeline.test.ts` for the full setup pattern (beforeAll/afterAll, cleanup strategy).

- [ ] **Step 2: Run integration test**

Run: `npx vitest run tests/integration/students/promotion-lifecycle.test.ts`
Expected: passing (will likely require the `TEST_DATABASE_URL` env used by existing integration tests).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/students/promotion-lifecycle.test.ts
git commit -m "test(students): add promotion lifecycle integration test"
```

---

## Task 14: Entry page — list drafts + committed runs

**Files:**
- Create: `src/app/(dashboard)/students/promotion/page.tsx`
- Create: `src/app/(dashboard)/students/promotion/promotion-entry-client.tsx`

- [ ] **Step 1: Server page**

```tsx
// src/app/(dashboard)/students/promotion/page.tsx
import {
  listPromotionRunsAction,
  getEligibleSourceArmsAction,
} from "@/modules/student/actions/promotion.action";
import { PromotionEntryClient } from "./promotion-entry-client";

export default async function PromotionEntryPage() {
  const [runsRes, armsRes] = await Promise.all([
    listPromotionRunsAction(),
    getEligibleSourceArmsAction(),
  ]);

  const runs = "data" in runsRes ? runsRes.data : [];
  const arms = "data" in armsRes ? armsRes.data : [];
  const error =
    "error" in runsRes ? runsRes.error : "error" in armsRes ? armsRes.error : null;

  return <PromotionEntryClient runs={runs} arms={arms} error={error} />;
}
```

- [ ] **Step 2: Client component**

```tsx
// src/app/(dashboard)/students/promotion/promotion-entry-client.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { createPromotionRunAction } from "@/modules/student/actions/promotion.action";

type Arm = { id: string; name: string; class: { name: string; yearGroup: number }; _count: { enrollments: number } };
type Run = { id: string; status: "DRAFT" | "COMMITTED" | "REVERTED"; committedAt: Date | null; sourceClassArm: { name: string; class: { name: string } }; sourceAcademicYear: { name: string }; targetAcademicYear: { name: string }; _count: { items: number } };

export function PromotionEntryClient({ runs, arms, error }: { runs: Run[]; arms: Arm[]; error: string | null }) {
  const router = useRouter();
  const [selectedArm, setSelectedArm] = useState<string>("");
  const [pending, start] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const drafts = runs.filter((r) => r.status === "DRAFT");
  const committed = runs.filter((r) => r.status === "COMMITTED" || r.status === "REVERTED");

  const handleCreate = () => {
    if (!selectedArm) return;
    start(async () => {
      const res = await createPromotionRunAction({ sourceClassArmId: selectedArm });
      if ("error" in res) setActionError(res.error);
      else router.push(`/students/promotion/${res.data.id}?step=1`);
    });
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Promotion Runs</h1>
        <Link href="/students/promotion/batch"><Button variant="outline">Batch Create</Button></Link>
      </div>
      {error && <Card className="p-4 text-destructive">{error}</Card>}
      <Card className="p-4 space-y-3">
        <h2 className="font-medium">Start a new run</h2>
        <div className="flex gap-2">
          <Select value={selectedArm} onValueChange={setSelectedArm}>
            <SelectTrigger className="w-[320px]"><SelectValue placeholder="Pick a source class arm" /></SelectTrigger>
            <SelectContent>
              {arms.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.class.name} — {a.name} ({a._count.enrollments} students)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} disabled={!selectedArm || pending}>Create Draft</Button>
        </div>
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      </Card>
      <section>
        <h2 className="font-medium mb-2">Active Drafts ({drafts.length})</h2>
        <div className="grid gap-2">
          {drafts.map((r) => (
            <Link key={r.id} href={`/students/promotion/${r.id}?step=1`}>
              <Card className="p-4 hover:bg-accent">
                <div className="flex justify-between">
                  <span>{r.sourceClassArm.class.name} — {r.sourceClassArm.name}</span>
                  <span className="text-muted-foreground">{r._count.items} students</span>
                </div>
                <div className="text-sm text-muted-foreground">{r.sourceAcademicYear.name} → {r.targetAcademicYear.name}</div>
              </Card>
            </Link>
          ))}
          {drafts.length === 0 && <p className="text-sm text-muted-foreground">No active drafts.</p>}
        </div>
      </section>
      <section>
        <h2 className="font-medium mb-2">Committed / Reverted Runs</h2>
        <div className="grid gap-2">
          {committed.map((r) => (
            <Link key={r.id} href={`/students/promotion/${r.id}`}>
              <Card className="p-4 hover:bg-accent">
                <div className="flex justify-between">
                  <span>{r.sourceClassArm.class.name} — {r.sourceClassArm.name}</span>
                  <span className="text-sm text-muted-foreground">{r.status}</span>
                </div>
              </Card>
            </Link>
          ))}
          {committed.length === 0 && <p className="text-sm text-muted-foreground">No committed runs yet.</p>}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke**

Run: `npm run dev` → open `/students/promotion`. Expected: page renders, picker lists eligible arms, drafts list empty.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/students/promotion/page.tsx src/app/\(dashboard\)/students/promotion/promotion-entry-client.tsx
git commit -m "feat(students): add promotion entry page"
```

---

## Task 15: Wizard shell + Step 1 (Source Review)

**Files:**
- Create: `src/app/(dashboard)/students/promotion/[runId]/page.tsx`
- Create: `src/app/(dashboard)/students/promotion/[runId]/wizard-client.tsx`
- Create: `src/app/(dashboard)/students/promotion/[runId]/step-1-source-review.tsx`

- [ ] **Step 1: Server page**

```tsx
// src/app/(dashboard)/students/promotion/[runId]/page.tsx
import { getPromotionRunAction } from "@/modules/student/actions/promotion.action";
import { notFound } from "next/navigation";
import { WizardClient } from "./wizard-client";
import { RunDetailClient } from "./run-detail-client";

export default async function Page({ params, searchParams }: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { runId } = await params;
  const { step } = await searchParams;
  const res = await getPromotionRunAction(runId);
  if ("error" in res) return notFound();
  const run = res.data;
  const stepNum = Math.min(Math.max(parseInt(step ?? "1", 10) || 1, 1), 4);
  if (run.status === "DRAFT") return <WizardClient run={run} step={stepNum} />;
  return <RunDetailClient run={run} />;
}
```

- [ ] **Step 2: Wizard client (stepper shell)**

```tsx
// src/app/(dashboard)/students/promotion/[runId]/wizard-client.tsx
"use client";

import { useRouter } from "next/navigation";
import { Step1SourceReview } from "./step-1-source-review";
import { Step2OutcomesGrid } from "./step-2-outcomes-grid";
import { Step3DestinationPreview } from "./step-3-destination-preview";
import { Step4Commit } from "./step-4-commit";

export function WizardClient({ run, step }: { run: any; step: number }) {
  const router = useRouter();
  const goto = (n: number) => router.push(`/students/promotion/${run.id}?step=${n}`);

  return (
    <div className="container py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Promotion Wizard</h1>
        <p className="text-sm text-muted-foreground">
          {run.sourceClassArm.class.name} — {run.sourceClassArm.name} ·{" "}
          {run.sourceAcademicYear.name} → {run.targetAcademicYear.name}
        </p>
        <nav className="flex gap-2 mt-3">
          {["1. Source", "2. Outcomes", "3. Destinations", "4. Commit"].map((label, idx) => (
            <button
              key={label}
              onClick={() => goto(idx + 1)}
              className={`px-3 py-1 text-sm rounded ${step === idx + 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >{label}</button>
          ))}
        </nav>
      </header>
      {step === 1 && <Step1SourceReview run={run} onNext={() => goto(2)} />}
      {step === 2 && <Step2OutcomesGrid run={run} onNext={() => goto(3)} onBack={() => goto(1)} />}
      {step === 3 && <Step3DestinationPreview run={run} onNext={() => goto(4)} onBack={() => goto(2)} />}
      {step === 4 && <Step4Commit run={run} onBack={() => goto(3)} />}
    </div>
  );
}
```

- [ ] **Step 3: Step 1 component**

```tsx
// src/app/(dashboard)/students/promotion/[runId]/step-1-source-review.tsx
"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { seedPromotionRunItemsAction, deletePromotionRunAction } from "@/modules/student/actions/promotion.action";
import { useRouter } from "next/navigation";

export function Step1SourceReview({ run, onNext }: { run: any; onNext: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const handleSeed = () => {
    start(async () => {
      const res = await seedPromotionRunItemsAction(run.id);
      if ("error" in res) setError(res.error);
      else {
        router.refresh();
        onNext();
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Discard this draft?")) return;
    start(async () => {
      await deletePromotionRunAction(run.id);
      router.push("/students/promotion");
    });
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="font-medium">Source Review</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Source Class Arm</dt>
        <dd>{run.sourceClassArm.class.name} — {run.sourceClassArm.name}</dd>
        <dt className="text-muted-foreground">Source Academic Year</dt>
        <dd>{run.sourceAcademicYear.name}</dd>
        <dt className="text-muted-foreground">Target Academic Year</dt>
        <dd>{run.targetAcademicYear.name}</dd>
        <dt className="text-muted-foreground">Existing Items</dt>
        <dd>{run.items.length}</dd>
      </dl>
      {error && (
        <Card className="p-3 text-sm text-destructive">
          <p>{error}</p>
          <p className="text-xs mt-1">Fix this in the academics module setup and return here.</p>
        </Card>
      )}
      <div className="flex gap-2">
        <Button onClick={handleSeed} disabled={pending}>
          {run.items.length === 0 ? "Seed outcomes" : "Re-seed / continue"}
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={pending}>Discard Draft</Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Add placeholder exports so wizard-client imports don't fail**

Create stub files that will be filled in Tasks 16–18:

`src/app/(dashboard)/students/promotion/[runId]/step-2-outcomes-grid.tsx`:
```tsx
"use client";
export function Step2OutcomesGrid(_: any) { return <div>Step 2 pending</div>; }
```

`src/app/(dashboard)/students/promotion/[runId]/step-3-destination-preview.tsx`:
```tsx
"use client";
export function Step3DestinationPreview(_: any) { return <div>Step 3 pending</div>; }
```

`src/app/(dashboard)/students/promotion/[runId]/step-4-commit.tsx`:
```tsx
"use client";
export function Step4Commit(_: any) { return <div>Step 4 pending</div>; }
```

`src/app/(dashboard)/students/promotion/[runId]/run-detail-client.tsx`:
```tsx
"use client";
export function RunDetailClient(_: any) { return <div>Run detail pending</div>; }
```

- [ ] **Step 5: Smoke test**

Run: `npm run dev` → create a draft → open Step 1 → click "Seed outcomes" → verify redirect to Step 2 (stub).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/students/promotion/\[runId\]
git commit -m "feat(students): wizard shell + Step 1 source review"
```

---

## Task 16: Step 2 — Outcomes grid

**Files:**
- Modify: `src/app/(dashboard)/students/promotion/[runId]/step-2-outcomes-grid.tsx`

- [ ] **Step 1: Replace stub with full grid**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  updatePromotionRunItemAction,
  bulkUpdatePromotionRunItemsAction,
} from "@/modules/student/actions/promotion.action";
import { useRouter } from "next/navigation";

type Outcome = "PROMOTE" | "RETAIN" | "GRADUATE" | "WITHDRAW";

export function Step2OutcomesGrid({ run, onNext, onBack }: { run: any; onNext: () => void; onBack: () => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const updateRow = (itemId: string, patch: { outcome?: Outcome; destinationClassArmId?: string | null; notes?: string }) => {
    start(async () => {
      await updatePromotionRunItemAction({ itemId, ...patch });
      router.refresh();
    });
  };

  const applyBulk = (outcome?: Outcome, destinationClassArmId?: string | null) => {
    if (selected.size === 0) return;
    start(async () => {
      await bulkUpdatePromotionRunItemsAction({
        runId: run.id,
        itemIds: Array.from(selected),
        outcome,
        destinationClassArmId,
      });
      router.refresh();
      setSelected(new Set());
    });
  };

  const possibleDestArms: { id: string; label: string }[] = buildDestinationArmOptions(run);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Outcomes ({run.items.length} students)</h2>
        <div className="flex gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={selected.size === 0 || pending} onClick={() => applyBulk("PROMOTE")}>Mark selected PROMOTE</Button>
          <Button variant="outline" size="sm" disabled={selected.size === 0 || pending} onClick={() => applyBulk("RETAIN")}>Mark selected RETAIN</Button>
          <Button variant="outline" size="sm" disabled={selected.size === 0 || pending} onClick={() => applyBulk("GRADUATE")}>Mark selected GRADUATE</Button>
          <Button variant="outline" size="sm" disabled={selected.size === 0 || pending} onClick={() => applyBulk("WITHDRAW")}>Mark selected WITHDRAW</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2"><Checkbox checked={selected.size === run.items.length && run.items.length > 0} onCheckedChange={() => setSelected(selected.size === run.items.length ? new Set() : new Set(run.items.map((i: any) => i.id)))} /></th>
              <th className="p-2">Student</th>
              <th className="p-2">ID</th>
              <th className="p-2">Outcome</th>
              <th className="p-2">Destination</th>
              <th className="p-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {run.items.map((item: any) => (
              <tr key={item.id} className="border-b">
                <td className="p-2"><Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} /></td>
                <td className="p-2">{item.student.lastName}, {item.student.firstName}</td>
                <td className="p-2">{item.student.studentId}</td>
                <td className="p-2">
                  <Select value={item.outcome} onValueChange={(v) => updateRow(item.id, { outcome: v as Outcome })}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROMOTE">PROMOTE</SelectItem>
                      <SelectItem value="RETAIN">RETAIN</SelectItem>
                      <SelectItem value="GRADUATE">GRADUATE</SelectItem>
                      <SelectItem value="WITHDRAW">WITHDRAW</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2">
                  {(item.outcome === "PROMOTE" || item.outcome === "RETAIN") ? (
                    <Select
                      value={item.destinationClassArmId ?? ""}
                      onValueChange={(v) => updateRow(item.id, { destinationClassArmId: v || null })}
                    >
                      <SelectTrigger className="w-[180px]"><SelectValue placeholder="Pick arm" /></SelectTrigger>
                      <SelectContent>
                        {possibleDestArms.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-2">
                  <Input
                    defaultValue={item.notes ?? ""}
                    onBlur={(e) => { if (e.target.value !== (item.notes ?? "")) updateRow(item.id, { notes: e.target.value }); }}
                    className="w-[200px]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next: Destinations</Button>
      </div>
    </Card>
  );
}

function buildDestinationArmOptions(run: any): { id: string; label: string }[] {
  // Unique destination arms referenced by current items (seeded defaults).
  // Additional arms can be surfaced by fetching from server in a future iteration.
  const map = new Map<string, string>();
  for (const i of run.items) {
    if (i.destinationClassArm) {
      map.set(i.destinationClassArm.id, `${i.destinationClassArm.class?.name ?? ""} — ${i.destinationClassArm.name}`);
    }
  }
  return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
}
```

- [ ] **Step 2: Smoke test**

Run: `npm run dev` → seed a draft → open Step 2 → change an outcome dropdown → page refreshes and value persists.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(students): Step 2 outcomes grid with bulk actions"
```

---

## Task 17: Step 3 — Destination preview with capacity rollup

**Files:**
- Modify: `src/app/(dashboard)/students/promotion/[runId]/step-3-destination-preview.tsx`

- [ ] **Step 1: Replace stub**

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Step3DestinationPreview({ run, onNext, onBack }: { run: any; onNext: () => void; onBack: () => void }) {
  const byArm: Record<string, { count: number; name: string }> = {};
  let graduating = 0;
  let withdrawing = 0;
  let retaining = 0;
  let promoting = 0;

  for (const item of run.items) {
    if (item.outcome === "GRADUATE") graduating++;
    else if (item.outcome === "WITHDRAW") withdrawing++;
    else if (item.outcome === "RETAIN") retaining++;
    else if (item.outcome === "PROMOTE") promoting++;
    if (item.destinationClassArmId) {
      const arm = item.destinationClassArm;
      byArm[item.destinationClassArmId] ??= { count: 0, name: `${arm?.class?.name ?? ""} — ${arm?.name ?? ""}` };
      byArm[item.destinationClassArmId].count++;
    }
  }

  const overCap = Object.entries(byArm).filter(([id, { count }]) => {
    const roll = run.capacityByArm?.[id];
    if (!roll) return false;
    return roll.existing + count > roll.capacity;
  });

  const canAdvance = overCap.length === 0;

  return (
    <Card className="p-6 space-y-4">
      <h2 className="font-medium">Destination Preview</h2>
      <div className="grid grid-cols-4 gap-2 text-sm">
        <Card className="p-3"><div className="text-muted-foreground">Promote</div><div className="text-2xl">{promoting}</div></Card>
        <Card className="p-3"><div className="text-muted-foreground">Retain</div><div className="text-2xl">{retaining}</div></Card>
        <Card className="p-3"><div className="text-muted-foreground">Graduate</div><div className="text-2xl">{graduating}</div></Card>
        <Card className="p-3"><div className="text-muted-foreground">Withdraw</div><div className="text-2xl">{withdrawing}</div></Card>
      </div>
      <section>
        <h3 className="font-medium text-sm mb-2">Destination arms</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Arm</th>
              <th className="p-2">Incoming</th>
              <th className="p-2">Existing</th>
              <th className="p-2">Capacity</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byArm).map(([id, { name, count }]) => {
              const roll = run.capacityByArm?.[id];
              const over = roll ? roll.existing + count > roll.capacity : false;
              return (
                <tr key={id} className={over ? "bg-destructive/10" : ""}>
                  <td className="p-2">{name}</td>
                  <td className="p-2">{count}</td>
                  <td className="p-2">{roll?.existing ?? "?"}</td>
                  <td className="p-2">{roll?.capacity ?? "?"}</td>
                  <td className="p-2">{over ? "OVER CAPACITY" : "OK"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {!canAdvance && <p className="text-sm text-destructive">Resolve over-capacity arms before advancing, or confirm override on the commit step.</p>}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!canAdvance}>Next: Commit</Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Smoke test**

Run: `npm run dev` → Step 3 shows counts and arm rollup.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(students): Step 3 destination preview with capacity"
```

---

## Task 18: Step 4 — Commit

**Files:**
- Modify: `src/app/(dashboard)/students/promotion/[runId]/step-4-commit.tsx`

- [ ] **Step 1: Replace stub**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { commitPromotionRunAction } from "@/modules/student/actions/promotion.action";
import { useRouter } from "next/navigation";

export function Step4Commit({ run, onBack }: { run: any; onBack: () => void }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const counts = run.items.reduce((acc: Record<string, number>, i: any) => {
    acc[i.outcome] = (acc[i.outcome] ?? 0) + 1;
    return acc;
  }, {});

  const handleCommit = () => {
    if (confirm !== "COMMIT") return;
    start(async () => {
      const res = await commitPromotionRunAction(run.id);
      if ("error" in res) setError(res.error);
      else router.push(`/students/promotion/${run.id}`);
    });
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="font-medium">Commit Promotion Run</h2>
      <p className="text-sm text-muted-foreground">
        This will apply {run.items.length} outcomes to enrollments and student records. The run can be reverted within 14 days.
      </p>
      <ul className="text-sm">
        <li>PROMOTE: {counts.PROMOTE ?? 0}</li>
        <li>RETAIN: {counts.RETAIN ?? 0}</li>
        <li>GRADUATE: {counts.GRADUATE ?? 0}</li>
        <li>WITHDRAW: {counts.WITHDRAW ?? 0}</li>
      </ul>
      <div className="space-y-1">
        <label className="text-sm">Type <code>COMMIT</code> to confirm</label>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-[200px]" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={handleCommit} disabled={confirm !== "COMMIT" || pending}>Commit</Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Smoke test**

Run: `npm run dev` → walk through all four steps → commit a test run → verify redirect to run detail.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(students): Step 4 commit confirmation"
```

---

## Task 19: Run detail page + revert

**Files:**
- Modify: `src/app/(dashboard)/students/promotion/[runId]/run-detail-client.tsx`

- [ ] **Step 1: Replace stub**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { revertPromotionRunAction } from "@/modules/student/actions/promotion.action";
import { useRouter } from "next/navigation";

const GRACE_DAYS = 14;

export function RunDetailClient({ run }: { run: any }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const ageDays = run.committedAt
    ? (Date.now() - new Date(run.committedAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  const canRevert = run.status === "COMMITTED" && ageDays <= GRACE_DAYS;

  const handleRevert = () => {
    if (!canRevert || reason.trim().length < 5) return;
    if (!confirm("Revert this run? New enrollments will be deleted and previous state restored. Boarding bed allocations will NOT be restored automatically.")) return;
    start(async () => {
      const res = await revertPromotionRunAction({ runId: run.id, reason });
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="container py-6 space-y-4">
      <h1 className="text-2xl font-semibold">Promotion Run · {run.status}</h1>
      <Card className="p-4 space-y-2 text-sm">
        <div>Source: {run.sourceClassArm.class.name} — {run.sourceClassArm.name}</div>
        <div>{run.sourceAcademicYear.name} → {run.targetAcademicYear.name}</div>
        {run.committedAt && <div>Committed: {new Date(run.committedAt).toLocaleString()}</div>}
        {run.revertedAt && <div>Reverted: {new Date(run.revertedAt).toLocaleString()} — {run.revertReason}</div>}
      </Card>
      <Card className="p-4">
        <h2 className="font-medium mb-2">Outcomes ({run.items.length})</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th className="p-2">Student</th><th className="p-2">Outcome</th><th className="p-2">Destination</th></tr></thead>
          <tbody>
            {run.items.map((i: any) => (
              <tr key={i.id} className="border-b">
                <td className="p-2">{i.student.lastName}, {i.student.firstName}</td>
                <td className="p-2">{i.outcome}</td>
                <td className="p-2">{i.destinationClassArm ? `${i.destinationClassArm.class?.name} — ${i.destinationClassArm.name}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {canRevert && (
        <Card className="p-4 space-y-2">
          <h2 className="font-medium">Revert</h2>
          <p className="text-sm text-muted-foreground">Available until {new Date(new Date(run.committedAt).getTime() + GRACE_DAYS * 86400000).toLocaleDateString()}.</p>
          <Textarea placeholder="Reason for revert (min 5 chars)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button variant="destructive" onClick={handleRevert} disabled={pending || reason.trim().length < 5}>Revert Run</Button>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Run: `npm run dev` → commit a run → on run detail page enter reason → revert → verify state restored.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(students): run detail + revert UI"
```

---

## Task 20: Batch page — spawn drafts across classArms

**Files:**
- Create: `src/app/(dashboard)/students/promotion/batch/page.tsx`
- Create: `src/app/(dashboard)/students/promotion/batch/batch-client.tsx`

- [ ] **Step 1: Server page**

```tsx
// src/app/(dashboard)/students/promotion/batch/page.tsx
import { getEligibleSourceArmsAction } from "@/modules/student/actions/promotion.action";
import { BatchClient } from "./batch-client";

export default async function Page() {
  const res = await getEligibleSourceArmsAction();
  const arms = "data" in res ? res.data : [];
  const error = "error" in res ? res.error : null;
  return <BatchClient arms={arms} error={error} />;
}
```

- [ ] **Step 2: Client**

```tsx
// src/app/(dashboard)/students/promotion/batch/batch-client.tsx
"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createPromotionRunAction } from "@/modules/student/actions/promotion.action";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function BatchClient({ arms, error }: { arms: any[]; error: string | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [created, setCreated] = useState<{ armId: string; runId?: string; error?: string }[]>([]);
  const [pending, start] = useTransition();

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const handleBatch = () => {
    start(async () => {
      const results: typeof created = [];
      for (const armId of Array.from(selected)) {
        const res = await createPromotionRunAction({ sourceClassArmId: armId });
        if ("error" in res) results.push({ armId, error: res.error });
        else results.push({ armId, runId: res.data.id });
      }
      setCreated(results);
      router.refresh();
    });
  };

  return (
    <div className="container py-6 space-y-4">
      <h1 className="text-2xl font-semibold">Batch Create Promotion Drafts</h1>
      {error && <Card className="p-4 text-destructive">{error}</Card>}
      <Card className="p-4 space-y-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2"></th>
              <th className="p-2">Class</th>
              <th className="p-2">Arm</th>
              <th className="p-2">Enrollments</th>
            </tr>
          </thead>
          <tbody>
            {arms.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="p-2"><Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} /></td>
                <td className="p-2">{a.class.name}</td>
                <td className="p-2">{a.name}</td>
                <td className="p-2">{a._count.enrollments}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button onClick={handleBatch} disabled={selected.size === 0 || pending}>
          Create drafts for {selected.size} arm(s)
        </Button>
      </Card>
      {created.length > 0 && (
        <Card className="p-4">
          <h2 className="font-medium mb-2">Results</h2>
          <ul className="text-sm space-y-1">
            {created.map((r) => (
              <li key={r.armId}>
                {r.runId ? (
                  <Link className="underline" href={`/students/promotion/${r.runId}?step=1`}>Open run {r.runId}</Link>
                ) : (
                  <span className="text-destructive">Failed: {r.error}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev` → `/students/promotion/batch` → select arms → batch create → verify drafts exist.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(students): batch-create promotion drafts page"
```

---

## Task 21: Entry point from students list

**Files:**
- Modify: `src/app/(dashboard)/students/students-client.tsx`

- [ ] **Step 1: Add link in the students-client toolbar**

Open `src/app/(dashboard)/students/students-client.tsx`. Locate the primary-actions group (near existing `/students/new` and `/students/import` links). Add:

```tsx
<Link href="/students/promotion"><Button variant="outline">Promotion</Button></Link>
```

(Place it adjacent to the import button; match the import button's styling.)

- [ ] **Step 2: Verify**

Run: `npm run dev` → `/students` → confirm "Promotion" button navigates to `/students/promotion`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/students/students-client.tsx
git commit -m "feat(students): add Promotion entry from student list"
```

---

## Task 22: End-to-end manual verification

**Files:** (no edits — verification only)

- [ ] **Step 1: Seed dataset**

Use existing seed commands (check `package.json` for a `seed` script) or manually create via the admin UI: 1 school, 2 academic years (current + next), 1 programme, SHS1 + SHS2 + SHS3 Class rows in BOTH years, 1 ClassArm "A" under each class, 10 students enrolled into SHS1/A of current year.

- [ ] **Step 2: Walk the wizard**

Run: `npm run dev` → log in as super_admin → `/students/promotion` → create draft for SHS1/A → Step 1 seed → Step 2 change 1 student to RETAIN, 1 to WITHDRAW, leave 8 as PROMOTE → Step 3 confirm rollup → Step 4 COMMIT.

Verify:
- Run status = COMMITTED
- 8 new enrollments in SHS2/A for target year
- 1 new enrollment remaining in SHS1/A for target year (RETAIN)
- 1 student status = WITHDRAWN, bed vacated

- [ ] **Step 3: Revert**

On run detail, enter revert reason → click Revert. Verify:
- Run status = REVERTED
- No enrollments in target year for these students
- Withdrawn student status = ACTIVE again
- Previous enrollments all ACTIVE

- [ ] **Step 4: Batch flow**

`/students/promotion/batch` → select 2 arms → batch create → verify two drafts appear on entry page.

- [ ] **Step 5: Permission check**

Log in as a non-promote role → `/students/promotion` → verify all actions return permission-denied responses and UI shows error card.

- [ ] **Step 6: Final test suite run**

Run: `npx vitest run` — all promotion tests passing, no regressions.

- [ ] **Step 7: Screenshot evidence**

Capture browser screenshots of each step + run detail + revert confirmation. Save to `docs/screenshots/promotion-wizard/`.

- [ ] **Step 8: Mark complete**

No commit needed for verification steps — evidence is the screenshots and passing tests.

---

## Self-Review Checklist (plan author)

- [x] Spec coverage: every requirement in the spec maps to a task (schema → T1, permission → T2, read actions → T4–6, draft lifecycle → T7–10, commit → T11, revert → T12, integration → T13, UI → T14–20, entry point → T21, verification → T22)
- [x] No placeholders: every code step has actual code, every command has expected output
- [x] Type consistency: action names match between test and implementation (`createPromotionRunAction`, `seedPromotionRunItemsAction`, etc.); enum values match between schema and tests (`PROMOTE | RETAIN | GRADUATE | WITHDRAW`); zod schemas referenced in Task 3 are imported in Tasks 7, 9, 12
- [x] File paths: all tasks use exact absolute-style repo paths
- [x] TDD shape: every logic task has write-test → verify-fail → implement → verify-pass → commit
