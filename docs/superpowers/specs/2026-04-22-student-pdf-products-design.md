# Student PDF Products — ID Cards, Transcripts, Report Cards — Design Spec

**Date:** 2026-04-22
**Module:** Students (Tier 1, Item #3 from the Students module depth review)
**Status:** Approved design, pending implementation plan

---

## 1. Context & Goal

The school has no way to produce three high-value printed documents: student ID cards, academic transcripts, and per-term report cards. A thorough exploration of the codebase turned up excellent reusable infrastructure — `@react-pdf/renderer` is already in place, a report card PDF template already exists at `src/lib/pdf/templates/report-card.tsx`, `generateReportCardDataAction` already assembles the full JSON payload (including school branding), and `generateTranscriptAction` already produces a `Transcript` DB record with a `GENERATED → VERIFIED → ISSUED` status workflow.

What does NOT yet exist: an ID card template and its QR-code plumbing, a transcript PDF template, wired PDF endpoints for any of the three products, UI surfaces for students/staff to generate and download these documents, a bulk-generation path (class-level ID cards or report cards), and a caching layer so PDFs aren't regenerated from scratch on every click.

This design ships all three products in one release. They share the same PDF infrastructure, school-letterhead header, and signed-URL delivery model, so bundling them is cheaper than shipping serially. End-of-year use cases benefit from simultaneous availability — graduating SHS3s need transcripts, incoming SHS1s need ID cards, every student needs a term report card.

---

## 2. Scope (decided during brainstorming)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| Q1 | v1 scope | C — All three products (ID cards + Transcripts + Report cards) | Report card template already exists; transcript data action already exists; marginal cost to include both with ID cards is small |
| Q2 | ID card layout | C — Single sheet with front + back laid out side-by-side | Matches cut-and-laminate workflow; no duplex printing required |
| Q3 | QR code content | B — Raw `studentId` string (e.g. "SCH/2025/0001") | Simplest; no public profile page to design; forward-compatible with signed URLs in v2 |
| Q4 | Bulk generation | C — Hybrid: sync for N ≤ 20, queued BullMQ for larger | Preserves single-student snappiness; avoids Next.js timeout on class-level batches |
| Q5 | Transcript workflow | A — Full `GENERATED → VERIFIED → ISSUED` state machine | Matches Ghana SHS registrar practice; fields already in schema; transcripts carry legal weight |
| Q6 | PDF caching | D — Type-specific: cache ID cards + ISSUED transcripts + report cards; don't cache transcript drafts | Matches data's actual immutability; storage is cheap; hit rate is high |

Out of scope for v1 (future iterations):
- Public-facing QR URL (parent/staff scan → web profile)
- Signed JWT in QR for tamper-proofing
- Configurable ID card templates per school
- `annual-report-card.tsx` PDF wiring (template exists; defer until demand signal)
- Parent portal access to PDFs (Tier 2 #6 Parent Portal upgrade)
- Automated pre-render on term-finalization (generate all report cards nightly)
- Email delivery of PDFs to guardians
- Watermarking, signatures, or e-stamps

---

## 3. Architecture

**Three PDF products, one shared infrastructure.**

```
src/lib/pdf/
  generator.ts               (existing — reuse unchanged)
  qr.ts                      (new — thin wrapper over `qrcode` npm package)
  assets/                    (new — placeholder silhouette for missing photo)
  components/
    letterhead.tsx           (new — shared school-branded header)
    photo.tsx                (new — photo resolution chain embedded in a <View>)
  templates/
    report-card.tsx          (existing — reused as-is, wire to PDF endpoint)
    annual-report-card.tsx   (existing — deferred to v2)
    id-card.tsx              (new — single-sheet front+back layout)
    transcript.tsx           (new)
```

**Module layout**:
- `src/modules/student/actions/id-card.action.ts` — new module file
- `src/modules/academics/actions/transcript.action.ts` — extended with render/verify/issue/batch
- `src/modules/academics/actions/report-card.action.ts` — extended with render PDF + batch
- `src/modules/common/pdf-job.action.ts` — shared batch-job infrastructure
- `src/workers/pdf-batch.worker.ts` — new BullMQ worker

**Sync vs. async threshold**: `PDF_SYNC_THRESHOLD = 20` constant in `src/lib/pdf/generator.ts`. Single-student actions are always sync. Bulk actions are sync when N ≤ 20, enqueue a `PdfJob` otherwise. The UI polls the `PdfJob` row every 3 seconds while status ∈ {QUEUED, RUNNING}.

**Caching model** (type-specific):
- **ID cards**: column on `Student`. Invalidated on photo change or current-enrollment change. 1-to-1 with student
- **Report cards**: separate `ReportCardPdfCache` table keyed by `(studentId, termId)`. Invalidated when term results change for that student/term
- **Transcripts**: `pdfKey` column on `Transcript`, populated only when status transitions to `ISSUED`. Pre-ISSUED renders are inline, uncached (drafts may change during verification)

**Photo resolution chain** (ID card only):
1. `Student.photoUrl` if set
2. Most recent VERIFIED `StudentDocument` where `documentType.name = "Passport Photo"`
3. Bundled placeholder silhouette

**Delivery**: all cached PDFs stored in R2 via existing `uploadFile(key, body, contentType)` from `src/lib/storage/r2.ts`. Retrieval via existing `/api/files/[key]` signed-URL proxy. Uncached renders stream the PDF directly in the response body.

**New dependencies**: `qrcode` (Node-side QR image generation — outputs data URL for `@react-pdf/renderer`'s `<Image>` component).

**Permissions** (new):
- `STUDENTS_ID_CARD_GENERATE` — single + batch ID cards. Granted to admin + class teacher roles
- `TRANSCRIPTS_GENERATE` — generate / re-render drafts. Granted to registrar + admin
- `TRANSCRIPTS_VERIFY` — move GENERATED → VERIFIED. Granted to academic master + admin
- `TRANSCRIPTS_ISSUE` — move VERIFIED → ISSUED; freeze + cache PDF. Granted to headmaster
- `REPORT_CARDS_GENERATE` — generate / re-render report cards. Granted to class teacher + admin

---

## 4. Data Model

### Columns added to existing models

**`Student`** (`prisma/schema/student.prisma`):
```prisma
  idCardPdfKey             String?
  idCardCachedAt           DateTime?
  idCardCacheInvalidatedAt DateTime?
```

**`Transcript`**:
```prisma
  pdfKey    String?
  issuedBy  String?
  issuedAt  DateTime?
```

### New table — `ReportCardPdfCache`

One row per `(studentId, termId)`:

```prisma
model ReportCardPdfCache {
  id            String    @id @default(cuid())
  schoolId      String
  studentId     String
  termId        String
  fileKey       String
  renderedAt    DateTime  @default(now())
  renderedBy    String
  invalidatedAt DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  school  School  @relation("SchoolReportCardCache", fields: [schoolId], references: [id], onDelete: Cascade)
  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  term    Term    @relation(fields: [termId], references: [id], onDelete: Cascade)

  @@unique([studentId, termId])
  @@index([schoolId])
  @@index([termId])
  @@index([invalidatedAt])
}
```

### New table — `PdfJob` (generic batch tracker)

```prisma
model PdfJob {
  id             String       @id @default(cuid())
  schoolId       String
  kind           PdfJobKind
  status         PdfJobStatus @default(QUEUED)
  params         Json
  totalItems     Int
  completedItems Int          @default(0)
  resultFileKey  String?
  error          String?
  requestedBy    String
  requestedAt    DateTime     @default(now())
  startedAt      DateTime?
  completedAt    DateTime?

  school School @relation("SchoolPdfJob", fields: [schoolId], references: [id], onDelete: Cascade)

  @@index([schoolId])
  @@index([status])
  @@index([requestedBy])
  @@index([schoolId, status])
}

enum PdfJobKind {
  ID_CARD_BATCH
  REPORT_CARD_BATCH
  TRANSCRIPT_BATCH
}

enum PdfJobStatus {
  QUEUED
  RUNNING
  COMPLETE
  FAILED
  CANCELLED
}
```

### Inverse relations to add

- `School` — `reportCardPdfCaches`, `pdfJobs`
- `Student` — `reportCardPdfCaches`
- `Term` — `reportCardPdfCaches`

### Cache invalidation (code-level, not schema)

A cached PDF is "stale" when `invalidatedAt > renderedAt` (or when no cache row exists). The generate-or-cache helper in each action:
1. Check cache freshness
2. Fresh → return signed URL from stored `fileKey`
3. Stale or missing → render, upload to R2, upsert cache row (or update cache column), return signed URL

Invalidation callers (three existing actions gain one-line hooks):
- `updateStudentAction` — if input changes `photoUrl`, set `Student.idCardCacheInvalidatedAt = now()` in same update
- Enrollment mutations (promotion commit, manual class arm change) — set `idCardCacheInvalidatedAt` on each affected student
- Mark / TerminalResult / SubjectResult mutations — call shared `invalidateReportCardCacheAction({ studentId, termId })` at tail

---

## 5. Server Actions

All new actions: `requireSchoolContext` + `assertPermission` + `audit`. School-scoped in every query.

### ID Cards — `src/modules/student/actions/id-card.action.ts` (new)

- `renderStudentIdCardAction(studentId)` — single-student, sync. Permission: `STUDENTS_ID_CARD_GENERATE`. Cache-aware (returns signed URL when fresh; re-renders when stale; uploads fresh PDF on miss)
- `renderClassIdCardsAction({ classArmId })` — bulk dispatcher. N ≤ 20 → sync stitched PDF returned inline. N > 20 → enqueues `PdfJob(kind=ID_CARD_BATCH)`, returns `{ jobId }`

### Transcripts — extend `src/modules/academics/actions/transcript.action.ts`

- `renderTranscriptPdfAction(transcriptId)` — render any status. Permission: `TRANSCRIPTS_GENERATE`. Returns cached signed URL when ISSUED + `pdfKey` set; renders inline for pre-ISSUED states (no cache write)
- `verifyTranscriptAction({ transcriptId, notes? })` — `GENERATED → VERIFIED`. Permission: `TRANSCRIPTS_VERIFY`. Sets `verifiedBy`, `verifiedAt`. Audit
- `issueTranscriptAction(transcriptId)` — `VERIFIED → ISSUED`. Permission: `TRANSCRIPTS_ISSUE`. Renders PDF, uploads to R2, sets `pdfKey`, `issuedBy`, `issuedAt`. Audit
- `renderBatchTranscriptsAction({ academicYearId, yearGroup? })` — bulk dispatcher (same sync/queue rule as ID cards)

No REJECTED state in v1 (existing schema doesn't model it). A rejected draft is deleted and regenerated.

### Report Cards — extend `src/modules/academics/actions/report-card.action.ts`

- `renderReportCardPdfAction({ studentId, termId })` — single-student, sync. Permission: `REPORT_CARDS_GENERATE`. Uses existing `generateReportCardDataAction` for the JSON payload, then existing `report-card.tsx` template. Cache-aware via `ReportCardPdfCache`
- `renderClassReportCardsPdfAction({ classArmId, termId })` — bulk dispatcher (same sync/queue rule)
- `invalidateReportCardCacheAction({ studentId, termId })` — internal helper; sets `ReportCardPdfCache.invalidatedAt = now()` if row exists. Idempotent. Called from any action that mutates that student's term results

### PDF Jobs — `src/modules/common/pdf-job.action.ts` (new)

- `listPdfJobsAction({ status?, kind?, limit = 20 })` — scoped to current user, plus global for admins
- `getPdfJobAction(jobId)` — single job detail for progress polling
- `cancelPdfJobAction(jobId)` — refuses RUNNING; QUEUED → CANCELLED

### Worker — `src/workers/pdf-batch.worker.ts` (new)

Subscribes to new BullMQ queue `QUEUE_NAMES.PDF_BATCH`. On job pickup:
1. `PdfJob.status = RUNNING`, `startedAt = now()`
2. Branch on `kind`: iterate target students, call the single-student render action per entity, increment `completedItems`, stitch result
3. Upload stitched PDF to R2 → `resultFileKey`
4. On success: `COMPLETE`, `completedAt`. On failure: `FAILED`, `error`

Nightly cleanup: a scheduled action moves RUNNING jobs older than 1 hour to FAILED with "Worker timed out" (deferred if no scheduler exists).

---

## 6. UI

### Student profile — new "Academic" tab (index 2)

File: `src/app/(dashboard)/students/[id]/academic-section.tsx`

- **Current enrollment card** — class arm, programme, year, boarding status
- **Report cards list** — rows per term with Download button (calls `renderReportCardPdfAction`)
- **Transcripts list** — existing `Transcript` rows with status badge + verify/issue/download actions, gated by permissions
- **ID card panel** — thumbnail + Download + Regenerate buttons

Permission gating via `usePermissions()` — matches Documents tab pattern.

### Class-arm detail page — bulk actions

Add two buttons:
- "Print class ID cards" → `renderClassIdCardsAction`
- "Print class report cards (pick term)" → `renderClassReportCardsPdfAction`

Sync response → browser download. Async response (`{ jobId }`) → link to Generations tray.

### Generations tray — `/pdf-jobs`

File: `src/app/(dashboard)/pdf-jobs/page.tsx`

- Table: Kind | Requested | Status | Progress | Actions
- Active rows poll `getPdfJobAction` every 3s
- COMPLETE rows show Download button (signed URL from `resultFileKey`)
- QUEUED rows show Cancel button
- FAILED rows show error + Retry button

### Transcript verification dialog

Shared between the student profile tab and any admin transcript listing:
- `GENERATED` rows: View PDF, "Submit for verification" (no-op — GENERATED is the starting state; verifier action is `verifyTranscriptAction`)
- Verifiers see: Verify button (optional notes textarea) → one-click
- Issuers see on VERIFIED: Issue button with confirmation text "Once issued, the transcript is frozen"
- Issued rows: Download Final PDF (cached)

### QR rendering

`src/lib/pdf/qr.ts`:
```ts
export async function generateQrDataUrl(text: string): Promise<string>
```

Returns a `data:image/png;base64,...` string that the ID card template embeds via react-pdf's `<Image src={...} />`.

---

## 7. Error Handling & Edge Cases

**Missing photo** → fall back through photoUrl → vault VERIFIED "Passport Photo" → placeholder silhouette. Render always succeeds.

**Missing enrollment** → action returns `{ error: "Student has no active enrollment" }`.

**Transcript with no terminal results** → existing action rejects with "No terminal results found"; error propagates to PDF action.

**QR generation failure** → render card without QR + warning, log to audit metadata.

**R2 upload failure** (cache write) → return the PDF inline in the response anyway. Don't set cache column. Log to audit with `{ cacheUploadFailed: true }`. Next request retries.

**Cached R2 object gone** → signed URL 404s. v1: user clicks Regenerate to force re-render. Defer HEAD-check-before-redirect to v2 if observed in practice.

**Concurrent batch jobs** (user double-clicks) → both jobs queued, both run. No dedup in v1. Add guard in v2 if it causes noise.

**Worker crash mid-job** → BullMQ retries per its default policy. Stale RUNNING jobs > 1 hour cleaned up by nightly task → FAILED with timeout error.

**Cancel race** (QUEUED → RUNNING between poll and click) → server refuses cancel on RUNNING; UI disables button when status flips.

**Mark correction after term-end** → `invalidateReportCardCacheAction` called from the mutating action → next download re-renders with corrected data.

**Photo change after card distributed** → `idCardCacheInvalidatedAt` set → next download re-renders. Physical card unchanged (requires reprint).

**Permission denial mid-workflow** → server rejects with `{ error: "Unauthorized" }`; UI gates via `usePermissions()` for matching button visibility.

**Transcript data shifts between GENERATED and ISSUED** → verifier reviews current data at verify-time. If stale, reject + regenerate. Once ISSUED, PDF is frozen (cached); new transcript for different data creates a new Transcript row.

**Promotion wizard commit** → `commitPromotionRunAction` sets `idCardCacheInvalidatedAt` for every affected student. Existing hook, already landed in promotion wizard. This design extends the same hook.

---

## 8. Testing Strategy

**Unit tests** (TDD with `prismaMock` + `r2` mock from existing setup):

- `tests/unit/students/id-card.test.ts` — fresh render + R2 upload + cache-col set; cached return (no re-render); stale re-render; missing enrollment; photo fallback chain (3 scenarios); QR failure graceful; bulk dispatcher (≤20 sync, >20 queued)
- `tests/unit/academics/transcript-pdf.test.ts` — verify state transitions; issue state transition + PDF cache; render-on-draft inline vs ISSUED cached; permission denial per gate; batch dispatcher
- `tests/unit/academics/report-card-pdf.test.ts` — fresh render upserts cache row; cached fresh returns URL; stale re-renders; `invalidateReportCardCacheAction` sets `invalidatedAt`; bulk dispatcher
- `tests/unit/common/pdf-job.test.ts` — list filters; get scoping; cancel QUEUED / refuse RUNNING
- Cache invalidation hooks (in existing unit test files): `updateStudentAction` photoUrl → invalidate; `commitPromotionRunAction` → invalidate per-student; Mark mutations → invalidate report card cache

**Integration** (`tests/integration/students/pdf-products.test.ts`, covered by existing `vitest.students.config.ts`):
- Seed student + photo → `renderStudentIdCardAction` twice → assert first writes R2+column, second hits cache
- Seed student + term results → `renderReportCardPdfAction` → assert `ReportCardPdfCache` row. Mutate `SubjectResult`, call invalidation, re-render → assert row updated
- Seed transcript → `verifyTranscriptAction` → `issueTranscriptAction` → assert ISSUED + `pdfKey` set

**Worker test** — optional for v1; if covered, enqueue test job manually, run worker, assert COMPLETE + `resultFileKey`. Otherwise manual QA.

**Visual verification** (manual per `verification-before-completion`):
- Render 3 sample PDFs; eyeball layouts
- Scan ID card QR → confirm decodes to raw `studentId` string
- Batch 50 ID cards → open in Acrobat, check print size

**Guardrail**: every mutating action calls `audit()`. Satisfies `tests/unit/guardrails/audit-coverage.test.ts`.

---

## 9. Critical Files

**New**
- `src/lib/pdf/qr.ts`
- `src/lib/pdf/assets/placeholder-photo.png`
- `src/lib/pdf/components/letterhead.tsx`
- `src/lib/pdf/components/photo.tsx`
- `src/lib/pdf/templates/id-card.tsx`
- `src/lib/pdf/templates/transcript.tsx`
- `src/modules/student/actions/id-card.action.ts`
- `src/modules/common/pdf-job.action.ts`
- `src/workers/pdf-batch.worker.ts`
- `src/app/(dashboard)/students/[id]/academic-section.tsx`
- `src/app/(dashboard)/pdf-jobs/page.tsx` + client
- `tests/unit/students/id-card.test.ts`
- `tests/unit/academics/transcript-pdf.test.ts`
- `tests/unit/academics/report-card-pdf.test.ts`
- `tests/unit/common/pdf-job.test.ts`
- `tests/integration/students/pdf-products.test.ts`

**Extended**
- `prisma/schema/student.prisma` — columns on `Student`; columns on `Transcript`; new `ReportCardPdfCache` and `PdfJob` models; enums
- `prisma/schema/school.prisma` — inverse relations
- `prisma/schema/academic.prisma` — inverse relation on `Term`
- `src/lib/permissions.ts` — 5 new permissions + role grants
- `src/lib/queue.ts` (or equivalent) — add `QUEUE_NAMES.PDF_BATCH`
- `src/modules/academics/actions/transcript.action.ts` — render/verify/issue/batch
- `src/modules/academics/actions/report-card.action.ts` — render/batch/invalidate
- `src/modules/student/actions/student.action.ts` — `updateStudentAction` sets `idCardCacheInvalidatedAt` on photo change
- `src/modules/student/actions/promotion.action.ts` — `commitPromotionRunAction` invalidates ID cards per student
- Mark / TerminalResult / SubjectResult actions — call `invalidateReportCardCacheAction` at tail
- `src/app/(dashboard)/students/[id]/student-profile.tsx` — add Academic tab at index 2

**Reused (no changes)**
- `src/lib/pdf/generator.ts` — `@react-pdf/renderer` wrapper
- `src/lib/pdf/templates/report-card.tsx` — existing template
- `src/lib/storage/r2.ts` — `uploadFile`, `getSignedDownloadUrl`, `deleteFile`
- `/api/files/[key]` GET route
- BullMQ worker harness + existing queue pattern
- `src/lib/audit.ts`
- Existing `generateReportCardDataAction`, `generateTranscriptAction`

---

## 10. Verification Plan

When implementation lands:
1. `npx prisma migrate dev --name add_student_pdf_products`
2. `npm test -- id-card transcript-pdf report-card-pdf pdf-job` — unit suite green
3. `npm run test:students` — integration green
4. `npm run dev` → walk UI:
   - Upload a photo → download ID card (fresh render, R2 upload). Re-download → same URL returned (cached). Change photo → download again → new render
   - Seed a term + generate report card → download (fresh). Correct a mark → re-download (re-rendered)
   - Generate a transcript → verify → issue → download (ISSUED cached PDF)
5. Class-level: print 15-student class ID cards (sync) + 50-student class ID cards (queued). Watch Generations tray update from QUEUED → RUNNING → COMPLETE
6. QR scan on physical phone → confirm raw `studentId` string
7. Permission gates: class teacher role → can generate report cards; no Verify/Issue buttons visible. Registrar → can generate/verify transcripts but not issue
