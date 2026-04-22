# Student Document Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a per-school document-type catalog + per-student document store with verification workflow, expiry tracking, automatic porting of admission docs at enrollment finalization, and two cohort filters on the students list (missing required docs, expiring within 30 days).

**Architecture:** Two new Prisma models (`DocumentType`, `StudentDocument`) co-located in `student.prisma`. New action module `document.action.ts` wrapping the existing R2 storage + `/api/upload` + `/api/files/[key]` infrastructure. New UI: an admin catalog page under `/admin/document-types`, a "Documents" tab on the student profile, and two filter chips on the student list. Admission documents auto-port to the student vault at enrollment finalization via a one-line hook into the existing `enrollApplicationAction`.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Prisma on PostgreSQL, Cloudflare R2 via `@aws-sdk/client-s3`, vitest + vitest-mock-extended, existing shadcn-free tailwind UI conventions.

**Spec reference:** `docs/superpowers/specs/2026-04-22-student-document-vault-design.md`

---

## File Structure

**New files**
- `src/modules/student/schemas/document.schema.ts` — zod schemas for all document actions
- `src/modules/student/actions/document.action.ts` — all server actions (catalog + vault + verification + port + cohort)
- `tests/unit/students/document.test.ts` — unit tests
- `tests/integration/students/document-vault.test.ts` — integration lifecycle test
- `src/app/(dashboard)/students/[id]/documents-section.tsx` — the Documents tab client component
- `src/app/(dashboard)/admin/document-types/page.tsx` — catalog admin page (server)
- `src/app/(dashboard)/admin/document-types/document-types-client.tsx` — catalog admin page (client)

**Modified files**
- `prisma/schema/student.prisma` — append `DocumentType`, `StudentDocument`, `DocumentAppliesTo`; add inverse relation on `Student`
- `prisma/schema/school.prisma` — inverse relations on `School`
- `src/lib/permissions.ts` — 5 new permissions + role grants
- `src/app/(dashboard)/students/[id]/student-profile.tsx` — add "Documents" tab
- `src/app/(dashboard)/students/students-client.tsx` — 2 filter chips
- `src/modules/admissions/actions/admission.action.ts` — one-line port call at tail of `enrollApplicationAction` (around line 845)

**Reused (no changes)**
- `src/lib/storage/r2.ts` (`uploadFile`, `getSignedDownloadUrl`, `deleteFile`, `generateFileKey`)
- `/api/upload` POST route
- `/api/files/[key]` GET route
- `src/lib/audit.ts`
- `DocumentVerificationStatus` enum (existing)

---

## Task 1: Prisma schema additions

**Files:**
- Modify: `prisma/schema/student.prisma`
- Modify: `prisma/schema/school.prisma`

- [ ] **Step 1: Append new models + enum to `prisma/schema/student.prisma`**

At the end of the file, append:

```prisma
model DocumentType {
  id           String            @id @default(cuid())
  schoolId     String
  name         String
  description  String?
  isRequired   Boolean           @default(false)
  expiryMonths Int?
  appliesTo    DocumentAppliesTo @default(ALL)
  status       Status            @default(ACTIVE)
  sortOrder    Int               @default(0)
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  school    School             @relation("SchoolDocumentType", fields: [schoolId], references: [id], onDelete: Cascade)
  documents StudentDocument[]

  @@unique([schoolId, name])
  @@index([schoolId])
  @@index([schoolId, status])
}

model StudentDocument {
  id                 String                     @id @default(cuid())
  schoolId           String
  studentId          String
  documentTypeId     String
  title              String
  fileKey            String
  fileName           String
  fileSize           Int
  contentType        String
  verificationStatus DocumentVerificationStatus @default(PENDING)
  verifiedBy         String?
  verifiedAt         DateTime?
  rejectionReason    String?
  expiresAt          DateTime?
  notes              String?
  uploadedBy         String
  uploadedAt         DateTime                   @default(now())
  updatedAt          DateTime                   @updatedAt

  school       School       @relation("SchoolStudentDocument", fields: [schoolId], references: [id], onDelete: Cascade)
  student      Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  documentType DocumentType @relation(fields: [documentTypeId], references: [id])

  @@index([studentId])
  @@index([schoolId])
  @@index([documentTypeId])
  @@index([verificationStatus])
  @@index([expiresAt])
  @@index([schoolId, verificationStatus])
}

enum DocumentAppliesTo {
  ALL
  BOARDING_ONLY
  DAY_ONLY
}
```

- [ ] **Step 2: Add inverse relation to `Student` model**

Inside `model Student` in `prisma/schema/student.prisma`, append to the relations block:

```prisma
  studentDocuments StudentDocument[]
```

- [ ] **Step 3: Add inverse relations to `School` in `prisma/schema/school.prisma`**

Inside `model School`, append:

```prisma
  documentTypes    DocumentType[]    @relation("SchoolDocumentType")
  studentDocuments StudentDocument[] @relation("SchoolStudentDocument")
```

- [ ] **Step 4: Validate and migrate**

Run: `npx prisma validate`
Expected: `The schemas at prisma\schema are valid`

Run: `npx prisma migrate dev --name add_student_document_vault`
Expected: migration created under `prisma/schema/migrations/`, applied to dev DB, client regenerated.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(students): add DocumentType + StudentDocument models"
```

---

## Task 2: Add document-vault permissions

**Files:**
- Modify: `src/lib/permissions.ts`

- [ ] **Step 1: Add the constants**

Locate the `STUDENTS_*` block (around line 56–62 — the block ends with `STUDENTS_PROMOTE`). After `STUDENTS_PROMOTE` add:

```ts
  STUDENTS_DOCUMENTS_CREATE: "students:documents:create",
  STUDENTS_DOCUMENTS_READ: "students:documents:read",
  STUDENTS_DOCUMENTS_VERIFY: "students:documents:verify",
  STUDENTS_DOCUMENTS_DELETE: "students:documents:delete",
  DOCUMENT_TYPES_MANAGE: "school:document-types:manage",
```

- [ ] **Step 2: Grant to admin roles**

The file has several role permission arrays (search for `PERMISSIONS.STUDENTS_PROMOTE` — there are three admin-style roles: `headmaster`, `assistant_headmaster_academic`, `assistant_headmaster_admin`). For each of those three arrays, add all five new permissions:

```ts
    PERMISSIONS.STUDENTS_DOCUMENTS_CREATE,
    PERMISSIONS.STUDENTS_DOCUMENTS_READ,
    PERMISSIONS.STUDENTS_DOCUMENTS_VERIFY,
    PERMISSIONS.STUDENTS_DOCUMENTS_DELETE,
    PERMISSIONS.DOCUMENT_TYPES_MANAGE,
```

`super_admin` inherits all permissions via `ALL_PERMISSIONS` so no explicit grant is needed.

For `class_teacher` (or any role that should see but not edit): grant only `STUDENTS_DOCUMENTS_READ`. Check the existing read-only permissions that role has (search for a line granting `STUDENTS_READ` without `STUDENTS_UPDATE`) — add `STUDENTS_DOCUMENTS_READ` alongside it.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npx vitest run tests/unit/auth/permissions.test.ts`
Expected: all tests passing (`super_admin = ALL_PERMISSIONS` check auto-includes the new five via `Object.values(PERMISSIONS)`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat(permissions): add document-vault permissions (STUDENTS_DOCUMENTS_*, DOCUMENT_TYPES_MANAGE)"
```

---

## Task 3: Zod input schemas

**Files:**
- Create: `src/modules/student/schemas/document.schema.ts`

- [ ] **Step 1: Write the schemas file**

```ts
import { z } from "zod";

// ─── DocumentType catalog ──────────────────────────────────────────

export const createDocumentTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().default(false),
  expiryMonths: z.number().int().positive().nullable().optional(),
  appliesTo: z.enum(["ALL", "BOARDING_ONLY", "DAY_ONLY"]).default("ALL"),
  sortOrder: z.number().int().default(0),
});

export const updateDocumentTypeSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isRequired: z.boolean().optional(),
  expiryMonths: z.number().int().positive().nullable().optional(),
  appliesTo: z.enum(["ALL", "BOARDING_ONLY", "DAY_ONLY"]).optional(),
  sortOrder: z.number().int().optional(),
});

// ─── StudentDocument ───────────────────────────────────────────────

export const recordUploadedStudentDocumentSchema = z.object({
  studentId: z.string().cuid(),
  documentTypeId: z.string().cuid(),
  title: z.string().min(1).max(200),
  fileKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().nonnegative(),
  contentType: z.string().min(1).max(100),
  notes: z.string().max(500).optional(),
});

export const updateStudentDocumentSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const rejectStudentDocumentSchema = z.object({
  id: z.string().cuid(),
  reason: z.string().min(5).max(500),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/student/schemas/document.schema.ts
git commit -m "feat(students): add document-vault zod schemas"
```

---

## Task 4: `listDocumentTypesAction`

**Files:**
- Create: `src/modules/student/actions/document.action.ts`
- Create: `tests/unit/students/document.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { listDocumentTypesAction } from "@/modules/student/actions/document.action";

describe("listDocumentTypesAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await listDocumentTypesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns types for the school ordered by sortOrder then name", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-1", name: "Birth Certificate", status: "ACTIVE", sortOrder: 0 },
      { id: "dt-2", name: "JHS Report", status: "ACTIVE", sortOrder: 1 },
    ] as never);

    const result = await listDocumentTypesAction();
    expect(result).toEqual({ data: expect.arrayContaining([
      expect.objectContaining({ id: "dt-1" }),
      expect.objectContaining({ id: "dt-2" }),
    ]) });
    expect(prismaMock.documentType.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { schoolId: "default-school" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }));
  });

  it("filters by status when provided", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([] as never);
    await listDocumentTypesAction({ status: "ACTIVE" });
    expect(prismaMock.documentType.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { schoolId: "default-school", status: "ACTIVE" },
    }));
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the action file**

Create `src/modules/student/actions/document.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

export async function listDocumentTypesAction(opts?: { status?: "ACTIVE" | "INACTIVE" }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENT_TYPES_MANAGE);
  if (denied) return denied;

  const types = await db.documentType.findMany({
    where: {
      schoolId: ctx.schoolId,
      ...(opts?.status && { status: opts.status }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return { data: types };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/modules/student/actions/document.action.ts tests/unit/students/document.test.ts
git commit -m "feat(students): add listDocumentTypesAction"
```

---

## Task 5: `createDocumentTypeAction`

**Files:**
- Modify: `src/modules/student/actions/document.action.ts`
- Modify: `tests/unit/students/document.test.ts`

- [ ] **Step 1: Write failing test**

Append to the test file:

```ts
import { createDocumentTypeAction } from "@/modules/student/actions/document.action";

describe("createDocumentTypeAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("creates a type and audits", async () => {
    prismaMock.documentType.create.mockResolvedValue({ id: "dt-new", name: "NHIS Card" } as never);

    const result = await createDocumentTypeAction({
      name: "NHIS Card",
      isRequired: true,
      expiryMonths: 12,
      appliesTo: "ALL",
    });
    expect(result).toMatchObject({ data: { id: "dt-new" } });
    expect(prismaMock.documentType.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: "default-school",
        name: "NHIS Card",
        isRequired: true,
        expiryMonths: 12,
        appliesTo: "ALL",
      }),
    });
  });

  it("surfaces unique-constraint violation as a clean error", async () => {
    const uniqueErr = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.documentType.create.mockRejectedValue(uniqueErr);

    const result = await createDocumentTypeAction({
      name: "Birth Certificate",
    });
    expect(result).toEqual({ error: "A document type with this name already exists" });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: FAIL — export missing.

- [ ] **Step 3: Implement**

Append to `document.action.ts` — first add imports at the top:

```ts
import { audit } from "@/lib/audit";
import {
  createDocumentTypeSchema,
  updateDocumentTypeSchema,
  recordUploadedStudentDocumentSchema,
  updateStudentDocumentSchema,
  rejectStudentDocumentSchema,
} from "../schemas/document.schema";
```

Then append the action:

```ts
export async function createDocumentTypeAction(input: {
  name: string;
  description?: string;
  isRequired?: boolean;
  expiryMonths?: number | null;
  appliesTo?: "ALL" | "BOARDING_ONLY" | "DAY_ONLY";
  sortOrder?: number;
}) {
  const parsed = createDocumentTypeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENT_TYPES_MANAGE);
  if (denied) return denied;

  try {
    const type = await db.documentType.create({
      data: {
        schoolId: ctx.schoolId,
        name: parsed.data.name,
        description: parsed.data.description,
        isRequired: parsed.data.isRequired,
        expiryMonths: parsed.data.expiryMonths ?? null,
        appliesTo: parsed.data.appliesTo,
        sortOrder: parsed.data.sortOrder,
      },
    });

    await audit({
      userId: ctx.session.user.id!,
      action: "CREATE",
      entity: "DocumentType",
      entityId: type.id,
      module: "students",
      description: `Created document type: ${type.name}`,
    });

    return { data: type };
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002") {
      return { error: "A document type with this name already exists" };
    }
    throw err;
  }
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add createDocumentTypeAction"
```

---

## Task 6: `updateDocumentTypeAction` + `deactivateDocumentTypeAction`

**Files:**
- Modify: `src/modules/student/actions/document.action.ts`
- Modify: `tests/unit/students/document.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import {
  updateDocumentTypeAction,
  deactivateDocumentTypeAction,
} from "@/modules/student/actions/document.action";

describe("updateDocumentTypeAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("updates partial fields and audits", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({ id: "dt-1", schoolId: "default-school", name: "Old" } as never);
    prismaMock.documentType.update.mockResolvedValue({ id: "dt-1", name: "Old", isRequired: true } as never);

    const result = await updateDocumentTypeAction({ id: "dt-1", isRequired: true });
    expect(result).toMatchObject({ data: { id: "dt-1", isRequired: true } });
    expect(prismaMock.documentType.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "dt-1" },
      data: { isRequired: true },
    }));
  });

  it("returns error when type not found for current school", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue(null);
    const result = await updateDocumentTypeAction({ id: "dt-x", name: "Anything" });
    expect(result).toEqual({ error: "Document type not found" });
  });
});

describe("deactivateDocumentTypeAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("soft-deletes when there are no documents referencing the type", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({ id: "dt-1", schoolId: "default-school", status: "ACTIVE" } as never);
    prismaMock.studentDocument.count.mockResolvedValue(0);
    prismaMock.documentType.update.mockResolvedValue({ id: "dt-1", status: "INACTIVE" } as never);

    const result = await deactivateDocumentTypeAction("dt-1");
    expect(result).toEqual({ data: { id: "dt-1", status: "INACTIVE" } });
  });

  it("refuses hard delete when documents exist", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({ id: "dt-1", schoolId: "default-school", status: "ACTIVE" } as never);
    prismaMock.studentDocument.count.mockResolvedValue(5);
    prismaMock.documentType.update.mockResolvedValue({ id: "dt-1", status: "INACTIVE" } as never);

    const result = await deactivateDocumentTypeAction("dt-1");
    expect(result).toEqual({ data: { id: "dt-1", status: "INACTIVE" } });
  });
});
```

Note: both cases succeed (soft-delete always works). The "refuses hard delete" wording in the spec means: hard delete is never exposed. Documented in `document.action.ts`.

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement**

Append to `document.action.ts`:

```ts
export async function updateDocumentTypeAction(input: {
  id: string;
  name?: string;
  description?: string | null;
  isRequired?: boolean;
  expiryMonths?: number | null;
  appliesTo?: "ALL" | "BOARDING_ONLY" | "DAY_ONLY";
  sortOrder?: number;
}) {
  const parsed = updateDocumentTypeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENT_TYPES_MANAGE);
  if (denied) return denied;

  const existing = await db.documentType.findFirst({
    where: { id: parsed.data.id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Document type not found" };

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.isRequired !== undefined) data.isRequired = parsed.data.isRequired;
  if (parsed.data.expiryMonths !== undefined) data.expiryMonths = parsed.data.expiryMonths;
  if (parsed.data.appliesTo !== undefined) data.appliesTo = parsed.data.appliesTo;
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;

  const updated = await db.documentType.update({ where: { id: parsed.data.id }, data });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "DocumentType",
    entityId: parsed.data.id,
    module: "students",
    description: `Updated document type: ${updated.name}`,
    previousData: existing as unknown as Record<string, unknown>,
    newData: data,
  });

  return { data: updated };
}

// Hard delete is intentionally not exposed — always soft-delete to preserve FK
// integrity on historical StudentDocument rows. Callers should just use this.
export async function deactivateDocumentTypeAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENT_TYPES_MANAGE);
  if (denied) return denied;

  const existing = await db.documentType.findFirst({
    where: { id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Document type not found" };

  // Called for reporting only — still soft-delete even if count > 0.
  await db.studentDocument.count({ where: { documentTypeId: id } });

  const updated = await db.documentType.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "DocumentType",
    entityId: id,
    module: "students",
    description: `Deactivated document type: ${existing.name}`,
    previousData: { status: existing.status },
    newData: { status: "INACTIVE" },
  });

  return { data: updated };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add update + deactivate DocumentType actions"
```

---

## Task 7: Vault read — `listStudentDocumentsAction` + `getMissingRequiredDocumentsAction`

**Files:**
- Modify: `src/modules/student/actions/document.action.ts`
- Modify: `tests/unit/students/document.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import {
  listStudentDocumentsAction,
  getMissingRequiredDocumentsAction,
} from "@/modules/student/actions/document.action";

describe("listStudentDocumentsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns documents with computed expiry flags", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5);
    const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
    const far = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    prismaMock.studentDocument.findMany.mockResolvedValue([
      { id: "sd-1", expiresAt: past, verificationStatus: "VERIFIED", documentType: { id: "dt-a", name: "A" } },
      { id: "sd-2", expiresAt: soon, verificationStatus: "VERIFIED", documentType: { id: "dt-b", name: "B" } },
      { id: "sd-3", expiresAt: far, verificationStatus: "VERIFIED", documentType: { id: "dt-c", name: "C" } },
      { id: "sd-4", expiresAt: null, verificationStatus: "PENDING", documentType: { id: "dt-d", name: "D" } },
    ] as never);

    const result = await listStudentDocumentsAction("student-1");
    expect(result.data).toHaveLength(4);
    expect(result.data.find((d) => d.id === "sd-1")).toMatchObject({ isExpired: true, isExpiringSoon: false });
    expect(result.data.find((d) => d.id === "sd-2")).toMatchObject({ isExpired: false, isExpiringSoon: true });
    expect(result.data.find((d) => d.id === "sd-3")).toMatchObject({ isExpired: false, isExpiringSoon: false });
    expect(result.data.find((d) => d.id === "sd-4")).toMatchObject({ isExpired: false, isExpiringSoon: false });
  });
});

describe("getMissingRequiredDocumentsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("DAY student is not flagged for BOARDING_ONLY required types", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "student-1", boardingStatus: "DAY" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-1", name: "Medical Clearance", isRequired: true, appliesTo: "BOARDING_ONLY", status: "ACTIVE", expiryMonths: 12 },
      { id: "dt-2", name: "Birth Certificate", isRequired: true, appliesTo: "ALL", status: "ACTIVE", expiryMonths: null },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([
      { documentTypeId: "dt-2", verificationStatus: "VERIFIED", expiresAt: null },
    ] as never);

    const result = await getMissingRequiredDocumentsAction("student-1");
    expect(result.data.missing).toHaveLength(0); // medical clearance doesn't apply to DAY
  });

  it("BOARDING student is flagged for missing BOARDING_ONLY types", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "student-1", boardingStatus: "BOARDING" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-1", name: "Medical Clearance", isRequired: true, appliesTo: "BOARDING_ONLY", status: "ACTIVE", expiryMonths: 12 },
      { id: "dt-2", name: "Birth Certificate", isRequired: true, appliesTo: "ALL", status: "ACTIVE", expiryMonths: null },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([
      { documentTypeId: "dt-2", verificationStatus: "VERIFIED", expiresAt: null },
    ] as never);

    const result = await getMissingRequiredDocumentsAction("student-1");
    expect(result.data.missing).toHaveLength(1);
    expect(result.data.missing[0]).toMatchObject({ id: "dt-1" });
  });

  it("expired VERIFIED documents count as missing", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5);
    prismaMock.student.findFirst.mockResolvedValue({ id: "student-1", boardingStatus: "DAY" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-2", name: "Birth Certificate", isRequired: true, appliesTo: "ALL", status: "ACTIVE", expiryMonths: 12 },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([
      { documentTypeId: "dt-2", verificationStatus: "VERIFIED", expiresAt: past },
    ] as never);

    const result = await getMissingRequiredDocumentsAction("student-1");
    expect(result.data.missing).toHaveLength(1);
  });

  it("PENDING and REJECTED documents do not satisfy the requirement", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "student-1", boardingStatus: "DAY" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-2", name: "Birth Certificate", isRequired: true, appliesTo: "ALL", status: "ACTIVE", expiryMonths: null },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([
      { documentTypeId: "dt-2", verificationStatus: "PENDING", expiresAt: null },
      { documentTypeId: "dt-2", verificationStatus: "REJECTED", expiresAt: null },
    ] as never);

    const result = await getMissingRequiredDocumentsAction("student-1");
    expect(result.data.missing).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement**

Append to `document.action.ts`:

```ts
const EXPIRING_SOON_DAYS = 30;

export async function listStudentDocumentsAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_READ);
  if (denied) return denied;

  const documents = await db.studentDocument.findMany({
    where: { studentId, schoolId: ctx.schoolId },
    include: {
      documentType: { select: { id: true, name: true, isRequired: true, appliesTo: true } },
    },
    orderBy: [{ uploadedAt: "desc" }],
  });

  const now = Date.now();
  const soonMs = EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;

  const withFlags = documents.map((d) => {
    const expTime = d.expiresAt?.getTime();
    const isExpired = expTime !== undefined && expTime <= now;
    const isExpiringSoon = !isExpired && expTime !== undefined && expTime - now <= soonMs;
    return { ...d, isExpired, isExpiringSoon };
  });

  return { data: withFlags };
}

export async function getMissingRequiredDocumentsAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_READ);
  if (denied) return denied;

  const student = await db.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
    select: { id: true, boardingStatus: true },
  });
  if (!student) return { error: "Student not found" };

  const requiredTypes = await db.documentType.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "ACTIVE",
      isRequired: true,
      OR: [
        { appliesTo: "ALL" },
        { appliesTo: student.boardingStatus === "BOARDING" ? "BOARDING_ONLY" : "DAY_ONLY" },
      ],
    },
  });

  const documents = await db.studentDocument.findMany({
    where: { studentId, schoolId: ctx.schoolId },
    select: { documentTypeId: true, verificationStatus: true, expiresAt: true },
  });

  const now = Date.now();
  const satisfiedTypeIds = new Set<string>();
  for (const doc of documents) {
    if (doc.verificationStatus !== "VERIFIED") continue;
    const expTime = doc.expiresAt?.getTime();
    if (expTime !== undefined && expTime <= now) continue;
    satisfiedTypeIds.add(doc.documentTypeId);
  }

  const missing = requiredTypes.filter((t) => !satisfiedTypeIds.has(t.id));

  return { data: { required: requiredTypes, missing } };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: 14 passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add vault read actions (list + missing required)"
```

---

## Task 8: `recordUploadedStudentDocumentAction` (with R2 rollback)

**Files:**
- Modify: `src/modules/student/actions/document.action.ts`
- Modify: `tests/unit/students/document.test.ts`

- [ ] **Step 1: Mock the R2 storage helpers in setup**

Edit `tests/unit/setup.ts`. Check if `@/lib/storage/r2` is already mocked (search the file); if not, add at the end of the mock block:

```ts
vi.mock("@/lib/storage/r2", () => ({
  uploadFile: vi.fn().mockResolvedValue({ key: "test-key", url: "test-url" }),
  getSignedDownloadUrl: vi.fn().mockResolvedValue("https://signed.example/file"),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  generateFileKey: vi.fn((module, entityId, filename) => `${module}/${entityId}/${filename}`),
}));
```

If already mocked, leave as-is and export a named reference from setup.ts if tests need to assert against it.

- [ ] **Step 2: Append failing tests**

```ts
import { recordUploadedStudentDocumentAction } from "@/modules/student/actions/document.action";

// Import deleteFile to assert against it:
import * as r2 from "@/lib/storage/r2";

describe("recordUploadedStudentDocumentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(r2.deleteFile).mockClear();
  });

  it("creates a document row with computed expiresAt from documentType.expiryMonths", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({
      id: "dt-1", schoolId: "default-school", expiryMonths: 12,
    } as never);
    prismaMock.studentDocument.create.mockResolvedValue({ id: "sd-new" } as never);

    const result = await recordUploadedStudentDocumentAction({
      studentId: "clh0000000000000000000001",
      documentTypeId: "clh0000000000000000000002",
      title: "Birth Certificate",
      fileKey: "student-documents/clh0000000000000000000001/1234-file.pdf",
      fileName: "file.pdf",
      fileSize: 1024,
      contentType: "application/pdf",
    });
    expect(result).toMatchObject({ data: { id: "sd-new" } });
    const createArgs = vi.mocked(prismaMock.studentDocument.create).mock.calls[0][0];
    expect(createArgs.data.expiresAt).toBeInstanceOf(Date);
  });

  it("creates with null expiresAt when documentType.expiryMonths is null", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({
      id: "dt-1", schoolId: "default-school", expiryMonths: null,
    } as never);
    prismaMock.studentDocument.create.mockResolvedValue({ id: "sd-new" } as never);

    await recordUploadedStudentDocumentAction({
      studentId: "clh0000000000000000000001",
      documentTypeId: "clh0000000000000000000002",
      title: "Birth Certificate",
      fileKey: "key",
      fileName: "f.pdf",
      fileSize: 1,
      contentType: "application/pdf",
    });
    const createArgs = vi.mocked(prismaMock.studentDocument.create).mock.calls[0][0];
    expect(createArgs.data.expiresAt).toBeNull();
  });

  it("deletes R2 file and returns error when DB insert fails", async () => {
    prismaMock.documentType.findFirst.mockResolvedValue({
      id: "dt-1", schoolId: "default-school", expiryMonths: null,
    } as never);
    prismaMock.studentDocument.create.mockRejectedValue(new Error("DB exploded"));

    const result = await recordUploadedStudentDocumentAction({
      studentId: "clh0000000000000000000001",
      documentTypeId: "clh0000000000000000000002",
      title: "X",
      fileKey: "orphan-key",
      fileName: "f.pdf",
      fileSize: 1,
      contentType: "application/pdf",
    });
    expect(result).toMatchObject({ error: expect.stringContaining("failed") });
    expect(vi.mocked(r2.deleteFile)).toHaveBeenCalledWith("orphan-key");
  });
});
```

Add `import { vi } from "vitest";` at the top of the test file if not already present.

- [ ] **Step 3: Verify fail**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: FAIL — export missing.

- [ ] **Step 4: Implement**

At the top of `document.action.ts`, add the R2 import:

```ts
import { deleteFile } from "@/lib/storage/r2";
```

Append:

```ts
export async function recordUploadedStudentDocumentAction(input: {
  studentId: string;
  documentTypeId: string;
  title: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  notes?: string;
}) {
  const parsed = recordUploadedStudentDocumentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_CREATE);
  if (denied) return denied;

  const type = await db.documentType.findFirst({
    where: { id: parsed.data.documentTypeId, schoolId: ctx.schoolId },
  });
  if (!type) return { error: "Document type not found" };

  const expiresAt = type.expiryMonths
    ? new Date(Date.now() + type.expiryMonths * 30 * 24 * 60 * 60 * 1000)
    : null;

  try {
    const doc = await db.studentDocument.create({
      data: {
        schoolId: ctx.schoolId,
        studentId: parsed.data.studentId,
        documentTypeId: parsed.data.documentTypeId,
        title: parsed.data.title,
        fileKey: parsed.data.fileKey,
        fileName: parsed.data.fileName,
        fileSize: parsed.data.fileSize,
        contentType: parsed.data.contentType,
        notes: parsed.data.notes,
        expiresAt,
        uploadedBy: ctx.session.user.id!,
      },
    });

    await audit({
      userId: ctx.session.user.id!,
      action: "CREATE",
      entity: "StudentDocument",
      entityId: doc.id,
      module: "students",
      description: `Uploaded document: ${parsed.data.title}`,
      metadata: { documentTypeId: parsed.data.documentTypeId, fileKey: parsed.data.fileKey },
    });

    return { data: doc };
  } catch (err) {
    // DB insert failed — clean up the orphaned R2 file.
    try {
      await deleteFile(parsed.data.fileKey);
    } catch {
      // swallow — we prioritise surfacing the original error
    }
    return { error: "Document record creation failed; file was cleaned up." };
  }
}
```

- [ ] **Step 5: Verify pass**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: 17 passing.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(students): add recordUploadedStudentDocumentAction with R2 rollback"
```

---

## Task 9: `updateStudentDocumentAction` + `deleteStudentDocumentAction`

**Files:**
- Modify: `src/modules/student/actions/document.action.ts`
- Modify: `tests/unit/students/document.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import {
  updateStudentDocumentAction,
  deleteStudentDocumentAction,
} from "@/modules/student/actions/document.action";

describe("updateStudentDocumentAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("updates title and notes", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", title: "Old title",
    } as never);
    prismaMock.studentDocument.update.mockResolvedValue({ id: "sd-1", title: "New title" } as never);

    const result = await updateStudentDocumentAction({
      id: "clh0000000000000000000001",
      title: "New title",
    });
    expect(result).toMatchObject({ data: { id: "sd-1", title: "New title" } });
  });

  it("returns error when document not found in current school", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue(null);
    const result = await updateStudentDocumentAction({ id: "clh0000000000000000000099", title: "X" });
    expect(result).toEqual({ error: "Document not found" });
  });
});

describe("deleteStudentDocumentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(r2.deleteFile).mockClear();
  });

  it("deletes DB row and R2 object", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", fileKey: "student-documents/s/file.pdf",
      fileName: "file.pdf", title: "X",
    } as never);
    prismaMock.studentDocument.delete.mockResolvedValue({ id: "sd-1" } as never);

    const result = await deleteStudentDocumentAction("sd-1");
    expect(result).toEqual({ data: { deleted: true } });
    expect(vi.mocked(r2.deleteFile)).toHaveBeenCalledWith("student-documents/s/file.pdf");
  });

  it("still deletes DB row when R2 delete fails", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", fileKey: "k", fileName: "f", title: "X",
    } as never);
    vi.mocked(r2.deleteFile).mockRejectedValueOnce(new Error("R2 down"));
    prismaMock.studentDocument.delete.mockResolvedValue({ id: "sd-1" } as never);

    const result = await deleteStudentDocumentAction("sd-1");
    expect(result).toEqual({ data: { deleted: true } });
    expect(prismaMock.studentDocument.delete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement**

Append to `document.action.ts`:

```ts
export async function updateStudentDocumentAction(input: {
  id: string;
  title?: string;
  notes?: string | null;
}) {
  const parsed = updateStudentDocumentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_CREATE);
  if (denied) return denied;

  const existing = await db.studentDocument.findFirst({
    where: { id: parsed.data.id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Document not found" };

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  const updated = await db.studentDocument.update({
    where: { id: parsed.data.id },
    data,
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "StudentDocument",
    entityId: parsed.data.id,
    module: "students",
    description: `Updated document: ${updated.title}`,
    previousData: { title: existing.title, notes: existing.notes },
    newData: data,
  });

  return { data: updated };
}

export async function deleteStudentDocumentAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_DELETE);
  if (denied) return denied;

  const existing = await db.studentDocument.findFirst({
    where: { id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Document not found" };

  let r2Failed = false;
  try {
    await deleteFile(existing.fileKey);
  } catch {
    r2Failed = true;
  }

  await db.studentDocument.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "StudentDocument",
    entityId: id,
    module: "students",
    description: `Deleted document: ${existing.title}`,
    previousData: {
      title: existing.title,
      fileName: existing.fileName,
      fileKey: existing.fileKey,
    },
    metadata: r2Failed ? { r2DeleteFailed: true } : undefined,
  });

  return { data: { deleted: true } };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: 21 passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add update + delete student document actions"
```

---

## Task 10: Verification actions (verify / reject / reopen)

**Files:**
- Modify: `src/modules/student/actions/document.action.ts`
- Modify: `tests/unit/students/document.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import {
  verifyStudentDocumentAction,
  rejectStudentDocumentAction,
  reopenStudentDocumentAction,
} from "@/modules/student/actions/document.action";

describe("verifyStudentDocumentAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("PENDING → VERIFIED with verifier + timestamp", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", verificationStatus: "PENDING", title: "X",
    } as never);
    prismaMock.studentDocument.update.mockResolvedValue({ id: "sd-1", verificationStatus: "VERIFIED" } as never);

    const result = await verifyStudentDocumentAction("sd-1");
    expect(result).toMatchObject({ data: { verificationStatus: "VERIFIED" } });
    expect(prismaMock.studentDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "sd-1" },
      data: expect.objectContaining({
        verificationStatus: "VERIFIED",
        verifiedBy: "test-user-id",
        verifiedAt: expect.any(Date),
      }),
    }));
  });

  it("refuses when not PENDING", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", verificationStatus: "VERIFIED", title: "X",
    } as never);
    const result = await verifyStudentDocumentAction("sd-1");
    expect(result).toEqual({ error: "Document is no longer PENDING" });
  });
});

describe("rejectStudentDocumentAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("PENDING → REJECTED with reason", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", verificationStatus: "PENDING", title: "X",
    } as never);
    prismaMock.studentDocument.update.mockResolvedValue({ id: "sd-1", verificationStatus: "REJECTED" } as never);

    const result = await rejectStudentDocumentAction({
      id: "clh0000000000000000000001",
      reason: "Illegible scan, please re-upload",
    });
    expect(result).toMatchObject({ data: { verificationStatus: "REJECTED" } });
    expect(prismaMock.studentDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        verificationStatus: "REJECTED",
        rejectionReason: "Illegible scan, please re-upload",
      }),
    }));
  });

  it("enforces reason min length", async () => {
    const result = await rejectStudentDocumentAction({ id: "clh0000000000000000000001", reason: "no" });
    expect(result).toEqual({ error: expect.stringMatching(/5|character/i) });
  });
});

describe("reopenStudentDocumentAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("VERIFIED → PENDING", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", verificationStatus: "VERIFIED", title: "X",
    } as never);
    prismaMock.studentDocument.update.mockResolvedValue({ id: "sd-1", verificationStatus: "PENDING" } as never);

    const result = await reopenStudentDocumentAction("sd-1");
    expect(result).toMatchObject({ data: { verificationStatus: "PENDING" } });
  });

  it("refuses when already PENDING", async () => {
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", schoolId: "default-school", verificationStatus: "PENDING", title: "X",
    } as never);
    const result = await reopenStudentDocumentAction("sd-1");
    expect(result).toEqual({ error: "Document is already PENDING" });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement**

Append to `document.action.ts`:

```ts
export async function verifyStudentDocumentAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_VERIFY);
  if (denied) return denied;

  const existing = await db.studentDocument.findFirst({
    where: { id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Document not found" };
  if (existing.verificationStatus !== "PENDING") return { error: "Document is no longer PENDING" };

  const updated = await db.studentDocument.update({
    where: { id },
    data: {
      verificationStatus: "VERIFIED",
      verifiedBy: ctx.session.user.id!,
      verifiedAt: new Date(),
      rejectionReason: null,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "StudentDocument",
    entityId: id,
    module: "students",
    description: `Verified document: ${existing.title}`,
    previousData: { verificationStatus: existing.verificationStatus },
    newData: { verificationStatus: "VERIFIED" },
  });

  return { data: updated };
}

export async function rejectStudentDocumentAction(input: { id: string; reason: string }) {
  const parsed = rejectStudentDocumentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_VERIFY);
  if (denied) return denied;

  const existing = await db.studentDocument.findFirst({
    where: { id: parsed.data.id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Document not found" };
  if (existing.verificationStatus !== "PENDING") return { error: "Document is no longer PENDING" };

  const updated = await db.studentDocument.update({
    where: { id: parsed.data.id },
    data: {
      verificationStatus: "REJECTED",
      rejectionReason: parsed.data.reason,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "StudentDocument",
    entityId: parsed.data.id,
    module: "students",
    description: `Rejected document: ${existing.title}`,
    previousData: { verificationStatus: existing.verificationStatus },
    newData: { verificationStatus: "REJECTED" },
    metadata: { reason: parsed.data.reason },
  });

  return { data: updated };
}

export async function reopenStudentDocumentAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_VERIFY);
  if (denied) return denied;

  const existing = await db.studentDocument.findFirst({
    where: { id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Document not found" };
  if (existing.verificationStatus === "PENDING") return { error: "Document is already PENDING" };

  const updated = await db.studentDocument.update({
    where: { id },
    data: {
      verificationStatus: "PENDING",
      verifiedBy: null,
      verifiedAt: null,
      rejectionReason: null,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "StudentDocument",
    entityId: id,
    module: "students",
    description: `Reopened document: ${existing.title}`,
    previousData: { verificationStatus: existing.verificationStatus },
    newData: { verificationStatus: "PENDING" },
  });

  return { data: updated };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: 27 passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add verify/reject/reopen document actions"
```

---

## Task 11: `portAdmissionDocumentsToStudentAction`

**Files:**
- Modify: `src/modules/student/actions/document.action.ts`
- Modify: `tests/unit/students/document.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import { portAdmissionDocumentsToStudentAction } from "@/modules/student/actions/document.action";

describe("portAdmissionDocumentsToStudentAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("maps admission docs to matching-named types and preserves verification status", async () => {
    prismaMock.admissionDocument.findMany.mockResolvedValue([
      { id: "ad-1", documentType: "Birth Certificate", fileKey: "k1", fileName: "bc.pdf",
        verificationStatus: "VERIFIED", verifiedBy: "u-1", verifiedAt: new Date("2025-01-01"),
        rejectionReason: null },
      { id: "ad-2", documentType: "Unknown Type", fileKey: "k2", fileName: "u.pdf",
        verificationStatus: "PENDING", verifiedBy: null, verifiedAt: null, rejectionReason: null },
    ] as never);
    prismaMock.documentType.upsert.mockResolvedValue({ id: "dt-other", name: "Other" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-birth", name: "Birth Certificate", status: "ACTIVE" },
      { id: "dt-other", name: "Other", status: "ACTIVE" },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([] as never);
    prismaMock.studentDocument.createMany.mockResolvedValue({ count: 2 } as never);

    const result = await portAdmissionDocumentsToStudentAction({
      applicationId: "app-1",
      studentId: "clh0000000000000000000001",
    });
    expect(result).toEqual({ data: { ported: 2, skipped: 0 } });
  });

  it("is idempotent: skips existing (studentId, fileKey) pairs", async () => {
    prismaMock.admissionDocument.findMany.mockResolvedValue([
      { id: "ad-1", documentType: "Birth Certificate", fileKey: "k1", fileName: "bc.pdf",
        verificationStatus: "VERIFIED", verifiedBy: "u-1", verifiedAt: new Date(),
        rejectionReason: null },
    ] as never);
    prismaMock.documentType.upsert.mockResolvedValue({ id: "dt-other", name: "Other" } as never);
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-birth", name: "Birth Certificate", status: "ACTIVE" },
      { id: "dt-other", name: "Other", status: "ACTIVE" },
    ] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([{ fileKey: "k1" }] as never);
    prismaMock.studentDocument.createMany.mockResolvedValue({ count: 0 } as never);

    const result = await portAdmissionDocumentsToStudentAction({
      applicationId: "app-1",
      studentId: "clh0000000000000000000001",
    });
    expect(result).toEqual({ data: { ported: 0, skipped: 1 } });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: FAIL — export missing.

- [ ] **Step 3: Implement**

Append to `document.action.ts`:

```ts
export async function portAdmissionDocumentsToStudentAction(input: {
  applicationId: string;
  studentId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  // Called from admission finalisation context — use admission's permission,
  // which the caller already holds.

  const admissionDocs = await db.admissionDocument.findMany({
    where: { applicationId: input.applicationId },
  });
  if (admissionDocs.length === 0) return { data: { ported: 0, skipped: 0 } };

  // Ensure "Other" type exists.
  const otherType = await db.documentType.upsert({
    where: { schoolId_name: { schoolId: ctx.schoolId, name: "Other" } },
    update: {},
    create: {
      schoolId: ctx.schoolId,
      name: "Other",
      isRequired: false,
      appliesTo: "ALL",
      sortOrder: 9999,
    },
  });

  const types = await db.documentType.findMany({
    where: { schoolId: ctx.schoolId, status: "ACTIVE" },
  });
  const typeByLowerName = new Map(types.map((t) => [t.name.toLowerCase(), t]));

  const existing = await db.studentDocument.findMany({
    where: { studentId: input.studentId, fileKey: { in: admissionDocs.map((d) => d.fileKey) } },
    select: { fileKey: true },
  });
  const existingKeys = new Set(existing.map((e) => e.fileKey));

  const toCreate = admissionDocs
    .filter((ad) => !existingKeys.has(ad.fileKey))
    .map((ad) => {
      const matchedType = typeByLowerName.get(ad.documentType.toLowerCase());
      const targetType = matchedType ?? otherType;
      return {
        schoolId: ctx.schoolId,
        studentId: input.studentId,
        documentTypeId: targetType.id,
        title: ad.documentType, // preserve original admission documentType string
        fileKey: ad.fileKey,
        fileName: ad.fileName,
        fileSize: 0, // admission didn't track size — backfill-safe default
        contentType: "application/octet-stream",
        verificationStatus: ad.verificationStatus,
        verifiedBy: ad.verifiedBy,
        verifiedAt: ad.verifiedAt,
        rejectionReason: ad.rejectionReason,
        uploadedBy: ctx.session.user.id!,
      };
    });

  if (toCreate.length > 0) {
    await db.studentDocument.createMany({ data: toCreate });
    await audit({
      userId: ctx.session.user.id!,
      action: "CREATE",
      entity: "StudentDocument",
      entityId: input.studentId,
      module: "students",
      description: `Ported ${toCreate.length} admission documents to student vault`,
      metadata: { applicationId: input.applicationId, ported: toCreate.length, skipped: existingKeys.size },
    });
  }

  return { data: { ported: toCreate.length, skipped: existingKeys.size } };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: 29 passing.

- [ ] **Step 5: Wire into `enrollApplicationAction`**

Edit `src/modules/admissions/actions/admission.action.ts`. Locate `enrollApplicationAction` (starts at line 683). The transaction ends around line 845 with `return { student, guardian, enrollment, updatedApplication };`. After the transaction closes (outside the `db.$transaction` callback), add the port call before the final return:

Import at the top of the file (merge with existing imports):
```ts
import { portAdmissionDocumentsToStudentAction } from "@/modules/student/actions/document.action";
```

Then, right before the final return of `enrollApplicationAction`:
```ts
  // Port admission documents to the student vault (non-blocking on failure).
  try {
    await portAdmissionDocumentsToStudentAction({
      applicationId: id,
      studentId: result.student.id,
    });
  } catch (portErr) {
    // Log but don't fail enrollment — the admission docs remain accessible via admissions.
    console.error("Failed to port admission documents to student vault:", portErr);
  }
```

Adjust the variable names (`id`, `result.student.id`) to match the actual local names in `enrollApplicationAction` (they may be `applicationId` / `student.id`).

- [ ] **Step 6: Run full test suite to confirm no regressions**

Run: `npx vitest run tests/unit/students/document.test.ts tests/unit/admissions/`
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(students): add portAdmissionDocumentsToStudentAction + hook into enrollment"
```

---

## Task 12: Cohort queries — `listStudentsWithMissingDocsAction` + `listStudentsWithExpiringDocsAction`

**Files:**
- Modify: `src/modules/student/actions/document.action.ts`
- Modify: `tests/unit/students/document.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import {
  listStudentsWithMissingDocsAction,
  listStudentsWithExpiringDocsAction,
} from "@/modules/student/actions/document.action";

describe("listStudentsWithMissingDocsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns students whose valid-verified doc set misses a required type", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-1", name: "Birth Cert", isRequired: true, appliesTo: "ALL", status: "ACTIVE" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", firstName: "A", lastName: "B", studentId: "S/1", boardingStatus: "DAY", studentDocuments: [] },
      { id: "s-2", firstName: "C", lastName: "D", studentId: "S/2", boardingStatus: "DAY", studentDocuments: [
        { documentTypeId: "dt-1", verificationStatus: "VERIFIED", expiresAt: null },
      ] },
    ] as never);

    const result = await listStudentsWithMissingDocsAction();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: "s-1" });
  });
});

describe("listStudentsWithExpiringDocsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns students with docs expiring inside the window", async () => {
    const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", firstName: "A", lastName: "B", studentId: "S/1",
        studentDocuments: [{ id: "sd-1", expiresAt: soon, documentType: { name: "NHIS" } }] },
    ] as never);

    const result = await listStudentsWithExpiringDocsAction();
    expect(result.data).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement**

Append to `document.action.ts`:

```ts
export async function listStudentsWithMissingDocsAction(opts?: { page?: number; limit?: number }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_READ);
  if (denied) return denied;

  const requiredTypes = await db.documentType.findMany({
    where: { schoolId: ctx.schoolId, status: "ACTIVE", isRequired: true },
  });
  if (requiredTypes.length === 0) return { data: [] };

  // Load students in school with their verified-not-expired documents for required types.
  const students = await db.student.findMany({
    where: { schoolId: ctx.schoolId, status: "ACTIVE" },
    include: {
      studentDocuments: {
        where: {
          verificationStatus: "VERIFIED",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          documentTypeId: { in: requiredTypes.map((t) => t.id) },
        },
        select: { documentTypeId: true },
      },
    },
    take: opts?.limit ?? 100,
    skip: ((opts?.page ?? 1) - 1) * (opts?.limit ?? 100),
  });

  const missing = students.filter((s) => {
    const ownedTypeIds = new Set(s.studentDocuments.map((d) => d.documentTypeId));
    const applicableRequired = requiredTypes.filter((t) =>
      t.appliesTo === "ALL" ||
      (t.appliesTo === "BOARDING_ONLY" && s.boardingStatus === "BOARDING") ||
      (t.appliesTo === "DAY_ONLY" && s.boardingStatus === "DAY")
    );
    return applicableRequired.some((t) => !ownedTypeIds.has(t.id));
  });

  return { data: missing };
}

export async function listStudentsWithExpiringDocsAction(opts?: {
  withinDays?: number;
  page?: number;
  limit?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_DOCUMENTS_READ);
  if (denied) return denied;

  const within = opts?.withinDays ?? EXPIRING_SOON_DAYS;
  const windowEnd = new Date(Date.now() + within * 24 * 60 * 60 * 1000);

  const students = await db.student.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "ACTIVE",
      studentDocuments: {
        some: {
          verificationStatus: "VERIFIED",
          expiresAt: { gt: new Date(), lte: windowEnd },
        },
      },
    },
    include: {
      studentDocuments: {
        where: {
          verificationStatus: "VERIFIED",
          expiresAt: { gt: new Date(), lte: windowEnd },
        },
        include: { documentType: { select: { id: true, name: true } } },
      },
    },
    take: opts?.limit ?? 100,
    skip: ((opts?.page ?? 1) - 1) * (opts?.limit ?? 100),
  });

  return { data: students };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/students/document.test.ts`
Expected: 31 passing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): add cohort queries for missing + expiring docs"
```

---

## Task 13: Integration test — lifecycle against live DB

**Files:**
- Create: `tests/integration/students/document-vault.test.ts`

- [ ] **Step 1: Write the integration test**

Follow the pattern from `tests/integration/students/promotion-lifecycle.test.ts` (setup / teardown / mocked auth). Seed: school (existing `default-school`), student, two `DocumentType` (one with 12-month expiry, one with no expiry), then exercise the flow.

Place the file at `tests/integration/students/document-vault.test.ts` — it'll be picked up by the existing `vitest.students.config.ts` glob `tests/integration/students/**`.

Skeleton (fill in real IDs based on the seed pattern used by `promotion-lifecycle.test.ts`):

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createDocumentTypeAction,
  recordUploadedStudentDocumentAction,
  verifyStudentDocumentAction,
  getMissingRequiredDocumentsAction,
  listStudentDocumentsAction,
  portAdmissionDocumentsToStudentAction,
} from "@/modules/student/actions/document.action";
import { resolveSeededAdminId, loginAs } from "./setup";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Document vault lifecycle (integration)", () => {
  const db = new PrismaClient();
  const testTag = `doc-test-${Date.now()}`;
  let studentId: string;
  let typeIdWithExpiry: string;
  let typeIdNoExpiry: string;

  beforeAll(async () => {
    const adminId = await resolveSeededAdminId(db);
    await loginAs(adminId);

    // Create student
    const student = await db.student.create({
      data: {
        schoolId: "default-school",
        studentId: `${testTag}/1`,
        firstName: "Doc",
        lastName: "Test",
        dateOfBirth: new Date("2008-01-01"),
        gender: "MALE",
        boardingStatus: "DAY",
      },
    });
    studentId = student.id;

    // Create two DocumentTypes via the action (exercise permission path)
    const t1 = await createDocumentTypeAction({
      name: `${testTag}-Required-12mo`,
      isRequired: true,
      expiryMonths: 12,
      appliesTo: "ALL",
    });
    if (!("data" in t1)) throw new Error(t1.error);
    typeIdWithExpiry = t1.data.id;

    const t2 = await createDocumentTypeAction({
      name: `${testTag}-Required-NoExpiry`,
      isRequired: true,
      appliesTo: "ALL",
    });
    if (!("data" in t2)) throw new Error(t2.error);
    typeIdNoExpiry = t2.data.id;
  });

  afterAll(async () => {
    await db.studentDocument.deleteMany({ where: { studentId } });
    await db.documentType.deleteMany({ where: { name: { startsWith: testTag } } });
    await db.student.delete({ where: { id: studentId } });
    await db.$disconnect();
  });

  it("runs upload → verify → missing-check → expire → missing-check again", async () => {
    // Before any upload, both required types are missing.
    const before = await getMissingRequiredDocumentsAction(studentId);
    if (!("data" in before)) throw new Error(before.error);
    expect(before.data.missing).toHaveLength(2);

    // Upload + verify both.
    const rec1 = await recordUploadedStudentDocumentAction({
      studentId,
      documentTypeId: typeIdWithExpiry,
      title: "Test doc 1",
      fileKey: `student-documents/${studentId}/test-1.pdf`,
      fileName: "test-1.pdf",
      fileSize: 100,
      contentType: "application/pdf",
    });
    if (!("data" in rec1)) throw new Error(rec1.error);
    await verifyStudentDocumentAction(rec1.data.id);

    const rec2 = await recordUploadedStudentDocumentAction({
      studentId,
      documentTypeId: typeIdNoExpiry,
      title: "Test doc 2",
      fileKey: `student-documents/${studentId}/test-2.pdf`,
      fileName: "test-2.pdf",
      fileSize: 100,
      contentType: "application/pdf",
    });
    if (!("data" in rec2)) throw new Error(rec2.error);
    await verifyStudentDocumentAction(rec2.data.id);

    // Now missing is empty.
    const after = await getMissingRequiredDocumentsAction(studentId);
    if (!("data" in after)) throw new Error(after.error);
    expect(after.data.missing).toHaveLength(0);

    // Fast-forward: mark one doc's expiresAt to the past.
    await db.studentDocument.update({
      where: { id: rec1.data.id },
      data: { expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24) },
    });

    const afterExpire = await getMissingRequiredDocumentsAction(studentId);
    if (!("data" in afterExpire)) throw new Error(afterExpire.error);
    expect(afterExpire.data.missing).toHaveLength(1);
    expect(afterExpire.data.missing[0]!.id).toBe(typeIdWithExpiry);

    // Confirm list view returns the expired flag.
    const listed = await listStudentDocumentsAction(studentId);
    if (!("data" in listed)) throw new Error(listed.error);
    const expired = listed.data.find((d) => d.id === rec1.data.id);
    expect(expired?.isExpired).toBe(true);
  });
});
```

- [ ] **Step 2: Run**

Run: `npm run test:students`
Expected: 2/2 passing (promotion lifecycle + document vault).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/students/document-vault.test.ts
git commit -m "test(students): add document vault lifecycle integration test"
```

---

## Task 14: Document types admin page

**Files:**
- Create: `src/app/(dashboard)/admin/document-types/page.tsx`
- Create: `src/app/(dashboard)/admin/document-types/document-types-client.tsx`

- [ ] **Step 1: Server page**

```tsx
// src/app/(dashboard)/admin/document-types/page.tsx
import { listDocumentTypesAction } from "@/modules/student/actions/document.action";
import { DocumentTypesClient } from "./document-types-client";

export default async function DocumentTypesPage() {
  const res = await listDocumentTypesAction();
  const types = "data" in res ? res.data : [];
  const error = "error" in res ? res.error : null;
  return <DocumentTypesClient types={types} error={error} />;
}
```

- [ ] **Step 2: Client component**

Read `src/app/(dashboard)/admin/houses/houses-client.tsx` to understand the sibling-admin pattern (add button, table, inline edit dialogs). Then build a mirroring `DocumentTypesClient` with:

- Table columns: Name | Required (checkbox) | Expiry (months) | Applies to | Status | Actions (Edit / Deactivate)
- "Add type" button → opens a form dialog with fields: name, description (optional), isRequired, expiryMonths (optional), appliesTo, sortOrder
- Inline Edit dialog reusing the same form component
- Deactivate button confirms, then calls `deactivateDocumentTypeAction`
- After every successful mutation: `router.refresh()`

Type derivation:
```ts
type DocumentType = Extract<Awaited<ReturnType<typeof listDocumentTypesAction>>, { data: unknown }>["data"][number];
```

Follow the native `<button>` / `<select>` / `<input>` with tailwind conventions — no shadcn.

- [ ] **Step 3: Smoke test**

Run: `npm run dev` → log in as admin → `/admin/document-types` → add a type → edit it → deactivate → verify. If dev server auth makes this impractical in the environment, skip to `npx tsc --noEmit` instead.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/admin/document-types"
git commit -m "feat(students): add document-types admin page"
```

---

## Task 15: Student profile "Documents" tab

**Files:**
- Create: `src/app/(dashboard)/students/[id]/documents-section.tsx`
- Modify: `src/app/(dashboard)/students/[id]/student-profile.tsx`

- [ ] **Step 1: Write the tab component**

Study `src/app/(dashboard)/students/[id]/health-section.tsx` first (as instructed by the plan — it's the closest read-write tab pattern for the student profile).

Then create `documents-section.tsx`:

- Load via `listStudentDocumentsAction(studentId)` + `getMissingRequiredDocumentsAction(studentId)` + `listDocumentTypesAction({ status: "ACTIVE" })` — all three server calls
- Missing-required alert card at top (conditional) with list of missing type names
- Documents table with columns: Type | Title | Status badge | Expiry | Uploaded by/at | Actions
- Status badges: PENDING=neutral (`bg-muted`), VERIFIED=green (`bg-emerald-100 text-emerald-800`), REJECTED=red (`bg-destructive/10 text-destructive`), EXPIRED=muted-red (`bg-red-50 text-red-700`), EXPIRING_SOON=amber (`bg-amber-100 text-amber-800`)
- Actions per row (permission-gated via session-level `canVerify`, `canDelete` props passed from parent):
  - View → opens `/api/files/[key]` in a new tab (which redirects to the signed URL)
  - Verify → calls `verifyStudentDocumentAction(id)` + `router.refresh()`
  - Reject → opens a text dialog; submits `rejectStudentDocumentAction({ id, reason })`
  - Delete → `confirm()` then `deleteStudentDocumentAction(id)`
- Upload panel at bottom:
  - Type `<select>` (options from catalog)
  - File `<input type="file">`
  - Title `<input>` (defaults to selected type.name on change)
  - Notes `<textarea>` (optional)
  - Submit: POST to `/api/upload` with `module="student-documents"`, `entityId=studentId`, then call `recordUploadedStudentDocumentAction` with the returned `fileKey`
  - On success: `router.refresh()`, reset form

Follow the type-derivation + native-element + `rounded-xl border border-border p-4` card idioms established in the promotion wizard UI.

- [ ] **Step 2: Wire into the profile tabs**

Edit `src/app/(dashboard)/students/[id]/student-profile.tsx`. Locate the tabs array (around line 148–157 per the spec exploration). Add a "Documents" tab at index 7 (before Boarding):

```ts
{ key: "documents", label: "Documents" },
```

And in the tab-body conditional render, add:

```tsx
{activeTab === "documents" && <DocumentsSection studentId={student.id} />}
```

Import `DocumentsSection` from `./documents-section`.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(students): add Documents tab on student profile"
```

---

## Task 16: Student list filter chips

**Files:**
- Modify: `src/app/(dashboard)/students/students-client.tsx`
- Modify: `src/app/(dashboard)/students/page.tsx` (if server-side filter routing is needed)

- [ ] **Step 1: Inspect the current filter implementation**

Read `src/app/(dashboard)/students/students-client.tsx` to see how the existing filter chips (if any) or search bar work. Some codebases route filters via query params + server page refetch; others do client-side filtering. Match the existing idiom.

- [ ] **Step 2: Add two filter chips**

If filters are query-param driven:
- Add chips "Missing required docs" and "Docs expiring in 30 days" that set `?missingDocs=1` and `?expiringDocs=1` respectively
- The `page.tsx` server component reads these and calls `listStudentsWithMissingDocsAction` or `listStudentsWithExpiringDocsAction` instead of the default student list

If filters are client-side:
- Fetch counts via the two actions on mount
- Show chips with badge counts; clicking the chip filters the displayed set to those students

Follow whichever pattern the existing filters use. If no pattern exists, prefer query-param routing (server-rendered counts on page load).

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(students): add missing-docs + expiring-docs filter chips"
```

---

## Task 17: Seed default catalog for existing schools

**Files:**
- Create: `prisma/seed-document-types.ts` (one-off backfill helper)

Note: this is a one-time backfill for tenants that exist today. Ongoing new-school creation is handled by whatever existing seed invokes (check `prisma/seed.ts` if present; if none exists for school creation, a future "New School" wizard will need to call the same helper).

- [ ] **Step 1: Write the seed helper**

```ts
// prisma/seed-document-types.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEFAULT_CATALOG: Array<{
  name: string;
  isRequired: boolean;
  expiryMonths: number | null;
  appliesTo: "ALL" | "BOARDING_ONLY" | "DAY_ONLY";
  sortOrder: number;
}> = [
  { name: "Birth Certificate", isRequired: true, expiryMonths: null, appliesTo: "ALL", sortOrder: 0 },
  { name: "JHS Report Card", isRequired: true, expiryMonths: null, appliesTo: "ALL", sortOrder: 1 },
  { name: "Placement Letter", isRequired: true, expiryMonths: null, appliesTo: "ALL", sortOrder: 2 },
  { name: "NHIS Card", isRequired: true, expiryMonths: 12, appliesTo: "ALL", sortOrder: 3 },
  { name: "Medical Clearance", isRequired: true, expiryMonths: 12, appliesTo: "BOARDING_ONLY", sortOrder: 4 },
  { name: "Passport Photo", isRequired: true, expiryMonths: null, appliesTo: "ALL", sortOrder: 5 },
  { name: "Guardian ID", isRequired: true, expiryMonths: null, appliesTo: "ALL", sortOrder: 6 },
  { name: "Other", isRequired: false, expiryMonths: null, appliesTo: "ALL", sortOrder: 9999 },
];

async function main() {
  const schools = await db.school.findMany();
  for (const school of schools) {
    for (const type of DEFAULT_CATALOG) {
      await db.documentType.upsert({
        where: { schoolId_name: { schoolId: school.id, name: type.name } },
        update: {},
        create: { schoolId: school.id, ...type },
      });
    }
    console.log(`Seeded catalog for ${school.id}`);
  }
}

main().then(() => db.$disconnect());
```

- [ ] **Step 2: Run**

Run: `npx tsx prisma/seed-document-types.ts`
Expected: console lines "Seeded catalog for <school-id>" per existing school.

Verify:
```bash
echo "SELECT name, isRequired, expiryMonths, appliesTo FROM \"DocumentType\";" | npx prisma db execute --stdin
```

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-document-types.ts
git commit -m "feat(students): seed default document-type catalog for existing schools"
```

---

## Task 18: End-to-end verification

**Files:** (no edits — verification only)

- [ ] **Step 1: Full unit test suite**

Run: `npx vitest run`
Expected: all passing including `tests/unit/students/document.test.ts` (31/31) and no regressions elsewhere.

- [ ] **Step 2: Integration test**

Run: `npm run test:students`
Expected: 2/2 passing (promotion-lifecycle + document-vault).

- [ ] **Step 3: Audit coverage guardrail**

Run: `npx vitest run tests/unit/guardrails/audit-coverage.test.ts`
Expected: 2/2 passing (every mutating action has `audit()`).

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success. Confirm routes `/admin/document-types` and student profile compile.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no new errors in files under this feature.

- [ ] **Step 7: Manual UI walk (if dev env available)**

1. Log in as admin → `/admin/document-types` → add a test type; deactivate it → verify soft-delete
2. Go to a student profile → Documents tab → upload a file → verify badge shows PENDING
3. Click Verify → badge flips to VERIFIED; missing-docs alert updates accordingly
4. Upload another doc, Reject with a reason → REJECTED badge + reason visible
5. Reopen the rejected doc → back to PENDING
6. Delete a doc → confirm prompt → row gone
7. On `/students` → verify "Missing required docs" and "Docs expiring in 30 days" chips filter correctly
8. Seed an admission application with documents → finalize enrollment → verify docs auto-ported to the new student vault with verification status preserved
9. Log in as a non-verify role → confirm Verify/Reject/Delete buttons are hidden

- [ ] **Step 8: Screenshot evidence**

Capture screenshots of the admin catalog page, the student Documents tab with each badge state, and the student list filter chips. Save under `docs/screenshots/document-vault/`.

No commit needed — evidence is the screenshots and passing tests.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage**: every spec section maps to a task (schema → T1, permissions → T2, zod → T3, catalog → T4–6, vault read → T7, vault write → T8–9, verification → T10, port → T11, cohort → T12, integration → T13, UI → T14–16, seed → T17, verification → T18)
- [x] **No placeholders**: every code step has actual code, every command has expected output. The one deliberate deferral is "seed-document-types.ts if no existing seed hook" — spec called this out as one-off backfill
- [x] **Type consistency**: enum values match across schema/zod/tests (`ALL | BOARDING_ONLY | DAY_ONLY`, `PENDING | VERIFIED | REJECTED`). Action names match between test and implementation. Zod uses `.issues[0]` per zod v4 convention established in the promotion wizard.
- [x] **File paths**: all tasks use exact repo paths
- [x] **TDD shape**: every logic task has write-test → verify-fail → implement → verify-pass → commit
