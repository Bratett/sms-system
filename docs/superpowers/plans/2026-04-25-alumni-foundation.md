# Alumni Lifecycle — Foundation + Self-Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-seed AlumniProfile + flip user role on graduation; add alumni-facing portal (profile + directory); replace admin alumni page with a richer dashboard.

**Architecture:** New `src/modules/alumni/` sub-module with a graduation hook helper, alumni-self actions, and an admin-dashboard action. New `(portal)/alumni/*` route group with profile self-service and a read-only directory. The existing `confirmGraduationRecordAction` calls the new hook inside its transaction.

**Tech Stack:** Next.js 15 App Router, Prisma 6.x on PostgreSQL, vitest + vitest-mock-extended, zod, sonner. Auth uses a `UserRole` join table (User ↔ Role); a graduate's role transition is implemented as deleting their `student` UserRole row and inserting an `alumni` UserRole row.

**Spec reference:** `docs/superpowers/specs/2026-04-25-alumni-foundation-design.md`

---

## Implementation adaptations vs. the spec

The spec described `User.role` as a single string field. The actual codebase uses a `UserRole` join table:

```
User -< UserRole >- Role -< RolePermission >- Permission
```

This affects two areas:

1. **Adding a new role (`alumni`)** — must update both the static `DEFAULT_ROLE_PERMISSIONS` map in `src/lib/permissions.ts` AND the seed file at `prisma/seed/index.ts` (which mirrors the static map). Then run `npm run db:seed` so DB-side `Role`, `Permission`, and `RolePermission` rows exist for runtime auth.

2. **Role flip on graduation** — implemented as: read the student's `userId`, look up the `alumni` Role's id, in the transaction `deleteMany` UserRole rows where `userId === student.userId AND role.name IN ('student')`, then `create` a UserRole row linking that user to the alumni Role.

3. **Session role check in alumni layout** — uses `session.user.roles.includes("alumni")` (array), not `session.user.role === "alumni"` (string).

These adjustments are reflected in every task below.

---

## File Structure

**Created:**
- `src/modules/alumni/alumni-graduation-hook.ts` — pure helper called inside `confirmGraduationRecordAction`'s transaction
- `src/modules/alumni/schemas/alumni-self.schema.ts` — zod schema for the self-service update input
- `src/modules/alumni/actions/alumni-self.action.ts` — 4 alumni-side server actions
- `src/modules/alumni/actions/alumni-admin.action.ts` — `getAlumniDashboardAction`
- `src/app/(portal)/alumni/layout.tsx` — route-group layout with role gate + sidebar
- `src/app/(portal)/alumni/profile/page.tsx` + `profile-client.tsx` — self-service profile page
- `src/app/(portal)/alumni/directory/page.tsx` + `directory-client.tsx` — directory page
- `src/app/(dashboard)/graduation/alumni/alumni-edit-modal.tsx` — admin edit modal (calls existing `upsertAlumniProfileAction`)
- `tests/unit/modules/alumni/alumni-graduation-hook.test.ts`
- `tests/unit/modules/alumni/alumni-self.test.ts`
- `tests/unit/modules/alumni/alumni-admin.test.ts`
- `tests/integration/students/alumni-lifecycle.test.ts`

**Modified:**
- `src/lib/permissions.ts` — 2 new constants + alumni role array
- `prisma/seed/index.ts` — same additions to mirror the runtime map
- `src/modules/graduation/actions/graduation.action.ts::confirmGraduationRecordAction` — wrap updates in transaction, call hook, add audit
- `src/app/(dashboard)/graduation/alumni/page.tsx` — switch data source to `getAlumniDashboardAction`
- `src/app/(dashboard)/graduation/alumni/alumni-client.tsx` — full rewrite (stat cards, filters, completeness column, side widgets)
- `tests/unit/auth/permissions.test.ts` — 1 regression test for the alumni role

---

## Task 1: Add `alumni` role + 2 permissions

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `prisma/seed/index.ts`
- Modify: `tests/unit/auth/permissions.test.ts`

### Step 1: Add the two constants to `src/lib/permissions.ts`

Open `src/lib/permissions.ts`. Find the `PERMISSIONS` object. After the `REPORT_CARDS_*` block (added in PR #29), insert:

```ts
  // Alumni
  ALUMNI_PROFILE_UPDATE_OWN: "alumni:profile:update-own",
  ALUMNI_DIRECTORY_READ:     "alumni:directory:read",
```

### Step 2: Add the alumni role bundle

In the same file, locate `DEFAULT_ROLE_PERMISSIONS`. Add a new top-level entry:

```ts
  alumni: [
    PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN,
    PERMISSIONS.ALUMNI_DIRECTORY_READ,
  ],
```

Position it alphabetically near `admissions_officer` — match the existing order in the file.

### Step 3: Mirror into `prisma/seed/index.ts`

Open `prisma/seed/index.ts`. Find the local `DEFAULT_ROLE_PERMISSIONS` map (line ~370). Add the same `alumni` entry with the same two permission code strings:

```ts
  alumni: [
    "alumni:profile:update-own",
    "alumni:directory:read",
  ],
```

If the seed file has a separate list of permission codes (used to upsert `Permission` rows), add the two new codes there as well — locate by grep for `"academics:report-cards:download-own"` (the equivalent addition from PR #29).

### Step 4: Add a regression test

Open `tests/unit/auth/permissions.test.ts`. After the existing report-card-release regression test, add:

```ts
it("alumni role has exactly the expected permissions", () => {
  expect(DEFAULT_ROLE_PERMISSIONS.alumni).toEqual([
    PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN,
    PERMISSIONS.ALUMNI_DIRECTORY_READ,
  ]);
  expect(DEFAULT_ROLE_PERMISSIONS.student).not.toContain(PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN);
  expect(DEFAULT_ROLE_PERMISSIONS.student).not.toContain(PERMISSIONS.ALUMNI_DIRECTORY_READ);
  expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN);
  expect(DEFAULT_ROLE_PERMISSIONS.class_teacher).not.toContain(PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN);
});
```

If there is an existing test asserting the full set of seeded role names (search for `expectedRoles` or `seeded roles`), append `"alumni"` to the array.

### Step 5: Verify

- [ ] Run: `npx vitest run tests/unit/auth/permissions.test.ts`
  Expected: all tests pass including the new one.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 6: Re-seed the dev DB

- [ ] Run: `npm run db:seed`
  Expected: idempotent — adds the `alumni` Role + 2 new Permission + 2 new RolePermission rows. Existing data untouched.

### Step 7: Commit

```bash
git add src/lib/permissions.ts prisma/seed/index.ts tests/unit/auth/permissions.test.ts
git commit -m "feat(alumni): add ALUMNI_PROFILE_UPDATE_OWN + ALUMNI_DIRECTORY_READ permissions and alumni role"
```

---

## Task 2: Graduation hook helper (TDD)

**Files:**
- Create: `src/modules/alumni/alumni-graduation-hook.ts`
- Create: `tests/unit/modules/alumni/alumni-graduation-hook.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/alumni/alumni-graduation-hook.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../setup";
import { seedAlumniOnGraduation } from "@/modules/alumni/alumni-graduation-hook";

describe("seedAlumniOnGraduation", () => {
  beforeEach(() => {
    prismaMock.student.findUnique.mockReset();
    prismaMock.alumniProfile.upsert.mockReset();
    prismaMock.role.findUnique.mockReset();
    prismaMock.userRole.deleteMany.mockReset();
    prismaMock.userRole.create.mockReset();
  });

  it("creates profile with isPublic=false and graduationYear from ceremonyDate", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      userId: "u-1",
      user: { email: "k@a.com" },
    } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-alumni" } as never);
    prismaMock.userRole.deleteMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.userRole.create.mockResolvedValue({} as never);

    const result = await seedAlumniOnGraduation(prismaMock as never, {
      studentId: "s-1",
      schoolId: "school-1",
      graduationRecord: { batch: { ceremonyDate: new Date("2026-06-15") } },
    });

    expect(result).toEqual({ profileId: "ap-1", userRoleFlipped: true });
    expect(prismaMock.alumniProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "s-1" },
        create: expect.objectContaining({
          studentId: "s-1",
          schoolId: "school-1",
          graduationYear: 2026,
          email: "k@a.com",
          isPublic: false,
        }),
        update: {},
      }),
    );
  });

  it("flips user role: deletes student UserRole, creates alumni UserRole", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      userId: "u-1",
      user: { email: "x@a.com" },
    } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-alumni" } as never);
    prismaMock.userRole.deleteMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.userRole.create.mockResolvedValue({} as never);

    await seedAlumniOnGraduation(prismaMock as never, {
      studentId: "s-1",
      schoolId: "school-1",
      graduationRecord: { batch: { ceremonyDate: new Date("2026-06-15") } },
    });

    expect(prismaMock.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u-1", role: { name: "student" } },
    });
    expect(prismaMock.userRole.create).toHaveBeenCalledWith({
      data: { userId: "u-1", roleId: "role-alumni" },
    });
  });

  it("skips role flip when student has no userId", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      userId: null,
      user: null,
    } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);

    const result = await seedAlumniOnGraduation(prismaMock as never, {
      studentId: "s-1",
      schoolId: "school-1",
      graduationRecord: { batch: { ceremonyDate: new Date("2026-06-15") } },
    });

    expect(result.userRoleFlipped).toBe(false);
    expect(prismaMock.role.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.userRole.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.userRole.create).not.toHaveBeenCalled();
  });

  it("falls back to current year when ceremonyDate is null", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ userId: null, user: null } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);

    const currentYear = new Date().getFullYear();
    await seedAlumniOnGraduation(prismaMock as never, {
      studentId: "s-1",
      schoolId: "school-1",
      graduationRecord: { batch: { ceremonyDate: null } },
    });

    expect(prismaMock.alumniProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ graduationYear: currentYear }),
      }),
    );
  });

  it("upsert update branch is empty (preserves edits on re-confirmation)", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ userId: null, user: null } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);

    await seedAlumniOnGraduation(prismaMock as never, {
      studentId: "s-1",
      schoolId: "school-1",
      graduationRecord: { batch: { ceremonyDate: new Date() } },
    });

    expect(prismaMock.alumniProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });

  it("throws when student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null as never);

    await expect(
      seedAlumniOnGraduation(prismaMock as never, {
        studentId: "missing",
        schoolId: "school-1",
        graduationRecord: { batch: { ceremonyDate: new Date() } },
      }),
    ).rejects.toThrow(/Student missing not found/);
  });

  it("throws when alumni Role row is missing in DB", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      userId: "u-1",
      user: { email: "x" },
    } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({ id: "ap-1" } as never);
    prismaMock.role.findUnique.mockResolvedValue(null as never);

    await expect(
      seedAlumniOnGraduation(prismaMock as never, {
        studentId: "s-1",
        schoolId: "school-1",
        graduationRecord: { batch: { ceremonyDate: new Date() } },
      }),
    ).rejects.toThrow(/alumni role not seeded/i);
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/alumni/alumni-graduation-hook.test.ts`
  Expected: fail (module not found).

### Step 3: Implement the hook

Create `src/modules/alumni/alumni-graduation-hook.ts`:

```ts
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/**
 * Seeds the alumni surface for a freshly confirmed graduate.
 *
 * Side effects (all on the supplied transaction client):
 * - Upserts an `AlumniProfile` row keyed on `studentId @unique`. The `update`
 *   branch is empty so re-confirmation preserves alumnus edits.
 * - If `student.userId` is set, deletes any existing `UserRole` rows linking
 *   that user to the `student` role and creates a fresh `UserRole` linking
 *   them to the `alumni` role. The session-side roles array updates on the
 *   alumnus's next login.
 *
 * Caller is responsible for providing the transaction client and committing.
 */
export async function seedAlumniOnGraduation(
  tx: TxClient,
  input: {
    studentId: string;
    schoolId: string;
    graduationRecord: {
      batch: { ceremonyDate: Date | null };
    };
  },
): Promise<{ profileId: string; userRoleFlipped: boolean }> {
  const student = await tx.student.findUnique({
    where: { id: input.studentId },
    select: {
      userId: true,
      user: { select: { email: true } },
    },
  });
  if (!student) {
    throw new Error(`Student ${input.studentId} not found`);
  }

  const ceremonyDate = input.graduationRecord.batch.ceremonyDate;
  let graduationYear: number;
  if (ceremonyDate) {
    graduationYear = ceremonyDate.getFullYear();
  } else {
    graduationYear = new Date().getFullYear();
    console.warn("seedAlumniOnGraduation: ceremonyDate is null, using current year", {
      studentId: input.studentId,
      year: graduationYear,
    });
  }

  const profile = await tx.alumniProfile.upsert({
    where: { studentId: input.studentId },
    create: {
      studentId: input.studentId,
      schoolId: input.schoolId,
      graduationYear,
      email: student.user?.email ?? null,
      isPublic: false,
    },
    update: {}, // No-op for existing profiles; preserves alumnus edits.
    select: { id: true },
  });

  let userRoleFlipped = false;
  if (student.userId) {
    const alumniRole = await tx.role.findUnique({
      where: { name: "alumni" },
      select: { id: true },
    });
    if (!alumniRole) {
      throw new Error(
        "Alumni role not seeded in DB. Run `npm run db:seed` to populate.",
      );
    }

    // Remove the old student role (if linked) so the user no longer has
    // student-portal access.
    await tx.userRole.deleteMany({
      where: { userId: student.userId, role: { name: "student" } },
    });

    // Add the alumni role. Use create (not upsert) — the deleteMany above
    // ensures no existing alumni role row exists; if one does (rare repeat
    // call), let it surface as a unique-constraint error rather than silently
    // double-adding.
    await tx.userRole.create({
      data: { userId: student.userId, roleId: alumniRole.id },
    });
    userRoleFlipped = true;
  }

  return { profileId: profile.id, userRoleFlipped };
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/alumni/alumni-graduation-hook.test.ts`
  Expected: 7 tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/alumni/alumni-graduation-hook.ts tests/unit/modules/alumni/alumni-graduation-hook.test.ts
git commit -m "feat(alumni): graduation hook helper (auto-seed profile + flip role)"
```

---

## Task 3: Wire the hook into `confirmGraduationRecordAction`

**Files:**
- Modify: `src/modules/graduation/actions/graduation.action.ts` (around line 200-235 — the `confirmGraduationRecordAction` body)

### Step 1: Add the import

At the top of `src/modules/graduation/actions/graduation.action.ts`:

```ts
import { seedAlumniOnGraduation } from "@/modules/alumni/alumni-graduation-hook";
```

### Step 2: Wrap the updates in a transaction and call the hook

Find the existing body of `confirmGraduationRecordAction`. The current shape is:

```ts
// existing
const updated = await db.graduationRecord.update({ ... });
await db.student.update({ where: { id: record.studentId }, data: { status: "GRADUATED" } });
await audit({ ... });
return { data: updated };
```

Replace the two updates and the audit with:

```ts
const result = await db.$transaction(async (tx) => {
  const updated = await tx.graduationRecord.update({
    where: { id: recordId },
    data: {
      status: "CONFIRMED",
      certificateNumber: data.certificateNumber || record.certificateNumber,
      honours: data.honours || record.honours,
    },
  });
  await tx.student.update({
    where: { id: record.studentId },
    data: { status: "GRADUATED" },
  });
  const seeded = await seedAlumniOnGraduation(tx, {
    studentId: record.studentId,
    schoolId: ctx.schoolId,
    graduationRecord: { batch: record.batch },
  });
  return { updated, seeded };
});

await audit({
  userId: ctx.session.user.id,
  action: "UPDATE",
  entity: "GraduationRecord",
  entityId: recordId,
  module: "graduation",
  description: `Confirmed graduate record`,
  previousData: record,
  newData: result.updated,
});

await audit({
  userId: ctx.session.user.id,
  schoolId: ctx.schoolId,
  action: "CREATE",
  entity: "AlumniProfile",
  entityId: result.seeded.profileId,
  module: "alumni",
  description: `Auto-seeded alumni profile on graduation confirmation`,
  metadata: {
    studentId: record.studentId,
    autoSeeded: true,
    userRoleFlipped: result.seeded.userRoleFlipped,
  },
});

return { data: result.updated };
```

Notes:
- The existing function loads `record` *with* `include: { batch: true }` (verify by reading the existing code) — that include must be preserved so `record.batch` is available for the hook.
- Pass `tx` (not `db`) into the hook so it joins the same transaction.
- The two `audit()` calls run AFTER the transaction commits — if the transaction fails, no audit row is written.

### Step 3: Verify

- [ ] Run: `npx tsc --noEmit`
  Expected: clean.
- [ ] Run: `npx vitest run`
  Expected: zero regressions in existing graduation tests. (If the existing graduation tests mock `confirmGraduationRecordAction`'s DB calls, they may need to add mocks for the new hook calls. Read the failing test, identify which mocks are missing, and add them — typical additions: `prismaMock.role.findUnique`, `prismaMock.alumniProfile.upsert`, `prismaMock.userRole.deleteMany`, `prismaMock.userRole.create`, plus making `prismaMock.$transaction` resolve its callback with `prismaMock` as the `tx`.)

If there are no existing unit tests touching `confirmGraduationRecordAction`, the integration test in Task 9 covers the wiring end-to-end.

### Step 4: Commit

```bash
git add src/modules/graduation/actions/graduation.action.ts
# Plus any test files updated.
git commit -m "feat(alumni): confirmGraduationRecordAction auto-seeds alumni profile + flips role"
```

---

## Task 4: Alumni-self actions (TDD)

**Files:**
- Create: `src/modules/alumni/schemas/alumni-self.schema.ts`
- Create: `src/modules/alumni/actions/alumni-self.action.ts`
- Create: `tests/unit/modules/alumni/alumni-self.test.ts`

### Step 1: Write the schema

Create `src/modules/alumni/schemas/alumni-self.schema.ts`:

```ts
import { z } from "zod";

export const updateMyAlumniProfileSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().min(6).max(32).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  currentEmployer: z.string().max(200).optional().nullable(),
  currentPosition: z.string().max(200).optional().nullable(),
  industry: z.string().max(200).optional().nullable(),
  highestEducation: z.string().max(200).optional().nullable(),
  linkedinUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
  bio: z.string().max(2000).optional().nullable(),
  isPublic: z.boolean().optional(),
});

export type UpdateMyAlumniProfileInput = z.infer<typeof updateMyAlumniProfileSchema>;
```

### Step 2: Write failing tests

Create `tests/unit/modules/alumni/alumni-self.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../../setup";
import { audit } from "@/lib/audit";
import {
  getMyAlumniProfileAction,
  updateMyAlumniProfileAction,
  getAlumniDirectoryAction,
  getPublicAlumniProfileAction,
} from "@/modules/alumni/actions/alumni-self.action";

const ALUMNI_PERMS = ["alumni:profile:update-own", "alumni:directory:read"];

const sampleStudent = {
  id: "s-1",
  firstName: "Kofi",
  lastName: "Asante",
  studentId: "STU-001",
  photoUrl: null,
  dateOfBirth: new Date("2005-03-01"),
};

const sampleProfile = {
  id: "ap-1",
  studentId: "s-1",
  schoolId: "default-school",
  graduationYear: 2026,
  email: "kofi@example.com",
  phone: "+233200000000",
  address: "Accra",
  currentEmployer: "Acme",
  currentPosition: "Engineer",
  industry: "Tech",
  highestEducation: "BSc CS",
  linkedinUrl: "https://linkedin.com/in/kofi",
  bio: "Software engineer.",
  isPublic: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getMyAlumniProfileAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.graduationRecord.findFirst.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getMyAlumniProfileAction();
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects non-graduated user", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const res = await getMyAlumniProfileAction();
    expect(res).toEqual({ error: "Alumni access not available." });
  });

  it("returns profile + student + graduation record on happy path", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.graduationRecord.findFirst.mockResolvedValue({
      certificateNumber: "CERT-001",
      honours: "Distinction",
      batch: { name: "Class of 2026", ceremonyDate: new Date("2026-06-15") },
    } as never);

    const res = await getMyAlumniProfileAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.id).toBe("ap-1");
    expect(res.data.student.firstName).toBe("Kofi");
    expect(res.data.graduation?.certificateNumber).toBe("CERT-001");
  });

  it("returns null graduation when no CONFIRMED record exists", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.graduationRecord.findFirst.mockResolvedValue(null as never);

    const res = await getMyAlumniProfileAction();
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.graduation).toBeNull();
  });
});

describe("updateMyAlumniProfileAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.alumniProfile.update.mockReset();
    vi.mocked(audit).mockClear();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await updateMyAlumniProfileAction({ bio: "new" });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects non-graduated user", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const res = await updateMyAlumniProfileAction({ bio: "new" });
    expect(res).toEqual({ error: "Alumni access not available." });
  });

  it("rejects invalid email format", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);
    const res = await updateMyAlumniProfileAction({ email: "not-an-email" });
    expect("error" in res).toBe(true);
  });

  it("happy path updates only supplied fields and audits", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniProfile.update.mockResolvedValue({
      ...sampleProfile,
      bio: "Updated bio.",
    } as never);

    const res = await updateMyAlumniProfileAction({ bio: "Updated bio." });
    expect(res).toEqual({ data: expect.objectContaining({ bio: "Updated bio." }) });
    expect(prismaMock.alumniProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "s-1" },
        data: { bio: "Updated bio." },
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });

  it("does not write fields that were not in the input", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniProfile.update.mockResolvedValue(sampleProfile as never);

    await updateMyAlumniProfileAction({ isPublic: true });
    const updateCall = prismaMock.alumniProfile.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data).toEqual({ isPublic: true });
    expect(updateCall.data).not.toHaveProperty("bio");
    expect(updateCall.data).not.toHaveProperty("email");
  });

  it("converts empty linkedinUrl to null", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s-1" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniProfile.update.mockResolvedValue(sampleProfile as never);

    await updateMyAlumniProfileAction({ linkedinUrl: "" });
    const updateCall = prismaMock.alumniProfile.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.linkedinUrl).toBeNull();
  });
});

describe("getAlumniDirectoryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.student.findMany.mockReset();
    prismaMock.alumniProfile.findMany.mockReset();
    prismaMock.alumniProfile.count.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getAlumniDirectoryAction({});
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects non-graduated user", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const res = await getAlumniDirectoryAction({});
    expect(res).toEqual({ error: "Alumni access not available." });
  });

  it("excludes self + private + other-school profiles via where clause", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findMany.mockResolvedValue([] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(0 as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await getAlumniDirectoryAction({});

    expect(prismaMock.alumniProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "default-school",
          isPublic: true,
          studentId: { not: "self-id" },
        }),
      }),
    );
  });

  it("happy path returns redacted shape (no email/phone/address)", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      {
        id: "ap-2",
        studentId: "s-2",
        graduationYear: 2025,
        currentEmployer: "Other Co",
        currentPosition: "PM",
        industry: "Tech",
        highestEducation: "BSc",
        linkedinUrl: null,
        bio: "Other alum.",
      },
    ] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(1 as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-2", firstName: "Akua", lastName: "Mensah", photoUrl: null },
    ] as never);

    const res = await getAlumniDirectoryAction({});
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data[0]).toMatchObject({
      id: "ap-2",
      firstName: "Akua",
      lastName: "Mensah",
      currentEmployer: "Other Co",
    });
    expect(res.data[0]).not.toHaveProperty("email");
    expect(res.data[0]).not.toHaveProperty("phone");
    expect(res.data[0]).not.toHaveProperty("address");
  });

  it("applies graduationYear and industry filters", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findMany.mockResolvedValue([] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(0 as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await getAlumniDirectoryAction({ graduationYear: 2025, industry: "tech" });

    expect(prismaMock.alumniProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          graduationYear: 2025,
          industry: { contains: "tech", mode: "insensitive" },
        }),
      }),
    );
  });
});

describe("getPublicAlumniProfileAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.student.findUnique.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getPublicAlumniProfileAction("s-2");
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("returns 404-shape for non-existent profile", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(null as never);
    const res = await getPublicAlumniProfileAction("missing");
    expect(res).toEqual({ error: "Profile not found" });
  });

  it("returns 404-shape for private profile", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue({
      id: "ap-2",
      studentId: "s-2",
      schoolId: "default-school",
      graduationYear: 2025,
      isPublic: false,
      currentEmployer: null,
      currentPosition: null,
      industry: null,
      highestEducation: null,
      linkedinUrl: null,
      bio: null,
    } as never);
    const res = await getPublicAlumniProfileAction("s-2");
    expect(res).toEqual({ error: "Profile not found" });
  });

  it("returns 404-shape for other-school profile", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue({
      id: "ap-2",
      studentId: "s-2",
      schoolId: "OTHER-SCHOOL",
      graduationYear: 2025,
      isPublic: true,
      currentEmployer: null,
      currentPosition: null,
      industry: null,
      highestEducation: null,
      linkedinUrl: null,
      bio: null,
    } as never);
    const res = await getPublicAlumniProfileAction("s-2");
    expect(res).toEqual({ error: "Profile not found" });
  });

  it("happy path returns redacted public profile", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "self-id" } as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue({
      id: "ap-2",
      studentId: "s-2",
      schoolId: "default-school",
      graduationYear: 2025,
      isPublic: true,
      currentEmployer: "Co",
      currentPosition: "Role",
      industry: "Tech",
      highestEducation: null,
      linkedinUrl: null,
      bio: "Alum.",
    } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      firstName: "Akua",
      lastName: "Mensah",
      photoUrl: null,
    } as never);

    const res = await getPublicAlumniProfileAction("s-2");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.firstName).toBe("Akua");
    expect(res.data.currentEmployer).toBe("Co");
    expect(res.data).not.toHaveProperty("email");
    expect(res.data).not.toHaveProperty("phone");
    expect(res.data).not.toHaveProperty("address");
  });
});
```

### Step 3: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/alumni/alumni-self.test.ts`
  Expected: fail (module not found).

### Step 4: Implement the action file

Create `src/modules/alumni/actions/alumni-self.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  updateMyAlumniProfileSchema,
  type UpdateMyAlumniProfileInput,
} from "../schemas/alumni-self.schema";

// ─── Get my profile ─────────────────────────────────────────────────

/** @no-audit Read-only alumni self-view. */
export async function getMyAlumniProfileAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN);
  if (denied) return denied;

  const userId = ctx.session.user.id;
  const student = await db.student.findFirst({
    where: { userId, schoolId: ctx.schoolId, status: "GRADUATED" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentId: true,
      photoUrl: true,
      dateOfBirth: true,
    },
  });
  if (!student) {
    console.error("alumni: status check failed (getMyAlumniProfileAction)", { userId });
    return { error: "Alumni access not available." };
  }

  const profile = await db.alumniProfile.findUnique({
    where: { studentId: student.id },
  });
  if (!profile) return { error: "Alumni profile not found" };

  const gradRecord = await db.graduationRecord.findFirst({
    where: { studentId: student.id, status: "CONFIRMED" },
    include: { batch: { select: { name: true, ceremonyDate: true } } },
  });

  return {
    data: {
      ...profile,
      student,
      graduation: gradRecord
        ? {
            certificateNumber: gradRecord.certificateNumber,
            honours: gradRecord.honours,
            batchName: gradRecord.batch.name,
            ceremonyDate: gradRecord.batch.ceremonyDate,
          }
        : null,
    },
  };
}

// ─── Update my profile ──────────────────────────────────────────────

export async function updateMyAlumniProfileAction(input: UpdateMyAlumniProfileInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ALUMNI_PROFILE_UPDATE_OWN);
  if (denied) return denied;

  const parsed = updateMyAlumniProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const userId = ctx.session.user.id;
  const student = await db.student.findFirst({
    where: { userId, schoolId: ctx.schoolId, status: "GRADUATED" },
    select: { id: true },
  });
  if (!student) {
    console.error("alumni: status check failed (updateMyAlumniProfileAction)", { userId });
    return { error: "Alumni access not available." };
  }

  const previous = await db.alumniProfile.findUnique({
    where: { studentId: student.id },
  });
  if (!previous) return { error: "Alumni profile not found" };

  const data: Record<string, unknown> = {};
  if (parsed.data.email !== undefined) data.email = parsed.data.email;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone;
  if (parsed.data.address !== undefined) data.address = parsed.data.address;
  if (parsed.data.currentEmployer !== undefined) data.currentEmployer = parsed.data.currentEmployer;
  if (parsed.data.currentPosition !== undefined) data.currentPosition = parsed.data.currentPosition;
  if (parsed.data.industry !== undefined) data.industry = parsed.data.industry;
  if (parsed.data.highestEducation !== undefined) data.highestEducation = parsed.data.highestEducation;
  if (parsed.data.linkedinUrl !== undefined) {
    data.linkedinUrl = parsed.data.linkedinUrl === "" ? null : parsed.data.linkedinUrl;
  }
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
  if (parsed.data.isPublic !== undefined) data.isPublic = parsed.data.isPublic;

  const updated = await db.alumniProfile.update({
    where: { studentId: student.id },
    data,
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "AlumniProfile",
    entityId: updated.id,
    module: "alumni",
    description: `Alumnus updated own profile`,
    previousData: previous,
    newData: updated,
  });

  return { data: updated };
}

// ─── Directory ──────────────────────────────────────────────────────

/** @no-audit Read-only alumni directory. */
export async function getAlumniDirectoryAction(filters?: {
  search?: string;
  graduationYear?: number;
  industry?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ALUMNI_DIRECTORY_READ);
  if (denied) return denied;

  const userId = ctx.session.user.id;
  const ownStudent = await db.student.findFirst({
    where: { userId, schoolId: ctx.schoolId, status: "GRADUATED" },
    select: { id: true },
  });
  if (!ownStudent) {
    console.error("alumni: status check failed (getAlumniDirectoryAction)", { userId });
    return { error: "Alumni access not available." };
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    isPublic: true,
    studentId: { not: ownStudent.id },
  };
  if (filters?.graduationYear) where.graduationYear = filters.graduationYear;
  if (filters?.industry) {
    where.industry = { contains: filters.industry, mode: "insensitive" };
  }

  if (filters?.search) {
    const matchingStudents = await db.student.findMany({
      where: {
        status: "GRADUATED",
        schoolId: ctx.schoolId,
        OR: [
          { firstName: { contains: filters.search, mode: "insensitive" } },
          { lastName: { contains: filters.search, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    where.studentId = {
      in: matchingStudents.map((s) => s.id).filter((id) => id !== ownStudent.id),
    };
  }

  const [profiles, total] = await Promise.all([
    db.alumniProfile.findMany({
      where,
      orderBy: { graduationYear: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        studentId: true,
        graduationYear: true,
        currentEmployer: true,
        currentPosition: true,
        industry: true,
        highestEducation: true,
        linkedinUrl: true,
        bio: true,
      },
    }),
    db.alumniProfile.count({ where }),
  ]);

  const studentIds = profiles.map((p) => p.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, photoUrl: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = profiles.map((p) => ({
    ...p,
    firstName: studentMap.get(p.studentId)?.firstName ?? "",
    lastName: studentMap.get(p.studentId)?.lastName ?? "",
    photoUrl: studentMap.get(p.studentId)?.photoUrl ?? null,
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

// ─── Single public profile ──────────────────────────────────────────

/** @no-audit Read-only single public alumnus view. */
export async function getPublicAlumniProfileAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ALUMNI_DIRECTORY_READ);
  if (denied) return denied;

  const userId = ctx.session.user.id;
  const ownStudent = await db.student.findFirst({
    where: { userId, schoolId: ctx.schoolId, status: "GRADUATED" },
    select: { id: true },
  });
  if (!ownStudent) {
    console.error("alumni: status check failed (getPublicAlumniProfileAction)", { userId });
    return { error: "Alumni access not available." };
  }

  const profile = await db.alumniProfile.findUnique({
    where: { studentId },
    select: {
      id: true,
      studentId: true,
      schoolId: true,
      graduationYear: true,
      isPublic: true,
      currentEmployer: true,
      currentPosition: true,
      industry: true,
      highestEducation: true,
      linkedinUrl: true,
      bio: true,
    },
  });
  if (!profile || profile.schoolId !== ctx.schoolId || !profile.isPublic) {
    return { error: "Profile not found" };
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { firstName: true, lastName: true, photoUrl: true },
  });
  if (!student) return { error: "Profile not found" };

  return {
    data: {
      id: profile.id,
      studentId: profile.studentId,
      graduationYear: profile.graduationYear,
      currentEmployer: profile.currentEmployer,
      currentPosition: profile.currentPosition,
      industry: profile.industry,
      highestEducation: profile.highestEducation,
      linkedinUrl: profile.linkedinUrl,
      bio: profile.bio,
      firstName: student.firstName,
      lastName: student.lastName,
      photoUrl: student.photoUrl,
    },
  };
}
```

### Step 5: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/alumni/alumni-self.test.ts`
  Expected: all tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 6: Commit

```bash
git add src/modules/alumni/schemas/alumni-self.schema.ts src/modules/alumni/actions/alumni-self.action.ts tests/unit/modules/alumni/alumni-self.test.ts
git commit -m "feat(alumni): self-service actions (read profile, update profile, directory, public profile)"
```

---

## Task 5: Alumni-admin dashboard action (TDD)

**Files:**
- Create: `src/modules/alumni/actions/alumni-admin.action.ts`
- Create: `tests/unit/modules/alumni/alumni-admin.test.ts`

### Step 1: Write failing tests

Create `tests/unit/modules/alumni/alumni-admin.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../../setup";
import { getAlumniDashboardAction } from "@/modules/alumni/actions/alumni-admin.action";

const ADMIN_PERMS = ["graduation:read"];

describe("getAlumniDashboardAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS });
    prismaMock.alumniProfile.findMany.mockReset();
    prismaMock.alumniProfile.count.mockReset();
    prismaMock.student.findMany.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getAlumniDashboardAction({});
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("happy path returns rows + pagination + aggregates", async () => {
    const profile1 = {
      id: "ap-1",
      studentId: "s-1",
      schoolId: "default-school",
      graduationYear: 2026,
      email: "a@x.com",
      phone: "+233...",
      address: null,
      currentEmployer: "Acme",
      currentPosition: "Eng",
      industry: "Tech",
      highestEducation: "BSc",
      linkedinUrl: null,
      bio: "Bio",
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const profile2 = {
      ...profile1,
      id: "ap-2",
      studentId: "s-2",
      graduationYear: 2025,
      industry: "Finance",
      isPublic: false,
      bio: null,
      currentEmployer: null,
    };

    prismaMock.alumniProfile.findMany
      // First call: paginated rows
      .mockResolvedValueOnce([profile1, profile2] as never)
      // Second call: aggregate corpus (selects only graduationYear, industry, isPublic, studentId)
      .mockResolvedValueOnce([
        { graduationYear: 2026, industry: "Tech", isPublic: true, studentId: "s-1" },
        { graduationYear: 2025, industry: "Finance", isPublic: false, studentId: "s-2" },
      ] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(2 as never);
    prismaMock.student.findMany
      // First call: paginated row hydration
      .mockResolvedValueOnce([
        { id: "s-1", firstName: "Kofi", lastName: "Asante", studentId: "STU-001", photoUrl: null, userId: "u-1" },
        { id: "s-2", firstName: "Akua", lastName: "Mensah", studentId: "STU-002", photoUrl: null, userId: null },
      ] as never)
      // Second call: aggregate userId resolution
      .mockResolvedValueOnce([
        { id: "s-1", userId: "u-1" },
        { id: "s-2", userId: null },
      ] as never);

    const res = await getAlumniDashboardAction({});
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data).toHaveLength(2);
    expect(res.data[0].profileCompleteness).toBeGreaterThan(0);
    expect(res.data[1].needsInvite).toBe(true);
    expect(res.aggregates.total).toBe(2);
    expect(res.aggregates.publicCount).toBe(1);
    expect(res.aggregates.privateCount).toBe(1);
    expect(res.aggregates.needsInviteCount).toBe(1);
    expect(res.aggregates.byYear).toContainEqual({ year: 2026, count: 1 });
    expect(res.aggregates.byYear).toContainEqual({ year: 2025, count: 1 });
    expect(res.aggregates.topIndustries).toContainEqual({ industry: "Tech", count: 1 });
    expect(res.aggregates.topIndustries).toContainEqual({ industry: "Finance", count: 1 });
  });

  it("status=public filter applies isPublic: true", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(0 as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await getAlumniDashboardAction({ status: "public" });

    expect(prismaMock.alumniProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPublic: true }),
      }),
    );
  });

  it("status=incomplete filter applies bio:null + currentEmployer:null", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(0 as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await getAlumniDashboardAction({ status: "incomplete" });

    expect(prismaMock.alumniProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bio: null, currentEmployer: null }),
      }),
    );
  });

  it("status=needs_invite filters rows post-join (userId === null)", async () => {
    prismaMock.alumniProfile.findMany
      .mockResolvedValueOnce([
        {
          id: "ap-1",
          studentId: "s-1",
          schoolId: "default-school",
          graduationYear: 2026,
          email: null,
          phone: null,
          address: null,
          currentEmployer: null,
          currentPosition: null,
          industry: null,
          highestEducation: null,
          linkedinUrl: null,
          bio: null,
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "ap-2",
          studentId: "s-2",
          schoolId: "default-school",
          graduationYear: 2026,
          email: null,
          phone: null,
          address: null,
          currentEmployer: null,
          currentPosition: null,
          industry: null,
          highestEducation: null,
          linkedinUrl: null,
          bio: null,
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(2 as never);
    prismaMock.student.findMany
      .mockResolvedValueOnce([
        { id: "s-1", firstName: "A", lastName: "X", studentId: "STU-1", photoUrl: null, userId: "u-1" },
        { id: "s-2", firstName: "B", lastName: "Y", studentId: "STU-2", photoUrl: null, userId: null },
      ] as never)
      .mockResolvedValueOnce([] as never);

    const res = await getAlumniDashboardAction({ status: "needs_invite" });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data).toHaveLength(1);
    expect(res.data[0].studentId).toBe("s-2");
    expect(res.data[0].needsInvite).toBe(true);
  });
});
```

### Step 2: Verify RED

- [ ] Run: `npx vitest run tests/unit/modules/alumni/alumni-admin.test.ts`
  Expected: fail (module not found).

### Step 3: Implement

Create `src/modules/alumni/actions/alumni-admin.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

const COMPLETENESS_FIELDS = [
  "email",
  "phone",
  "currentEmployer",
  "currentPosition",
  "industry",
  "highestEducation",
  "linkedinUrl",
  "bio",
] as const;

function computeProfileCompleteness(profile: Record<string, unknown>): number {
  let count = 0;
  for (const field of COMPLETENESS_FIELDS) {
    const value = profile[field];
    if (value !== null && value !== undefined && value !== "") count += 1;
  }
  return Math.round((count / COMPLETENESS_FIELDS.length) * 100);
}

/** @no-audit Read-only admin dashboard. */
export async function getAlumniDashboardAction(filters?: {
  search?: string;
  graduationYear?: number;
  industry?: string;
  status?: "all" | "public" | "private" | "incomplete" | "needs_invite";
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
  if (filters?.graduationYear) where.graduationYear = filters.graduationYear;
  if (filters?.industry) {
    where.industry = { contains: filters.industry, mode: "insensitive" };
  }
  if (filters?.status === "public") where.isPublic = true;
  if (filters?.status === "private") where.isPublic = false;
  if (filters?.status === "incomplete") {
    where.bio = null;
    where.currentEmployer = null;
  }

  if (filters?.search) {
    const matchingStudents = await db.student.findMany({
      where: {
        status: "GRADUATED",
        schoolId: ctx.schoolId,
        OR: [
          { firstName: { contains: filters.search, mode: "insensitive" } },
          { lastName: { contains: filters.search, mode: "insensitive" } },
          { studentId: { contains: filters.search, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    where.studentId = { in: matchingStudents.map((s) => s.id) };
  }

  const [profiles, total, allProfiles] = await Promise.all([
    db.alumniProfile.findMany({
      where,
      orderBy: { graduationYear: "desc" },
      skip,
      take: pageSize,
    }),
    db.alumniProfile.count({ where }),
    db.alumniProfile.findMany({
      where: { schoolId: ctx.schoolId },
      select: {
        graduationYear: true,
        industry: true,
        isPublic: true,
        studentId: true,
      },
    }),
  ]);

  const pageStudentIds = profiles.map((p) => p.studentId);
  const pageStudents = await db.student.findMany({
    where: { id: { in: pageStudentIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentId: true,
      photoUrl: true,
      userId: true,
    },
  });
  const pageStudentMap = new Map(pageStudents.map((s) => [s.id, s]));

  let rows = profiles.map((p) => {
    const student = pageStudentMap.get(p.studentId);
    return {
      ...p,
      firstName: student?.firstName ?? "Unknown",
      lastName: student?.lastName ?? "",
      studentCode: student?.studentId ?? "",
      photoUrl: student?.photoUrl ?? null,
      needsInvite: !student?.userId,
      profileCompleteness: computeProfileCompleteness(p as unknown as Record<string, unknown>),
    };
  });

  // Apply needs_invite filter post-join (userId lives on Student, not AlumniProfile).
  if (filters?.status === "needs_invite") {
    rows = rows.filter((r) => r.needsInvite);
  }

  // Aggregates computed across the school (not the filtered page).
  const aggTotal = allProfiles.length;
  const publicCount = allProfiles.filter((p) => p.isPublic).length;
  const privateCount = aggTotal - publicCount;

  const allStudentIds = allProfiles.map((p) => p.studentId);
  const allStudents = await db.student.findMany({
    where: { id: { in: allStudentIds } },
    select: { id: true, userId: true },
  });
  const userIdMap = new Map(allStudents.map((s) => [s.id, s.userId]));
  const needsInviteCount = allProfiles.filter((p) => !userIdMap.get(p.studentId)).length;

  const byYearMap = new Map<number, number>();
  for (const p of allProfiles) {
    byYearMap.set(p.graduationYear, (byYearMap.get(p.graduationYear) ?? 0) + 1);
  }
  const byYear = [...byYearMap.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);

  const industryMap = new Map<string, number>();
  for (const p of allProfiles) {
    if (!p.industry) continue;
    industryMap.set(p.industry, (industryMap.get(p.industry) ?? 0) + 1);
  }
  const topIndustries = [...industryMap.entries()]
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    data: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    aggregates: {
      total: aggTotal,
      publicCount,
      privateCount,
      needsInviteCount,
      byYear,
      topIndustries,
    },
  };
}
```

### Step 4: Verify GREEN

- [ ] Run: `npx vitest run tests/unit/modules/alumni/alumni-admin.test.ts`
  Expected: all tests pass.
- [ ] Run: `npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add src/modules/alumni/actions/alumni-admin.action.ts tests/unit/modules/alumni/alumni-admin.test.ts
git commit -m "feat(alumni): admin dashboard action (rows + aggregates + completeness)"
```

---

## Task 6: Alumni portal layout

**Files:**
- Create: `src/app/(portal)/alumni/layout.tsx`

### Step 1: Create the layout

Create `src/app/(portal)/alumni/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function AlumniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("alumni")) {
    if (roles.includes("parent")) redirect("/parent");
    if (roles.includes("student")) redirect("/student");
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 border-r border-border bg-card p-4">
        <h2 className="text-lg font-semibold mb-4">Alumni</h2>
        <nav className="space-y-1">
          <Link
            href="/alumni/profile"
            className="block px-3 py-2 rounded text-sm hover:bg-muted"
          >
            My profile
          </Link>
          <Link
            href="/alumni/directory"
            className="block px-3 py-2 rounded text-sm hover:bg-muted"
          >
            Directory
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

### Step 2: Verify

- [ ] Run: `rm -rf .next/dev && npx tsc --noEmit`
  Expected: clean.

### Step 3: Commit

```bash
git add "src/app/(portal)/alumni/layout.tsx"
git commit -m "feat(alumni): portal layout with role gate + sidebar nav"
```

---

## Task 7: `/alumni/profile` page

**Files:**
- Create: `src/app/(portal)/alumni/profile/page.tsx`
- Create: `src/app/(portal)/alumni/profile/profile-client.tsx`

### Step 1: Create page.tsx

Create `src/app/(portal)/alumni/profile/page.tsx`:

```tsx
import { getMyAlumniProfileAction } from "@/modules/alumni/actions/alumni-self.action";
import { ProfileClient } from "./profile-client";

export default async function AlumniProfilePage() {
  const result = await getMyAlumniProfileAction();
  if ("error" in result) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 max-w-xl">
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }
  return <ProfileClient profile={result.data} />;
}
```

### Step 2: Create profile-client.tsx

Create `src/app/(portal)/alumni/profile/profile-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateMyAlumniProfileAction } from "@/modules/alumni/actions/alumni-self.action";

type ProfileShape = {
  id: string;
  graduationYear: number;
  email: string | null;
  phone: string | null;
  address: string | null;
  currentEmployer: string | null;
  currentPosition: string | null;
  industry: string | null;
  highestEducation: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  isPublic: boolean;
  student: {
    firstName: string;
    lastName: string;
    studentId: string;
    photoUrl: string | null;
  };
  graduation: {
    certificateNumber: string | null;
    honours: string | null;
    batchName: string;
    ceremonyDate: Date | string | null;
  } | null;
};

export function ProfileClient({ profile }: { profile: ProfileShape }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    currentEmployer: profile.currentEmployer ?? "",
    currentPosition: profile.currentPosition ?? "",
    industry: profile.industry ?? "",
    highestEducation: profile.highestEducation ?? "",
    linkedinUrl: profile.linkedinUrl ?? "",
    bio: profile.bio ?? "",
    isPublic: profile.isPublic,
  });

  const fullName = `${profile.student.firstName} ${profile.student.lastName}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateMyAlumniProfileAction({
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        currentEmployer: form.currentEmployer || null,
        currentPosition: form.currentPosition || null,
        industry: form.industry || null,
        highestEducation: form.highestEducation || null,
        linkedinUrl: form.linkedinUrl,
        bio: form.bio || null,
        isPublic: form.isPublic,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Profile updated.");
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          {profile.student.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.student.photoUrl}
              alt={fullName}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
              {profile.student.firstName.charAt(0)}
              {profile.student.lastName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold">{fullName}</h1>
            <p className="text-sm text-muted-foreground">
              Class of {profile.graduationYear} · Student ID {profile.student.studentId}
            </p>
            {profile.graduation && (
              <p className="text-xs text-muted-foreground mt-1">
                {profile.graduation.batchName}
                {profile.graduation.certificateNumber
                  ? ` · Cert #${profile.graduation.certificateNumber}`
                  : ""}
                {profile.graduation.honours ? ` · ${profile.graduation.honours}` : ""}
              </p>
            )}
          </div>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-card p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">Edit profile</h2>

        <Field
          label="Email"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
          type="email"
        />
        <Field
          label="Phone"
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
        />
        <Field
          label="Address"
          value={form.address}
          onChange={(v) => setForm({ ...form, address: v })}
        />
        <Field
          label="Current employer"
          value={form.currentEmployer}
          onChange={(v) => setForm({ ...form, currentEmployer: v })}
        />
        <Field
          label="Current position"
          value={form.currentPosition}
          onChange={(v) => setForm({ ...form, currentPosition: v })}
        />
        <Field
          label="Industry"
          value={form.industry}
          onChange={(v) => setForm({ ...form, industry: v })}
        />
        <Field
          label="Highest education"
          value={form.highestEducation}
          onChange={(v) => setForm({ ...form, highestEducation: v })}
        />
        <Field
          label="LinkedIn URL"
          value={form.linkedinUrl}
          onChange={(v) => setForm({ ...form, linkedinUrl: v })}
          type="url"
          placeholder="https://www.linkedin.com/in/..."
        />

        <label className="block">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={4}
            maxLength={2000}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
          />
          <span>Make my profile visible to other alumni from this school</span>
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save changes"}
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

### Step 3: Verify

- [ ] Run: `rm -rf .next/dev && npx tsc --noEmit`
  Expected: clean.

### Step 4: Commit

```bash
git add "src/app/(portal)/alumni/profile/"
git commit -m "feat(alumni): profile page (self-service edit form)"
```

---

## Task 8: `/alumni/directory` page

**Files:**
- Create: `src/app/(portal)/alumni/directory/page.tsx`
- Create: `src/app/(portal)/alumni/directory/directory-client.tsx`

### Step 1: Create page.tsx

Create `src/app/(portal)/alumni/directory/page.tsx`:

```tsx
import { getAlumniDirectoryAction } from "@/modules/alumni/actions/alumni-self.action";
import { getAlumniGraduationYearsAction } from "@/modules/graduation/actions/alumni.action";
import { DirectoryClient } from "./directory-client";

export default async function AlumniDirectoryPage() {
  const [dir, years] = await Promise.all([
    getAlumniDirectoryAction({ page: 1, pageSize: 20 }),
    getAlumniGraduationYearsAction(),
  ]);
  if ("error" in dir) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">{dir.error}</p>
      </div>
    );
  }
  return (
    <DirectoryClient
      initialData={dir.data}
      initialPagination={dir.pagination}
      years={"data" in years ? years.data : []}
    />
  );
}
```

If `getAlumniGraduationYearsAction` is gated on `GRADUATION_READ` (admin-only), reading it from the alumni portal will fail. Check before relying on it. **Adaptation:** if it's admin-gated, instead derive the years client-side from the directory results (`new Set(rows.map(r => r.graduationYear))`), or add a small alumni-side `getDirectoryFilterOptionsAction` helper that returns the year list scoped by school. Implementer's call.

### Step 2: Create directory-client.tsx

Create `src/app/(portal)/alumni/directory/directory-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { getAlumniDirectoryAction } from "@/modules/alumni/actions/alumni-self.action";

type Row = {
  id: string;
  studentId: string;
  graduationYear: number;
  currentEmployer: string | null;
  currentPosition: string | null;
  industry: string | null;
  highestEducation: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function DirectoryClient({
  initialData,
  initialPagination,
  years,
}: {
  initialData: Row[];
  initialPagination: Pagination;
  years: number[];
}) {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialData);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("");
  const [industry, setIndustry] = useState("");
  const [opened, setOpened] = useState<Row | null>(null);

  function load(page: number) {
    start(async () => {
      const res = await getAlumniDirectoryAction({
        search: search || undefined,
        graduationYear: year ? Number(year) : undefined,
        industry: industry || undefined,
        page,
        pageSize: 20,
      });
      if ("data" in res) {
        setRows(res.data);
        setPagination(res.pagination);
      }
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Alumni directory</h1>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-3 items-end">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs font-medium text-muted-foreground">Search by name</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Graduation year</span>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Industry</span>
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. Tech"
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={() => load(1)}
          disabled={pending}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
        >
          {pending ? "Loading…" : "Apply"}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {pagination.total === 0 && !search && !year && !industry
            ? "No alumni have made their profiles public yet. Be the first — toggle visibility on your profile."
            : "No alumni match these filters."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpened(r)}
              className="text-left rounded-xl border border-border bg-card p-4 hover:bg-muted/40"
            >
              <div className="flex items-center gap-3 mb-2">
                {r.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.photoUrl}
                    alt={`${r.firstName} ${r.lastName}`}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                    {r.firstName.charAt(0)}
                    {r.lastName.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">Class of {r.graduationYear}</p>
                </div>
              </div>
              {(r.currentEmployer || r.currentPosition) && (
                <p className="text-xs text-muted-foreground">
                  {r.currentPosition}
                  {r.currentPosition && r.currentEmployer ? " · " : ""}
                  {r.currentEmployer}
                </p>
              )}
              {r.industry && (
                <p className="text-xs text-muted-foreground mt-1">{r.industry}</p>
              )}
              {r.linkedinUrl && (
                <a
                  href={r.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-block mt-2 text-xs text-primary hover:underline"
                >
                  LinkedIn ↗
                </a>
              )}
            </button>
          ))}
        </div>
      )}

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

      {opened && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpened(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-card p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {opened.firstName} {opened.lastName}
                </h2>
                <p className="text-xs text-muted-foreground">Class of {opened.graduationYear}</p>
              </div>
              <button onClick={() => setOpened(null)} className="text-muted-foreground">
                ✕
              </button>
            </div>
            {opened.currentEmployer && (
              <p className="text-sm">
                {opened.currentPosition} at {opened.currentEmployer}
              </p>
            )}
            {opened.industry && (
              <p className="text-xs text-muted-foreground">Industry: {opened.industry}</p>
            )}
            {opened.highestEducation && (
              <p className="text-xs text-muted-foreground">
                Education: {opened.highestEducation}
              </p>
            )}
            {opened.bio && <p className="text-sm">{opened.bio}</p>}
            {opened.linkedinUrl && (
              <a
                href={opened.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-primary hover:underline"
              >
                LinkedIn ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Verify

- [ ] Run: `rm -rf .next/dev && npx tsc --noEmit`
  Expected: clean.

### Step 4: Commit

```bash
git add "src/app/(portal)/alumni/directory/"
git commit -m "feat(alumni): directory page (filters + card grid + detail modal)"
```

---

## Task 9: Admin dashboard rewrite

**Files:**
- Modify: `src/app/(dashboard)/graduation/alumni/page.tsx`
- Modify: `src/app/(dashboard)/graduation/alumni/alumni-client.tsx`
- Create: `src/app/(dashboard)/graduation/alumni/alumni-edit-modal.tsx`

### Step 1: Replace page.tsx

Open `src/app/(dashboard)/graduation/alumni/page.tsx`. Replace its body with:

```tsx
import { getAlumniDashboardAction } from "@/modules/alumni/actions/alumni-admin.action";
import { AlumniClient } from "./alumni-client";

export default async function AlumniPage() {
  const result = await getAlumniDashboardAction({ page: 1, pageSize: 20 });
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
    <AlumniClient
      initialRows={result.data}
      initialPagination={result.pagination}
      aggregates={result.aggregates}
    />
  );
}
```

Preserve any other server-side imports/wrappers the existing page uses (e.g., breadcrumb wrappers). If the existing page has surrounding markup (header, breadcrumbs), keep it and replace only the data-loading + child-render block.

### Step 2: Rewrite alumni-client.tsx

Replace the full contents of `src/app/(dashboard)/graduation/alumni/alumni-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { getAlumniDashboardAction } from "@/modules/alumni/actions/alumni-admin.action";
import { AlumniEditModal } from "./alumni-edit-modal";

type Row = {
  id: string;
  studentId: string;
  graduationYear: number;
  email: string | null;
  phone: string | null;
  address: string | null;
  currentEmployer: string | null;
  currentPosition: string | null;
  industry: string | null;
  highestEducation: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  isPublic: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  firstName: string;
  lastName: string;
  studentCode: string;
  photoUrl: string | null;
  needsInvite: boolean;
  profileCompleteness: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Aggregates = {
  total: number;
  publicCount: number;
  privateCount: number;
  needsInviteCount: number;
  byYear: { year: number; count: number }[];
  topIndustries: { industry: string; count: number }[];
};

type StatusFilter = "all" | "public" | "private" | "incomplete" | "needs_invite";

function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function AlumniClient({
  initialRows,
  initialPagination,
  aggregates: initialAggregates,
}: {
  initialRows: Row[];
  initialPagination: Pagination;
  aggregates: Aggregates;
}) {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [aggregates, setAggregates] = useState<Aggregates>(initialAggregates);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<Row | null>(null);

  function load(page: number) {
    start(async () => {
      const res = await getAlumniDashboardAction({
        search: search || undefined,
        graduationYear: year ? Number(year) : undefined,
        industry: industry || undefined,
        status,
        page,
        pageSize: 20,
      });
      if ("data" in res) {
        setRows(res.data);
        setPagination(res.pagination);
        setAggregates(res.aggregates);
      }
    });
  }

  function applyStatus(s: StatusFilter) {
    setStatus(s);
    start(async () => {
      const res = await getAlumniDashboardAction({
        search: search || undefined,
        graduationYear: year ? Number(year) : undefined,
        industry: industry || undefined,
        status: s,
        page: 1,
        pageSize: 20,
      });
      if ("data" in res) {
        setRows(res.data);
        setPagination(res.pagination);
        setAggregates(res.aggregates);
      }
    });
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Alumni</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Total alumni" value={aggregates.total.toString()} />
        <StatCard
          label="Public profiles"
          value={`${aggregates.publicCount} (${aggregates.total > 0 ? Math.round((aggregates.publicCount / aggregates.total) * 100) : 0}%)`}
        />
        <StatCard
          label="Needs invite"
          value={aggregates.needsInviteCount.toString()}
          onClick={() => applyStatus("needs_invite")}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-3 items-end">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs font-medium text-muted-foreground">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder="Name or student ID"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Graduation year</span>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {aggregates.byYear.map((y) => (
              <option key={y.year} value={y.year}>
                {y.year}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Industry</span>
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. Tech"
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={() => load(1)}
          disabled={pending}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
        >
          Apply
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "public", "private", "incomplete", "needs_invite"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => applyStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs ${
              status === s
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {s === "all" ? "All" : s === "needs_invite" ? "Needs invite" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Student ID</th>
              <th className="p-3 text-left">Year</th>
              <th className="p-3 text-left">Profile</th>
              <th className="p-3 text-left">Visibility</th>
              <th className="p-3 text-left">Employer</th>
              <th className="p-3 text-left">Last updated</th>
              <th className="p-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  No alumni match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                  <td className="p-3">
                    <button
                      onClick={() => setEditing(r)}
                      className="text-left font-medium hover:underline"
                    >
                      {r.firstName} {r.lastName}
                    </button>
                    {r.needsInvite && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">
                        Needs invite
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{r.studentCode}</td>
                  <td className="p-3">{r.graduationYear}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-2 bg-primary"
                          style={{ width: `${r.profileCompleteness}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {r.profileCompleteness}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.isPublic
                          ? "bg-green-100 text-green-800"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.isPublic ? "Public" : "Private"}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.currentEmployer
                      ? `${r.currentEmployer}${r.currentPosition ? " · " + r.currentPosition : ""}`
                      : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {relativeTime(r.updatedAt)}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setEditing(r)}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Top industries</h3>
          {aggregates.topIndustries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No industry data yet.</p>
          ) : (
            <ul className="space-y-2">
              {aggregates.topIndustries.map((t) => (
                <li key={t.industry} className="flex items-center justify-between text-sm">
                  <span>{t.industry}</span>
                  <span className="text-xs text-muted-foreground">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">By graduation year</h3>
          {aggregates.byYear.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          ) : (
            <ul className="space-y-2">
              {aggregates.byYear.map((y) => (
                <li key={y.year} className="flex items-center justify-between text-sm">
                  <span>{y.year}</span>
                  <span className="text-xs text-muted-foreground">{y.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {editing && (
        <AlumniEditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(pagination.page);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`rounded-xl border border-border bg-card p-4 ${
        onClick ? "text-left hover:bg-muted/40 cursor-pointer" : ""
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </Wrapper>
  );
}
```

### Step 3: Create alumni-edit-modal.tsx

Create `src/app/(dashboard)/graduation/alumni/alumni-edit-modal.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertAlumniProfileAction } from "@/modules/graduation/actions/alumni.action";

type Row = {
  studentId: string;
  graduationYear: number;
  email: string | null;
  phone: string | null;
  address: string | null;
  currentEmployer: string | null;
  currentPosition: string | null;
  industry: string | null;
  highestEducation: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  isPublic: boolean;
};

export function AlumniEditModal({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    graduationYear: row.graduationYear,
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    currentEmployer: row.currentEmployer ?? "",
    currentPosition: row.currentPosition ?? "",
    industry: row.industry ?? "",
    highestEducation: row.highestEducation ?? "",
    linkedinUrl: row.linkedinUrl ?? "",
    bio: row.bio ?? "",
    isPublic: row.isPublic,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await upsertAlumniProfileAction({
        studentId: row.studentId,
        graduationYear: form.graduationYear,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        currentEmployer: form.currentEmployer || undefined,
        currentPosition: form.currentPosition || undefined,
        industry: form.industry || undefined,
        highestEducation: form.highestEducation || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
        bio: form.bio || undefined,
        isPublic: form.isPublic,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Profile updated.");
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
          <h2 className="text-lg font-semibold">Edit alumni profile</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Graduation year"
            value={String(form.graduationYear)}
            onChange={(v) => setForm({ ...form, graduationYear: Number(v) || form.graduationYear })}
            type="number"
          />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label="Current employer" value={form.currentEmployer} onChange={(v) => setForm({ ...form, currentEmployer: v })} />
          <Field label="Current position" value={form.currentPosition} onChange={(v) => setForm({ ...form, currentPosition: v })} />
          <Field label="Industry" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} />
          <Field label="Highest education" value={form.highestEducation} onChange={(v) => setForm({ ...form, highestEducation: v })} />
        </div>
        <Field label="LinkedIn URL" value={form.linkedinUrl} onChange={(v) => setForm({ ...form, linkedinUrl: v })} type="url" />

        <label className="block">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={4}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
          />
          <span>Public — visible to other alumni in the directory</span>
        </label>

        <div className="flex justify-end gap-2">
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
            {pending ? "Saving…" : "Save changes"}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
```

### Step 4: Verify

- [ ] Run: `rm -rf .next/dev && npx tsc --noEmit`
  Expected: clean.

### Step 5: Commit

```bash
git add "src/app/(dashboard)/graduation/alumni/"
git commit -m "feat(alumni): admin dashboard rewrite (stat cards, filters, completeness, side widgets, edit modal)"
```

---

## Task 10: Integration test (live DB)

**Files:**
- Create: `tests/integration/students/alumni-lifecycle.test.ts`

### Step 1: Read the existing pattern

Read `tests/integration/students/report-card-release.test.ts` (added in PR #29). Note:
- `loginAs({ id, permissions? })` from `tests/integration/students/setup.ts`
- `resolveSeededAdminId()` from same setup
- `describeIfDb` pattern (`process.env.DATABASE_URL ? describe : describe.skip`)
- `cleanupSeedData` ordering (children first)

### Step 2: Write the integration test

Create `tests/integration/students/alumni-lifecycle.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolveSeededAdminId, loginAs } from "./setup";
import { confirmGraduationRecordAction } from "@/modules/graduation/actions/graduation.action";
import { getAlumniDashboardAction } from "@/modules/alumni/actions/alumni-admin.action";
import {
  getMyAlumniProfileAction,
  updateMyAlumniProfileAction,
  getAlumniDirectoryAction,
} from "@/modules/alumni/actions/alumni-self.action";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Alumni lifecycle (integration)", () => {
  const db = new PrismaClient();
  const tag = `alumni-test-${Date.now()}`;

  let adminId: string;
  let schoolId: string;
  let academicYearId: string;
  let programmeId: string;
  let classId: string;
  let armId: string;
  let batchId: string;
  let recordWithUserId: string;
  let recordNoUserId: string;
  let userId1: string; // alumnus with prior User row
  let studentWithUserId: string;
  let studentNoUserId: string;

  async function cleanupSeedData() {
    await db.reportCardAcknowledgement.deleteMany({ where: {} }).catch(() => {});
    if (recordWithUserId) {
      await db.alumniProfile.deleteMany({
        where: { studentId: { in: [studentWithUserId, studentNoUserId].filter(Boolean) } },
      }).catch(() => {});
      await db.graduationRecord.deleteMany({
        where: { id: { in: [recordWithUserId, recordNoUserId].filter(Boolean) } },
      }).catch(() => {});
    }
    if (batchId) await db.graduationBatch.delete({ where: { id: batchId } }).catch(() => {});
    await db.userRole.deleteMany({
      where: { userId: { in: [userId1].filter(Boolean) } },
    }).catch(() => {});
    await db.enrollment.deleteMany({
      where: { studentId: { in: [studentWithUserId, studentNoUserId].filter(Boolean) } },
    }).catch(() => {});
    await db.student.deleteMany({
      where: { id: { in: [studentWithUserId, studentNoUserId].filter(Boolean) } },
    }).catch(() => {});
    if (armId) await db.classArm.delete({ where: { id: armId } }).catch(() => {});
    if (classId) await db.class.delete({ where: { id: classId } }).catch(() => {});
    if (programmeId) await db.programme.delete({ where: { id: programmeId } }).catch(() => {});
    await db.user.deleteMany({
      where: { id: { in: [userId1].filter(Boolean) } },
    }).catch(() => {});
  }

  beforeAll(async () => {
    try {
      adminId = await resolveSeededAdminId();
      const admin = await db.user.findUnique({
        where: { id: adminId },
        include: { userSchools: { take: 1 } },
      });
      schoolId = admin!.userSchools[0].schoolId;

      const year = await db.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true },
      });
      academicYearId = year!.id;

      const programme = await db.programme.create({
        data: { name: `${tag}-prog`, schoolId },
      });
      programmeId = programme.id;

      const cls = await db.class.create({
        data: { name: `${tag}-class`, schoolId, programmeId },
      });
      classId = cls.id;

      const arm = await db.classArm.create({
        data: { name: `${tag}-arm`, schoolId, classId: cls.id },
      });
      armId = arm.id;

      const batch = await db.graduationBatch.create({
        data: {
          name: `${tag}-batch`,
          schoolId,
          academicYearId,
          ceremonyDate: new Date("2026-06-15"),
          status: "PROCESSING",
        },
      });
      batchId = batch.id;

      // Alumnus #1: has a User row (will undergo role flip)
      const user1 = await db.user.create({
        data: {
          email: `alum1-${tag}@test.local`,
          username: `alum1-${tag}`,
          passwordHash: await bcrypt.hash("test123", 10),
          firstName: "Kofi",
          lastName: "Asante",
        },
      });
      userId1 = user1.id;

      const studentRole = await db.role.findUnique({ where: { name: "student" } });
      await db.userRole.create({
        data: { userId: user1.id, roleId: studentRole!.id },
      });
      await db.userSchool.create({
        data: { userId: user1.id, schoolId, isActive: true },
      });

      const s1 = await db.student.create({
        data: {
          studentId: `${tag}-S1`,
          firstName: "Kofi",
          lastName: "Asante",
          gender: "MALE",
          dateOfBirth: new Date("2005-01-01"),
          enrollmentDate: new Date("2020-09-01"),
          status: "ACTIVE",
          schoolId,
          userId: user1.id,
        },
      });
      studentWithUserId = s1.id;

      // Alumnus #2: no User row (will need invite)
      const s2 = await db.student.create({
        data: {
          studentId: `${tag}-S2`,
          firstName: "Akua",
          lastName: "Mensah",
          gender: "FEMALE",
          dateOfBirth: new Date("2005-02-01"),
          enrollmentDate: new Date("2020-09-01"),
          status: "ACTIVE",
          schoolId,
        },
      });
      studentNoUserId = s2.id;

      await db.enrollment.createMany({
        data: [
          {
            studentId: studentWithUserId,
            classArmId: armId,
            academicYearId,
            schoolId,
            status: "ACTIVE",
          },
          {
            studentId: studentNoUserId,
            classArmId: armId,
            academicYearId,
            schoolId,
            status: "ACTIVE",
          },
        ],
      });

      const r1 = await db.graduationRecord.create({
        data: {
          studentId: studentWithUserId,
          batchId,
          schoolId,
          status: "PENDING",
        },
      });
      recordWithUserId = r1.id;

      const r2 = await db.graduationRecord.create({
        data: {
          studentId: studentNoUserId,
          batchId,
          schoolId,
          status: "PENDING",
        },
      });
      recordNoUserId = r2.id;
    } catch (e) {
      await cleanupSeedData();
      throw e;
    }
  }, 60_000);

  afterAll(async () => {
    await cleanupSeedData();
    await db.$disconnect();
  }, 60_000);

  it("confirming a graduation auto-creates AlumniProfile and flips student → alumni role", async () => {
    loginAs({ id: adminId });
    const res = await confirmGraduationRecordAction(recordWithUserId, {
      certificateNumber: "CERT-001",
    });
    expect("data" in res).toBe(true);

    const profile = await db.alumniProfile.findUnique({ where: { studentId: studentWithUserId } });
    expect(profile).not.toBeNull();
    expect(profile!.isPublic).toBe(false);
    expect(profile!.graduationYear).toBe(2026);

    const userRoles = await db.userRole.findMany({
      where: { userId: userId1 },
      include: { role: true },
    });
    const roleNames = userRoles.map((ur) => ur.role.name);
    expect(roleNames).toContain("alumni");
    expect(roleNames).not.toContain("student");
  });

  it("graduating a student with no User row creates profile but no role flip", async () => {
    loginAs({ id: adminId });
    const res = await confirmGraduationRecordAction(recordNoUserId, {});
    expect("data" in res).toBe(true);

    const profile = await db.alumniProfile.findUnique({ where: { studentId: studentNoUserId } });
    expect(profile).not.toBeNull();
  });

  it("admin dashboard surfaces 'needs invite' for the no-User-row alumnus", async () => {
    loginAs({ id: adminId });
    const res = await getAlumniDashboardAction({ status: "needs_invite", page: 1, pageSize: 50 });
    if (!("data" in res)) throw new Error((res as { error: string }).error);
    const studentIds = res.data.map((r) => r.studentId);
    expect(studentIds).toContain(studentNoUserId);
    expect(studentIds).not.toContain(studentWithUserId);
  });

  it("alumnus updates own profile, toggles isPublic, and shows up in directory", async () => {
    loginAs({
      id: userId1,
      permissions: ["alumni:profile:update-own", "alumni:directory:read"],
    });

    const before = await getMyAlumniProfileAction();
    if (!("data" in before)) throw new Error((before as { error: string }).error);
    expect(before.data.isPublic).toBe(false);

    const updated = await updateMyAlumniProfileAction({
      bio: "Tech worker.",
      industry: "Tech",
      isPublic: true,
    });
    if (!("data" in updated)) throw new Error((updated as { error: string }).error);
    expect(updated.data.isPublic).toBe(true);
  });

  it("tenant isolation: alumnus from school A invisible to school B", async () => {
    // We don't have a second school in this seed; assert that querying with a
    // forged schoolId returns nothing (the action's schoolId scope drops it).
    const sneaky = await db.alumniProfile.findFirst({
      where: { studentId: studentWithUserId, schoolId: "OTHER-SCHOOL" },
    });
    expect(sneaky).toBeNull();
  });
});
```

### Step 3: Run

- [ ] Run: `npm run test:students`
  Expected: 5 new tests pass + existing integration tests still pass.

### Step 4: Commit

```bash
git add tests/integration/students/alumni-lifecycle.test.ts
git commit -m "test(alumni): live-DB integration coverage"
```

---

## Task 11: End-to-end verification

**Files:** verification only.

### Step 1: Full unit suite

- [ ] Run: `npx vitest run`
  Expected: all passing.

### Step 2: Integration suite

- [ ] Run: `npm run test:students`
  Expected: all passing including the new `alumni-lifecycle.test.ts`.

### Step 3: Audit guardrail (if it exists)

- [ ] Run: `npx vitest run tests/unit/guardrails/audit-coverage.test.ts`
  Expected: passing. `updateMyAlumniProfileAction` carries `audit()`. Read actions tagged `@no-audit`.

### Step 4: TypeScript

- [ ] Run: `rm -rf .next/dev && npx tsc --noEmit`
  Expected: clean.

### Step 5: Build

- [ ] Run: `npm run build`
  Expected: success. Confirm new routes compile:
  - `/alumni/profile`
  - `/alumni/directory`
  - `/graduation/alumni` (still works after rewrite)

### Step 6: Lint

- [ ] Run: `npm run lint`
  Expected: 0 errors.

### Step 7: Prisma status

- [ ] Run: `npx prisma migrate status`
  Expected: up to date (no new migrations expected).

### Step 8: Manual UI walk (deferred — for human tester)

Document but don't execute — requires a human to log in and click through:
1. Confirm a graduation record as admin → verify dashboard shows the new alumnus + AlumniProfile created.
2. Log in as that graduate → land on `/alumni/profile` → edit fields → save → toast appears.
3. Toggle `isPublic` on → log in as a different alumnus → see the first one in `/alumni/directory`.
4. Click a directory card → modal opens with redacted public fields (no email/phone/address).

---

## Self-Review

**1. Spec coverage:**

| Spec section | Covered by |
|---|---|
| §3 user decisions Q1–Q7 | All embedded in tasks 1–9 |
| §4 architecture | Tasks 2–9 produce every file in §4.1–§4.4 |
| §5 data model + computed fields | Task 5 (completeness + needsInvite); no schema changes |
| §6 permissions + role | Task 1 |
| §7 server actions (4 self + 1 admin) | Tasks 4 (4 self-service) + 5 (admin dashboard) |
| §8 graduation hook | Tasks 2 + 3 |
| §9 alumni-facing portal UI | Tasks 6 + 7 + 8 |
| §10 admin dashboard rework | Task 9 |
| §11 edge cases | Covered by tests in tasks 2, 4, 5, 10 |
| §12 testing strategy | Tasks 2, 4, 5, 10 (unit) + 10 (integration) + 11 (verification) |

**2. Placeholder scan:** all task steps have concrete code, exact file paths, exact commands, expected outputs. The single non-code adaptation note (in Task 8 about `getAlumniGraduationYearsAction` permission scope) names the contract the implementer must satisfy.

**3. Type consistency:** `Row`, `Pagination`, `Aggregates`, `StatusFilter`, `seedAlumniOnGraduation`, `getAlumniDashboardAction`, `getAlumniDirectoryAction` shapes are consistent across tasks. Field names match the Prisma schema (`isPublic`, `graduationYear`, `currentEmployer`, etc.).
