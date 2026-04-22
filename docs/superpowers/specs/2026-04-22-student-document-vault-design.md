# Student Document Vault — Design Spec

**Date:** 2026-04-22
**Module:** Students (Tier 1, Item #2 from the Students module depth review)
**Status:** Approved design, pending implementation plan

---

## 1. Context & Goal

The school has no centralized place to hold student-level documents (birth certificate, JHS report card, placement letter, NHIS card, medical clearance, passport photo, guardian ID). Some of these are captured at admission time via `AdmissionDocument`, but once a student is enrolled those records are effectively buried in the admissions module — the student profile has no visibility into them, and there is no way to identify students who are missing required paperwork or whose compliance documents are about to expire.

This design adds a **Student Document Vault**: a per-school document-type catalog (admin-configurable), a per-student document store backed by existing R2 storage, a verification workflow mirroring `AdmissionDocument`, automatic porting of admission-era documents to the student vault at enrollment finalization, and two cohort-level filters on the student list for "missing required docs" and "docs expiring in 30 days."

Scope is explicitly **compliance / required-docs tracking** for v1. Student portfolio artefacts (certificates, awards) and staff-generated records (discipline forms, excuse letters) are out of scope; guardian-side upload is deferred to the future parent-portal upgrade (Tier 2 #6).

---

## 2. Scope (decided during brainstorming)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| Q1 | v1 primary driver | A — Compliance / required-docs tracking | Biggest operational pain; `AdmissionDocument` provides the exact template |
| Q2 | Document type taxonomy | C — Admin-configurable catalog per school | Required-docs logic needs canonical types; schema-enum too rigid for multi-tenant |
| Q3 | Admission-doc relationship | A — Auto-port at enrollment finalization | Matches user mental model; admission docs stay for audit |
| Q4 | Verification workflow | A — Mirror `AdmissionDocument` (PENDING / VERIFIED / REJECTED) | Direct port with status preserved; rejection reason is operationally useful |
| Q5 | Expiry behavior | B — Visual flag + 30-day expiring-soon warning | Gives admins a re-upload queue without coupling to comms module |
| Q6 | Who can upload | A — Staff only (v1) | Guardian upload belongs to parent-portal upgrade; keeps scope tight |

Explicitly **out of scope for v1**:
- Student portfolio / certificates / awards
- Staff-generated records (discipline forms, excuse letters)
- Guardian self-service upload
- Automated expiry notifications (SMS/email)
- Content-type whitelist per document type
- Virus scanning / file inspection

---

## 3. Architecture

**Storage**: reuse existing Cloudflare R2 plumbing (`src/lib/storage/r2.ts`, `/api/upload` POST, `/api/files/[key]` GET). New uploads use `module="student-documents"`, `entityId=studentId`. Zero new storage code.

**Data**: two new Prisma models under `prisma/schema/student.prisma`:
- `DocumentType` — per-school catalog of document categories with metadata (required, expiry policy, applicability)
- `StudentDocument` — one row per uploaded file; FK to student and type; mirrors `AdmissionDocument` lifecycle fields

**Actions**: new module file `src/modules/student/actions/document.action.ts` containing the catalog management, vault read/write, verification, port, and cohort-query actions.

**UI**:
- New "Documents" tab (index 7) on the student profile (`src/app/(dashboard)/students/[id]/student-profile.tsx`)
- Two new filter chips on the student list
- New admin settings page `/settings/document-types` for catalog management
- Shared Verify / Reject dialog component

**Permissions** (new, added to `src/lib/permissions.ts`):
- `STUDENTS_DOCUMENTS_CREATE`
- `STUDENTS_DOCUMENTS_READ`
- `STUDENTS_DOCUMENTS_VERIFY`
- `STUDENTS_DOCUMENTS_DELETE`
- `DOCUMENT_TYPES_MANAGE`

Granted to existing admin roles (`super_admin`, `headmaster`, `assistant_headmaster_academic`, `assistant_headmaster_admin`) following the `STUDENTS_PROMOTE` precedent.

**Admission port**: the existing admission-finalization action (to be located in `src/modules/admissions/actions/*`) gets a one-line call to `portAdmissionDocumentsToStudentAction` after the `Student` row is created. The port is idempotent via `(studentId, fileKey)` deduplication.

**Seed**: first-run per-school seed creates a default catalog for Ghana SHS compliance (see §5).

---

## 4. Data Model

```prisma
model DocumentType {
  id           String                 @id @default(cuid())
  schoolId     String
  name         String                 // e.g. "Birth Certificate"
  description  String?
  isRequired   Boolean                @default(false)
  expiryMonths Int?                   // null = never expires
  appliesTo    DocumentAppliesTo      @default(ALL)
  status       Status                 @default(ACTIVE)
  sortOrder    Int                    @default(0)
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt

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
  title              String                     // editable; defaults to type.name
  fileKey            String                     // R2 key
  fileName           String
  fileSize           Int
  contentType        String
  verificationStatus DocumentVerificationStatus @default(PENDING)
  verifiedBy         String?
  verifiedAt         DateTime?
  rejectionReason    String?
  expiresAt          DateTime?                  // denormalized at upload from type.expiryMonths
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

**Design rationale**
- Reuses existing `DocumentVerificationStatus` enum; no duplicate
- No unique on `(studentId, documentTypeId)`: students may legitimately have historical versions of the same type. Most-recent-valid-VERIFIED satisfies the requirement
- `expiresAt` is denormalized so policy changes don't retroactively re-expire old docs
- `appliesTo` drives the missing-docs calculation dynamically against `student.boardingStatus` — no data migration needed when a student flips DAY↔BOARDING
- Inverse relations needed on `School` (two named), `Student` (one), `DocumentType` (one). Actor fields (`uploadedBy`, `verifiedBy`) stay as raw strings per existing convention

---

## 5. Server Actions

All in `src/modules/student/actions/document.action.ts`. All require `requireSchoolContext`. All school-scoped.

### Catalog (permission `DOCUMENT_TYPES_MANAGE`)

- `listDocumentTypesAction({ status? })` — ordered by `sortOrder`, then `name`
- `createDocumentTypeAction(input)` — zod-validated; respects `@@unique([schoolId, name])`
- `updateDocumentTypeAction(input)` — partial update; **does not** retroactively alter existing `StudentDocument.expiresAt`
- `deactivateDocumentTypeAction(typeId)` — soft-delete only (`status = INACTIVE`). Hard delete is refused if any documents reference it

### Vault read (`STUDENTS_DOCUMENTS_READ`)

- `listStudentDocumentsAction(studentId)` — returns documents + joined `documentType`; server-computed per-row flags: `isExpired`, `isExpiringSoon` (≤30 days), `isSupersededByNewerVerified`
- `getMissingRequiredDocumentsAction(studentId)` — returns `{ required, missing }`. `missing` = required types (active, matching `student.boardingStatus`) that lack any *valid-verified* document, where valid-verified = `VERIFIED AND (expiresAt IS NULL OR expiresAt > now)`

### Vault write (`STUDENTS_DOCUMENTS_CREATE`)

- `recordUploadedStudentDocumentAction(input)` — called AFTER `/api/upload` returns a `fileKey`. Creates the `StudentDocument` row with `verificationStatus = PENDING`, computes `expiresAt` from `documentType.expiryMonths` if set. On DB insert failure, calls `deleteFile(fileKey)` to clean up. Audit.
- `updateStudentDocumentAction({ id, title?, notes? })` — metadata edits only; no file swap
- `deleteStudentDocumentAction(id)` (`STUDENTS_DOCUMENTS_DELETE`) — deletes the DB row; calls `deleteFile(fileKey)`. R2 failure is logged but does not block DB deletion. Audit with `previousData` carrying the deleted metadata

### Verification (`STUDENTS_DOCUMENTS_VERIFY`)

- `verifyStudentDocumentAction(id)` — PENDING → VERIFIED; stamps `verifiedBy`, `verifiedAt`. Audit.
- `rejectStudentDocumentAction({ id, reason })` — PENDING → REJECTED; `reason` min 5 chars; stores `rejectionReason`. Audit.
- `reopenStudentDocumentAction(id)` — VERIFIED/REJECTED → PENDING (escape hatch). Audit.

### Port from admissions

- `portAdmissionDocumentsToStudentAction({ applicationId, studentId })`:
  1. Load `AdmissionDocument[]` for the application
  2. Upsert an "Other" `DocumentType` for the school if absent
  3. For each admission doc: resolve `documentTypeId` by case-insensitive name match against active types, else "Other"
  4. Create `StudentDocument` rows copying `fileKey`, `fileName`, preserving `verificationStatus`, `verifiedBy`, `verifiedAt`, `rejectionReason`; `uploadedBy` = original admission uploader if available, otherwise porting user
  5. Idempotency: skip if a `StudentDocument` already exists for `(studentId, fileKey)`
  6. Admission rows stay in place (audit)
  7. Return `{ ported: N, skipped: M }`

Called from the admission-finalization action in the admissions module. Located during implementation.

### Cohort queries (`STUDENTS_DOCUMENTS_READ`)

- `listStudentsWithMissingDocsAction({ page?, limit? })` — single-query pattern: load required types for school, load valid-verified doc counts per student per type, compute diff in memory
- `listStudentsWithExpiringDocsAction({ withinDays = 30, page?, limit? })` — students with any valid-verified doc whose `expiresAt` falls inside the window

---

## 6. UI

### Student profile — "Documents" tab

Placement: tab 7 on `/students/[id]/` (after Health, before Boarding). Follows existing tab idiom.

Contents (top to bottom):
- **Missing-required alert card** (conditional) — lists missing type names, "Upload" button pre-selects the missing type in the uploader
- **Documents table** — columns: Type | Title | Status badge | Expiry | Uploaded by/at | Actions
  - Status badges: PENDING=neutral, VERIFIED=green, REJECTED=red, EXPIRED=muted-red, EXPIRING_SOON=amber
  - REJECTED rows show `rejectionReason` inline
  - Actions (permission-gated): View (signed-URL redirect via `/api/files/[key]`), Verify, Reject, Delete
- **Upload panel** (collapsible) — type picker, file input (10MB limit, existing), title, notes, submit → `/api/upload` POST then `recordUploadedStudentDocumentAction`

### Student list — new filters

On `/students`:
- "Missing required docs" chip → `listStudentsWithMissingDocsAction`
- "Docs expiring in 30 days" chip → `listStudentsWithExpiringDocsAction`
- Each chip shows a counter badge

### Admin settings — `/settings/document-types`

- Table: Name | Required | Expiry (months) | Applies to | Status | Actions
- "Add type" dialog with zod-validated form
- Inline edit per row
- Deactivate button (soft-delete)

### Verify / Reject dialog

Shared component:
- Verify: one-click confirm
- Reject: textarea (min 5 chars) + confirm

### Default seed catalog (per school)

| Name | Required | Expiry | Applies to |
|---|---|---|---|
| Birth Certificate | ✓ | — | ALL |
| JHS Report Card | ✓ | — | ALL |
| Placement Letter | ✓ | — | ALL |
| NHIS Card | ✓ | 12 months | ALL |
| Medical Clearance | ✓ | 12 months | BOARDING_ONLY |
| Passport Photo | ✓ | — | ALL |
| Guardian ID | ✓ | — | ALL |
| Other | — | — | ALL |

The "Other" type is special: the port action uses it as a fallback for unmatched admission documents.

---

## 7. Error Handling & Edge Cases

**Upload failures**
- R2 upload fails → `/api/upload` surfaces error; no DB row created
- DB insert fails after successful R2 upload → action deletes the R2 object before returning the error (no orphan)
- File > 10MB → caught by existing `/api/upload` limit

**Catalog edits with dependent documents**
- Delete of `DocumentType` with existing docs → refused; admin must deactivate
- `isRequired` false→true → existing students instantly flagged missing; desired
- `expiryMonths` change → only future uploads affected (§4 rationale)
- Rename → reference by ID; existing rows unaffected visually

**Verification race**
- Concurrent verify → second call returns `{ error: "Document is no longer PENDING" }`
- Reject on VERIFIED → refused (use `reopenStudentDocumentAction` first)

**Port edge cases**
- Missing R2 file for admission doc → port still creates row; download fails at read time with standard signed-URL miss
- Zero admission docs → returns `{ ported: 0 }`
- Second call on same application → dedup by `(studentId, fileKey)` skips; reports skipped count
- "Other" type absent → upserted on first port call

**Deletion**
- Deleting a VERIFIED required doc → UI confirmation warns "student will become missing after deletion"; action allowed
- R2 `deleteFile` fails → DB row still deleted; audit metadata flags R2 failure; user not blocked

**Expiry**
- Comparison uses server `now()` at query time; UI badges computed server-side
- Expired docs stay in the vault — never auto-deleted

**Permissions**
- Action returns `{ error: "Unauthorized" }` on denial; UI hides gated actions for the current role

**Missing-docs performance**
- Avoid N+1 via single-query pattern (§5): batch-load required types + per-student valid-verified counts, diff in memory. Documented in action comments

**Boarding status flip**
- Check is dynamic against current `student.boardingStatus`; no data migration needed

---

## 8. Testing Strategy

**Unit** (`tests/unit/students/document.test.ts`, TDD with existing `prismaMock`)

Catalog:
- `createDocumentTypeAction` — unique name, permission
- `updateDocumentTypeAction` — partial updates
- `deactivateDocumentTypeAction` — refuses hard delete with documents; soft delete succeeds

Vault write:
- `recordUploadedStudentDocumentAction` — `expiresAt` computation; rollback calls `deleteFile` on DB failure; audit
- `updateStudentDocumentAction` — title/notes only
- `deleteStudentDocumentAction` — R2 + DB path; R2 failure still deletes DB

Vault read:
- `listStudentDocumentsAction` — flag computation across three mocked dates
- `getMissingRequiredDocumentsAction`:
  - DAY student ignores BOARDING_ONLY types
  - BOARDING student needs both
  - Expired VERIFIED counts as missing
  - PENDING/REJECTED don't satisfy
  - INACTIVE types ignored

Verification:
- `verifyStudentDocumentAction` — PENDING→VERIFIED; refuses other states
- `rejectStudentDocumentAction` — reason min 5; audit
- `reopenStudentDocumentAction` — VERIFIED/REJECTED→PENDING

Port:
- Name match → correct `documentTypeId`
- Unknown → "Other"
- "Other" upserted if absent
- `verificationStatus` preserved
- Idempotent via `(studentId, fileKey)`
- Count report

Cohort queries:
- Missing-docs filter
- Expiring-docs filter window

**Integration** (`tests/integration/students/document-vault.test.ts`, live DB)
- Seed school + student + two `DocumentType` (one 12-month expiry, one no-expiry)
- Upload → record → verify → assert missing empty
- Fast-forward `expiresAt` to past → assert missing resurfaces
- Port path: seeded admission app with matching + unknown doc → assert 2 `StudentDocument` rows with correct type mapping

**UI verification** (manual per `verification-before-completion`)
- Upload → verify → reject → reopen → delete walk; badge colors
- Student list filters surface right cohort
- Role-gated: non-verify user sees no Verify button

**Guardrail**: every mutating action writes `audit()`. Satisfies `tests/unit/guardrails/audit-coverage.test.ts`.

---

## 9. Critical Files

**New**
- `prisma/schema/student.prisma` — append `DocumentType`, `StudentDocument`, `DocumentAppliesTo`; inverse relations on `Student` and `DocumentType`
- `prisma/schema/school.prisma` — inverse relations on `School`
- `src/modules/student/actions/document.action.ts`
- `src/modules/student/schemas/document.schema.ts`
- `tests/unit/students/document.test.ts`
- `tests/integration/students/document-vault.test.ts`
- `src/app/(dashboard)/students/[id]/documents-section.tsx` (new tab)
- `src/app/(dashboard)/settings/document-types/page.tsx` + `*-client.tsx`

**Extended**
- `src/lib/permissions.ts` — five new permissions + role grants
- `src/app/(dashboard)/students/[id]/student-profile.tsx` — add "Documents" tab
- `src/app/(dashboard)/students/students-client.tsx` — two filter chips
- `src/modules/admissions/actions/*` — one-line call into `portAdmissionDocumentsToStudentAction` at finalization. Exact file located during implementation

**Reused (no changes)**
- `src/lib/storage/r2.ts` — `uploadFile`, `getSignedDownloadUrl`, `deleteFile`, `generateFileKey`
- `/api/upload` POST route
- `/api/files/[key]` GET route
- `src/lib/audit.ts`
- `DocumentVerificationStatus` enum (existing)

---

## 10. Out of Scope for v1

- Student portfolio / certificates / awards (Tier 2 B candidate)
- Staff-generated records within vault (discipline forms, excuse letters — Tier 2 C)
- Guardian self-service upload (Tier 2 #6 Parent Portal)
- Automated expiry notifications (requires comms integration)
- Content-type whitelist per type; virus scanning
- File versioning / replace-in-place (delete + re-upload instead)
- PDF preview inline (view = signed-URL redirect, browser handles)
- Tier 3 follow-up M-11 (profile photo upload) — will slot into the vault surface as a future sub-task

---

## 11. Verification Plan

When implementation lands:
1. `npx prisma migrate dev --name add_document_vault` on a scratch DB
2. `npm test -- document` — unit suite green
3. `npm run test:students` — integration test green (the existing `vitest.students.config.ts` glob `tests/integration/students/**` picks up the new test file automatically)
4. `npm run dev` → admin role → `/settings/document-types` (catalog manage) → `/students/[id]/` Documents tab (upload/verify/reject/delete) → `/students` (filter chips show counts)
5. Confirm audit log entries for every mutating action
6. Seed an admission application with documents; finalize enrollment; confirm port lands correctly with status preserved
7. Role-denied: non-admin → vault tab read-only, no Verify/Reject/Delete buttons
