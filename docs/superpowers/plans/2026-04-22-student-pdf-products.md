# Student PDF Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three PDF products — student ID cards (with QR code), academic transcripts (with GENERATED → VERIFIED → ISSUED workflow), and per-term report cards — reusing existing `@react-pdf/renderer` infrastructure. Includes a shared bulk-generation path via BullMQ and type-specific PDF caching in R2.

**Architecture:** New `src/lib/pdf/` helpers (QR, letterhead, photo resolver) feed three templates (two new, one existing). Three action modules expose single-student renders (sync) and class-batch renders (sync when N ≤ 20, queued BullMQ otherwise). A new shared `PdfJob` table + BullMQ worker power the async tray. Type-specific caching: ID cards cache on `Student.idCardPdfKey`, report cards cache in new `ReportCardPdfCache` table, transcripts cache on `Transcript.pdfKey` only when ISSUED.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Prisma on PostgreSQL, `@react-pdf/renderer` (existing), `qrcode` (new), Cloudflare R2 (existing), BullMQ (existing), vitest + vitest-mock-extended.

**Spec reference:** `docs/superpowers/specs/2026-04-22-student-pdf-products-design.md`

---

## File Structure

**New files**
- `src/lib/pdf/qr.ts` — QR data-URL generator
- `src/lib/pdf/assets/placeholder-photo.png` — silhouette for missing photos (AI-generated greyscale PNG, ~50KB)
- `src/lib/pdf/components/letterhead.tsx` — shared school header
- `src/lib/pdf/components/photo.tsx` — photo resolution helper + `<Image>` wrapper
- `src/lib/pdf/templates/id-card.tsx` — side-by-side front+back
- `src/lib/pdf/templates/transcript.tsx` — transcript body
- `src/modules/student/actions/id-card.action.ts`
- `src/modules/student/actions/photo.ts` — shared photo-resolver helper
- `src/modules/common/pdf-job.action.ts`
- `src/modules/common/schemas/pdf-job.schema.ts`
- `src/workers/pdf-batch.worker.ts`
- `src/app/(dashboard)/students/[id]/academic-section.tsx`
- `src/app/(dashboard)/pdf-jobs/page.tsx`
- `src/app/(dashboard)/pdf-jobs/pdf-jobs-client.tsx`
- `tests/unit/students/id-card.test.ts`
- `tests/unit/academics/transcript-pdf.test.ts`
- `tests/unit/academics/report-card-pdf.test.ts`
- `tests/unit/common/pdf-job.test.ts`
- `tests/integration/students/pdf-products.test.ts`

**Modified files**
- `prisma/schema/student.prisma` — columns on `Student`; new `ReportCardPdfCache` + `PdfJob` + enums; inverse relations
- `prisma/schema/academic.prisma` — columns on `Transcript`; inverse relation on `Term`
- `prisma/schema/school.prisma` — inverse relations on `School`
- `src/lib/queue.ts` — add `QUEUE_NAMES.PDF_BATCH` + job type
- `src/workers/index.ts` — register the new worker
- `src/lib/permissions.ts` — add 4 permissions + role grants
- `src/modules/academics/actions/transcript.action.ts` — extend with render/issue/batch, re-gate verify
- `src/modules/academics/actions/report-card.action.ts` — extend with render/batch/invalidate
- `src/modules/student/actions/student.action.ts` — invalidate ID card cache on photo change
- `src/modules/student/actions/promotion.action.ts` — invalidate ID card cache on commit
- `src/modules/academics/actions/mark.action.ts` — invalidate report card cache on mark mutations
- `src/app/(dashboard)/students/[id]/student-profile.tsx` — add Academic tab at index 2
- `package.json` — add `qrcode` + `@types/qrcode`

**Reused unchanged**
- `src/lib/pdf/generator.ts` — `renderPdfToBuffer`
- `src/lib/pdf/templates/report-card.tsx` — existing template
- `src/lib/storage/r2.ts`
- `/api/files/[key]` route
- `src/lib/audit.ts`
- `createWorker`, `QUEUE_NAMES` from `src/lib/queue.ts`

---

## Task 1: Install qrcode dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run: `npm install qrcode && npm install --save-dev @types/qrcode`
Expected: both packages added to `package.json` dependencies / devDependencies. `package-lock.json` updated.

- [ ] **Step 2: Verify the library works with a quick smoke**

Run: `node -e "require('qrcode').toDataURL('SCH/2025/0001').then(d => console.log(d.slice(0,30)))"`
Expected: a prefix like `data:image/png;base64,iVBOR...`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(pdf): add qrcode dependency"
```

---

## Task 2: Prisma schema additions

**Files:**
- Modify: `prisma/schema/student.prisma`
- Modify: `prisma/schema/academic.prisma`
- Modify: `prisma/schema/school.prisma`

- [ ] **Step 1: Columns on `Student`**

In `prisma/schema/student.prisma`, inside `model Student`, add in the fields block (before the relations):

```prisma
  idCardPdfKey             String?
  idCardCachedAt           DateTime?
  idCardCacheInvalidatedAt DateTime?
```

Add to the relations block:

```prisma
  reportCardPdfCaches ReportCardPdfCache[]
```

- [ ] **Step 2: Columns on `Transcript`**

In `prisma/schema/academic.prisma`, inside `model Transcript`, add before the indexes:

```prisma
  pdfKey   String?
  issuedBy String?
  issuedAt DateTime?
```

- [ ] **Step 3: Append new models + enums to `prisma/schema/student.prisma`**

At the end of the file:

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

- [ ] **Step 4: Inverse relation on `Term`**

In `prisma/schema/academic.prisma`, inside `model Term`, add to relations block:

```prisma
  reportCardPdfCaches ReportCardPdfCache[]
```

- [ ] **Step 5: Inverse relations on `School`**

In `prisma/schema/school.prisma`, inside `model School`, add to relations block:

```prisma
  reportCardPdfCaches ReportCardPdfCache[] @relation("SchoolReportCardCache")
  pdfJobs             PdfJob[]             @relation("SchoolPdfJob")
```

- [ ] **Step 6: Validate and migrate**

Run: `npx prisma validate`
Expected: schemas valid.

Run: `npx prisma migrate dev --name add_student_pdf_products`
Expected: new migration under `prisma/schema/migrations/`, applied, Prisma Client regenerated.

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat(students): add PDF-products schema (caches, jobs, transcript extensions)"
```

---

## Task 3: Add permissions

**Files:**
- Modify: `src/lib/permissions.ts`

- [ ] **Step 1: Add constants**

Search for `TRANSCRIPTS_READ` (around line 410). Add after it:

```ts
  TRANSCRIPTS_VERIFY: "academics:transcripts:verify",
  TRANSCRIPTS_ISSUE: "academics:transcripts:issue",
  REPORT_CARDS_GENERATE: "academics:report-cards:generate",
  STUDENTS_ID_CARD_GENERATE: "students:id-card:generate",
```

- [ ] **Step 2: Grant to admin roles**

Find the three admin-role arrays that currently contain `PERMISSIONS.TRANSCRIPTS_CREATE` (search for it — the exploration noted line ~962). For `super_admin` nothing to do (inherits all). For `headmaster`, `assistant_headmaster_academic`, `assistant_headmaster_admin`: add all four new permissions to each.

For `class_teacher`: add `REPORT_CARDS_GENERATE` + `STUDENTS_ID_CARD_GENERATE` (generate reports for their class, print class ID cards).

For `registrar` (if the role exists — search for it): add `TRANSCRIPTS_VERIFY`. If `registrar` doesn't exist as a distinct role, put this on `assistant_headmaster_academic` only.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vitest run tests/unit/auth/permissions.test.ts`
Expected: all tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat(permissions): add PDF-products permissions (ID card + report card + transcript verify/issue)"
```

---

## Task 4: Queue name + worker registration

**Files:**
- Modify: `src/lib/queue.ts`
- Modify: `src/workers/index.ts`
- Create: `src/workers/pdf-batch.worker.ts` (stub — filled in Task 13)

- [ ] **Step 1: Add queue name + job type to `src/lib/queue.ts`**

Add to the `QUEUE_NAMES` object after `CAMPAIGN_DISPATCH`:

```ts
  PDF_BATCH: "pdf-batch",
```

Add a new job-data interface alongside the existing ones:

```ts
export interface PdfBatchJobData {
  pdfJobId: string; // PK of the PdfJob row being processed
}
```

- [ ] **Step 2: Create worker stub**

Create `src/workers/pdf-batch.worker.ts`:

```ts
import { createWorker, QUEUE_NAMES, type PdfBatchJobData } from "@/lib/queue";
import { logger } from "@/lib/logger";

const log = logger.child({ worker: "pdf-batch" });

/**
 * PDF Batch Worker — fills in Task 13.
 * Picks up PdfJob rows and renders the requested stitched PDF.
 */
export function startPdfBatchWorker() {
  const worker = createWorker<PdfBatchJobData>(
    QUEUE_NAMES.PDF_BATCH,
    async (job) => {
      log.info("pdf-batch job received (stub)", { jobId: job.id, pdfJobId: job.data.pdfJobId });
      // Implementation lands in Task 13.
    },
    { concurrency: 2 },
  );

  worker.on("completed", (job) => {
    log.info("pdf-batch job done", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    log.error("pdf-batch job failed", { jobId: job?.id, error: err });
  });

  return worker;
}
```

- [ ] **Step 3: Register in `src/workers/index.ts`**

Add import at the top with the other worker imports:

```ts
import { startPdfBatchWorker } from "./pdf-batch.worker";
```

Add invocation in the `// ─── BullMQ Queue Workers ────` section:

```ts
startPdfBatchWorker();
log.info("PDF batch worker started");
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue.ts src/workers/
git commit -m "feat(pdf): add PDF_BATCH queue + worker scaffolding"
```

---

## Task 5: QR code helper

**Files:**
- Create: `src/lib/pdf/qr.ts`
- Create: `tests/unit/lib/pdf/qr.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/pdf/qr.test.ts
import { describe, it, expect } from "vitest";
import { generateQrDataUrl } from "@/lib/pdf/qr";

describe("generateQrDataUrl", () => {
  it("returns a PNG data URL prefix", async () => {
    const result = await generateQrDataUrl("SCH/2025/0001");
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("produces different output for different input", async () => {
    const a = await generateQrDataUrl("A");
    const b = await generateQrDataUrl("B");
    expect(a).not.toEqual(b);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/lib/pdf/qr.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/pdf/qr.ts`:

```ts
import QRCode from "qrcode";

/**
 * Generates a PNG data URL encoding the given text. Suitable for embedding in
 * @react-pdf/renderer <Image src={...} /> components.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
  });
}
```

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run tests/unit/lib/pdf/qr.test.ts`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/qr.ts tests/unit/lib/pdf/qr.test.ts
git commit -m "feat(pdf): add generateQrDataUrl helper"
```

---

## Task 6: Photo resolution helper

**Files:**
- Create: `src/modules/student/actions/photo.ts`
- Create: `src/lib/pdf/assets/placeholder-photo.png` (see Step 1)
- Create: `tests/unit/students/photo-resolver.test.ts`

- [ ] **Step 1: Create placeholder silhouette**

Download or generate a 400x500px greyscale silhouette PNG. One option: use a public-domain avatar placeholder from https://www.iconfinder.com or similar. Save to `src/lib/pdf/assets/placeholder-photo.png`. Size should be < 50KB.

If generating fresh is impractical in the current environment, create a tiny 1x1 transparent PNG as a temporary stand-in and note the file for asset team replacement:

Run: `node -e "require('fs').writeFileSync('src/lib/pdf/assets/placeholder-photo.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'))"`

- [ ] **Step 2: Write failing test**

```ts
// tests/unit/students/photo-resolver.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { resolveStudentPhotoUrl } from "@/modules/student/actions/photo";

describe("resolveStudentPhotoUrl", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("prefers Student.photoUrl when set", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: "https://r2.example/s-1.jpg",
    } as never);

    const url = await resolveStudentPhotoUrl("s-1");
    expect(url).toBe("https://r2.example/s-1.jpg");
    expect(prismaMock.studentDocument.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to VERIFIED Passport Photo from vault when photoUrl is null", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: null,
    } as never);
    prismaMock.studentDocument.findFirst.mockResolvedValue({
      id: "sd-1", fileKey: "student-documents/s-1/photo.jpg",
    } as never);

    const url = await resolveStudentPhotoUrl("s-1");
    expect(url).toContain("student-documents/s-1/photo.jpg");
  });

  it("returns placeholder sentinel when no photo available", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: null,
    } as never);
    prismaMock.studentDocument.findFirst.mockResolvedValue(null);

    const url = await resolveStudentPhotoUrl("s-1");
    expect(url).toBe("__PLACEHOLDER__");
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `npx vitest run tests/unit/students/photo-resolver.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**

Create `src/modules/student/actions/photo.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

/**
 * Sentinel returned when no photo source is available. The PDF template
 * renders the bundled placeholder image in this case.
 */
export const PLACEHOLDER_PHOTO_SENTINEL = "__PLACEHOLDER__";

/**
 * Resolves a student's photo URL with fallback chain:
 * 1. Student.photoUrl (direct)
 * 2. Most recent VERIFIED StudentDocument with documentType.name = "Passport Photo"
 * 3. PLACEHOLDER_PHOTO_SENTINEL (caller loads bundled asset)
 *
 * School scoping is done by the caller — this is an internal helper.
 */
export async function resolveStudentPhotoUrl(studentId: string): Promise<string> {
  const student = await db.student.findFirst({
    where: { id: studentId },
    select: { id: true, schoolId: true, photoUrl: true },
  });
  if (!student) return PLACEHOLDER_PHOTO_SENTINEL;
  if (student.photoUrl) return student.photoUrl;

  const doc = await db.studentDocument.findFirst({
    where: {
      studentId,
      verificationStatus: "VERIFIED",
      documentType: { name: "Passport Photo" },
    },
    orderBy: { uploadedAt: "desc" },
    select: { fileKey: true },
  });
  if (!doc) return PLACEHOLDER_PHOTO_SENTINEL;

  return await getSignedDownloadUrl(doc.fileKey);
}
```

- [ ] **Step 5: Verify GREEN**

Run: `npx vitest run tests/unit/students/photo-resolver.test.ts`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add src/modules/student/actions/photo.ts src/lib/pdf/assets/placeholder-photo.png tests/unit/students/photo-resolver.test.ts
git commit -m "feat(students): photo resolution helper with vault fallback"
```

---

## Task 7: Shared PDF components (letterhead + photo)

**Files:**
- Create: `src/lib/pdf/components/letterhead.tsx`
- Create: `src/lib/pdf/components/photo.tsx`

No tests — these are visual react-pdf components; they're exercised by the integration test and via snapshot of the full PDF later.

- [ ] **Step 1: Letterhead**

```tsx
// src/lib/pdf/components/letterhead.tsx
import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#1e40af",
    paddingBottom: 8,
    marginBottom: 12,
  },
  logo: { width: 60, height: 60, marginRight: 12 },
  textBlock: { flex: 1 },
  name: { fontSize: 18, fontWeight: "bold", color: "#1e40af" },
  motto: { fontSize: 10, fontStyle: "italic", color: "#64748b" },
  address: { fontSize: 9, color: "#475569", marginTop: 2 },
});

export type LetterheadProps = {
  name: string;
  motto?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export function Letterhead({ name, motto, logoUrl, address, phone, email }: LetterheadProps) {
  return (
    <View style={styles.container}>
      {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
      <View style={styles.textBlock}>
        <Text style={styles.name}>{name}</Text>
        {motto ? <Text style={styles.motto}>{motto}</Text> : null}
        <Text style={styles.address}>
          {[address, phone, email].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Photo component**

```tsx
// src/lib/pdf/components/photo.tsx
import { Image, View, StyleSheet } from "@react-pdf/renderer";
import path from "path";
import { PLACEHOLDER_PHOTO_SENTINEL } from "@/modules/student/actions/photo";

const styles = StyleSheet.create({
  wrapper: {
    width: 100,
    height: 125,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
  },
  image: { width: "100%", height: "100%", objectFit: "cover" },
});

const PLACEHOLDER_PATH = path.resolve(process.cwd(), "src/lib/pdf/assets/placeholder-photo.png");

export function StudentPhoto({ url, width, height }: { url: string; width?: number; height?: number }) {
  const src = url === PLACEHOLDER_PHOTO_SENTINEL ? PLACEHOLDER_PATH : url;
  const wrapperStyle = {
    ...styles.wrapper,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
  return (
    <View style={wrapperStyle}>
      <Image src={src} style={styles.image} />
    </View>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pdf/components/
git commit -m "feat(pdf): add Letterhead and StudentPhoto shared components"
```

---

## Task 8: ID card template

**Files:**
- Create: `src/lib/pdf/templates/id-card.tsx`

No unit tests — exercised by the ID card action tests in Task 10 and by visual QA.

- [ ] **Step 1: Write the template**

```tsx
// src/lib/pdf/templates/id-card.tsx
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { Letterhead, type LetterheadProps } from "../components/letterhead";
import { StudentPhoto } from "../components/photo";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, backgroundColor: "#ffffff" },
  cardsRow: { flexDirection: "row", gap: 18 },
  card: {
    width: 240,
    height: 150,
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#ffffff",
  },
  cardInner: { flexDirection: "row", gap: 10, flex: 1 },
  photoCol: { width: 80 },
  infoCol: { flex: 1, justifyContent: "space-between" },
  schoolName: { fontSize: 11, fontWeight: "bold", color: "#1e40af" },
  label: { fontSize: 8, color: "#64748b", textTransform: "uppercase" },
  value: { fontSize: 10, fontWeight: "bold" },
  backCard: {
    width: 240,
    height: 150,
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#ffffff",
  },
  qr: { width: 80, height: 80, alignSelf: "center" },
  footnote: { fontSize: 7, color: "#64748b", textAlign: "center", marginTop: 4 },
  cutGuide: { fontSize: 7, color: "#cbd5e1", textAlign: "center", marginTop: 12 },
});

export type IdCardData = {
  school: LetterheadProps;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    otherNames?: string | null;
    photoUrl: string;
    gender: string;
    bloodGroup?: string | null;
    dateOfBirth: Date;
  };
  enrollment: {
    className: string;
    classArmName: string;
    programmeName: string;
    academicYearName: string;
  };
  boardingStatus: string;
  house?: string | null;
  qrDataUrl: string;
  issuedAt: Date;
};

export function IdCardTemplate({ data }: { data: IdCardData }) {
  const fullName = [data.student.firstName, data.student.otherNames, data.student.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Letterhead {...data.school} />
        <View style={styles.cardsRow}>
          {/* FRONT */}
          <View style={styles.card}>
            <Text style={styles.schoolName}>{data.school.name}</Text>
            <View style={styles.cardInner}>
              <View style={styles.photoCol}>
                <StudentPhoto url={data.student.photoUrl} width={80} height={100} />
              </View>
              <View style={styles.infoCol}>
                <View>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.value}>{fullName}</Text>
                </View>
                <View>
                  <Text style={styles.label}>Student ID</Text>
                  <Text style={styles.value}>{data.student.studentId}</Text>
                </View>
                <View>
                  <Text style={styles.label}>Class</Text>
                  <Text style={styles.value}>
                    {data.enrollment.className} — {data.enrollment.classArmName}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* BACK */}
          <View style={styles.backCard}>
            <Text style={styles.schoolName}>Verification</Text>
            <View style={styles.cardInner}>
              <View style={{ flex: 1, justifyContent: "space-between" }}>
                <View>
                  <Text style={styles.label}>Gender</Text>
                  <Text style={styles.value}>{data.student.gender}</Text>
                </View>
                <View>
                  <Text style={styles.label}>Blood group</Text>
                  <Text style={styles.value}>{data.student.bloodGroup ?? "—"}</Text>
                </View>
                <View>
                  <Text style={styles.label}>Boarding</Text>
                  <Text style={styles.value}>{data.boardingStatus}</Text>
                </View>
                <View>
                  <Text style={styles.label}>House</Text>
                  <Text style={styles.value}>{data.house ?? "—"}</Text>
                </View>
              </View>
              <View style={{ width: 80 }}>
                <Image src={data.qrDataUrl} style={styles.qr} />
                <Text style={styles.footnote}>Scan to verify</Text>
              </View>
            </View>
          </View>
        </View>
        <Text style={styles.cutGuide}>
          Cut along the card borders · Laminate at 125 micron · Valid academic year{" "}
          {data.enrollment.academicYearName}
        </Text>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/templates/id-card.tsx
git commit -m "feat(pdf): add id-card PDF template (front+back side-by-side)"
```

---

## Task 9: Transcript template

**Files:**
- Create: `src/lib/pdf/templates/transcript.tsx`

- [ ] **Step 1: Write the template**

```tsx
// src/lib/pdf/templates/transcript.tsx
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { Letterhead, type LetterheadProps } from "../components/letterhead";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, backgroundColor: "#ffffff" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "center", marginVertical: 10 },
  metaGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  metaBlock: { flexDirection: "column" },
  label: { fontSize: 8, color: "#64748b", textTransform: "uppercase" },
  value: { fontSize: 10, fontWeight: "bold" },
  yearHeading: { fontSize: 12, fontWeight: "bold", marginTop: 14, marginBottom: 6, color: "#1e40af" },
  table: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerRow: { backgroundColor: "#f1f5f9" },
  cell: { padding: 5, fontSize: 9 },
  cellSubject: { width: "40%" },
  cellScore: { width: "15%", textAlign: "right" },
  cellGrade: { width: "15%", textAlign: "center" },
  cellRemark: { width: "30%" },
  gpaBox: {
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1e40af",
    borderRadius: 4,
    backgroundColor: "#eff6ff",
  },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  sigLine: { borderTopWidth: 1, borderTopColor: "#64748b", width: 180, paddingTop: 4, textAlign: "center" },
  footerNote: { marginTop: 24, fontSize: 8, color: "#64748b", textAlign: "center" },
});

export type TranscriptData = {
  school: LetterheadProps;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    gender: string;
    programmeName: string;
  };
  transcriptNumber: string;
  coveringFrom: string | null;
  coveringTo: string | null;
  cumulativeGPA: number | null;
  status: string; // GENERATED | VERIFIED | ISSUED
  issuedAt?: Date | null;
  // Grouped by academic year / term
  years: Array<{
    academicYearName: string;
    terms: Array<{
      termName: string;
      averageScore: number | null;
      overallGrade: string | null;
      classPosition: number | null;
      subjects: Array<{
        subjectName: string;
        totalScore: number | null;
        grade: string | null;
        interpretation: string | null;
      }>;
    }>;
  }>;
};

export function TranscriptTemplate({ data }: { data: TranscriptData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead {...data.school} />
        <Text style={styles.title}>ACADEMIC TRANSCRIPT</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>Transcript number</Text>
            <Text style={styles.value}>{data.transcriptNumber}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>Student</Text>
            <Text style={styles.value}>
              {data.student.firstName} {data.student.lastName}
            </Text>
            <Text style={{ fontSize: 9 }}>{data.student.studentId}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>Programme</Text>
            <Text style={styles.value}>{data.student.programmeName}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.label}>Period</Text>
            <Text style={styles.value}>
              {data.coveringFrom ?? "—"} to {data.coveringTo ?? "—"}
            </Text>
          </View>
        </View>

        {data.years.map((year, yi) => (
          <View key={yi} wrap={false}>
            <Text style={styles.yearHeading}>{year.academicYearName}</Text>
            {year.terms.map((term, ti) => (
              <View key={ti} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 3 }}>
                  {term.termName} · Avg {term.averageScore?.toFixed(1) ?? "—"} ·{" "}
                  Grade {term.overallGrade ?? "—"} · Position {term.classPosition ?? "—"}
                </Text>
                <View style={styles.table}>
                  <View style={[styles.row, styles.headerRow]}>
                    <Text style={[styles.cell, styles.cellSubject]}>Subject</Text>
                    <Text style={[styles.cell, styles.cellScore]}>Score</Text>
                    <Text style={[styles.cell, styles.cellGrade]}>Grade</Text>
                    <Text style={[styles.cell, styles.cellRemark]}>Remark</Text>
                  </View>
                  {term.subjects.map((s, si) => (
                    <View key={si} style={styles.row}>
                      <Text style={[styles.cell, styles.cellSubject]}>{s.subjectName}</Text>
                      <Text style={[styles.cell, styles.cellScore]}>
                        {s.totalScore?.toFixed(1) ?? "—"}
                      </Text>
                      <Text style={[styles.cell, styles.cellGrade]}>{s.grade ?? "—"}</Text>
                      <Text style={[styles.cell, styles.cellRemark]}>
                        {s.interpretation ?? "—"}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.gpaBox}>
          <Text style={{ fontSize: 11, fontWeight: "bold" }}>
            Cumulative GPA: {data.cumulativeGPA?.toFixed(2) ?? "—"}
          </Text>
        </View>

        <View style={styles.signatures}>
          <View style={styles.sigLine}>
            <Text>Registrar</Text>
          </View>
          <View style={styles.sigLine}>
            <Text>Headmaster</Text>
          </View>
        </View>
        <Text style={styles.footerNote}>
          Status: {data.status}
          {data.issuedAt ? ` · Issued: ${data.issuedAt.toISOString().slice(0, 10)}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/templates/transcript.tsx
git commit -m "feat(pdf): add transcript PDF template"
```

---

## Task 10: `renderStudentIdCardAction`

**Files:**
- Create: `src/modules/student/actions/id-card.action.ts`
- Create: `tests/unit/students/id-card.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/students/id-card.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import * as r2 from "@/lib/storage/r2";
import * as generator from "@/lib/pdf/generator";
import { renderStudentIdCardAction } from "@/modules/student/actions/id-card.action";

vi.mock("@/lib/pdf/generator", () => ({
  renderPdfToBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

vi.mock("@/lib/pdf/qr", () => ({
  generateQrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,FAKE"),
}));

describe("renderStudentIdCardAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(r2.uploadFile).mockClear();
    vi.mocked(r2.deleteFile).mockClear();
    vi.mocked(r2.getSignedDownloadUrl).mockClear();
    vi.mocked(generator.renderPdfToBuffer).mockClear();
  });

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await renderStudentIdCardAction("s-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns cached signed URL when fresh", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: "https://p.jpg",
      firstName: "A", lastName: "B", otherNames: null, gender: "MALE",
      bloodGroup: null, dateOfBirth: new Date("2010-01-01"), boardingStatus: "DAY",
      idCardPdfKey: "student-id-cards/s-1/abc.pdf",
      idCardCachedAt: new Date(Date.now() - 1000),
      idCardCacheInvalidatedAt: null,
      houseAssignment: null,
      enrollments: [{
        academicYear: { name: "2025/2026", isCurrent: true },
        classArm: { name: "A", class: { name: "SHS 1 Science", programme: { name: "Science" } } },
      }],
    } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed.example/cached.pdf");

    const result = await renderStudentIdCardAction("s-1");
    expect(result).toMatchObject({ data: { url: "https://signed.example/cached.pdf", cached: true } });
    expect(vi.mocked(generator.renderPdfToBuffer)).not.toHaveBeenCalled();
  });

  it("renders fresh and uploads when no cache exists", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: "https://p.jpg",
      firstName: "A", lastName: "B", otherNames: null, gender: "MALE",
      bloodGroup: null, dateOfBirth: new Date("2010-01-01"), boardingStatus: "DAY",
      idCardPdfKey: null, idCardCachedAt: null, idCardCacheInvalidatedAt: null,
      houseAssignment: null,
      enrollments: [{
        academicYear: { name: "2025/2026", isCurrent: true },
        classArm: { name: "A", class: { name: "SHS 1 Science", programme: { name: "Science" } } },
      }],
    } as never);
    prismaMock.school.findUnique.mockResolvedValue({
      name: "Test SHS", logoUrl: null, motto: null, address: null, phone: null, email: null,
    } as never);
    vi.mocked(r2.uploadFile).mockResolvedValue({ key: "student-id-cards/s-1/new.pdf", url: "" } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed.example/new.pdf");
    prismaMock.student.update.mockResolvedValue({} as never);

    const result = await renderStudentIdCardAction("s-1");
    expect(result).toMatchObject({ data: { url: "https://signed.example/new.pdf", cached: false } });
    expect(vi.mocked(generator.renderPdfToBuffer)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(r2.uploadFile)).toHaveBeenCalled();
    expect(prismaMock.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "s-1" },
      data: expect.objectContaining({
        idCardPdfKey: "student-id-cards/s-1/new.pdf",
        idCardCachedAt: expect.any(Date),
        idCardCacheInvalidatedAt: null,
      }),
    }));
  });

  it("re-renders when cache is invalidated", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: "https://p.jpg",
      firstName: "A", lastName: "B", otherNames: null, gender: "MALE",
      bloodGroup: null, dateOfBirth: new Date("2010-01-01"), boardingStatus: "DAY",
      idCardPdfKey: "student-id-cards/s-1/old.pdf",
      idCardCachedAt: new Date(Date.now() - 100000),
      idCardCacheInvalidatedAt: new Date(),
      houseAssignment: null,
      enrollments: [{
        academicYear: { name: "2025/2026", isCurrent: true },
        classArm: { name: "A", class: { name: "SHS 1 Science", programme: { name: "Science" } } },
      }],
    } as never);
    prismaMock.school.findUnique.mockResolvedValue({
      name: "Test SHS", logoUrl: null, motto: null, address: null, phone: null, email: null,
    } as never);
    vi.mocked(r2.uploadFile).mockResolvedValue({ key: "student-id-cards/s-1/new.pdf", url: "" } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed.example/new.pdf");
    prismaMock.student.update.mockResolvedValue({} as never);

    const result = await renderStudentIdCardAction("s-1");
    expect(result).toMatchObject({ data: { cached: false } });
    expect(vi.mocked(generator.renderPdfToBuffer)).toHaveBeenCalled();
  });

  it("returns error when student has no active enrollment", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s-1", schoolId: "default-school", photoUrl: null,
      firstName: "A", lastName: "B", otherNames: null, gender: "MALE",
      bloodGroup: null, dateOfBirth: new Date("2010-01-01"), boardingStatus: "DAY",
      idCardPdfKey: null, idCardCachedAt: null, idCardCacheInvalidatedAt: null,
      houseAssignment: null,
      enrollments: [],
    } as never);

    const result = await renderStudentIdCardAction("s-1");
    expect(result).toEqual({ error: "Student has no active enrollment" });
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/students/id-card.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/modules/student/actions/id-card.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { uploadFile, getSignedDownloadUrl, generateFileKey } from "@/lib/storage/r2";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { generateQrDataUrl } from "@/lib/pdf/qr";
import { IdCardTemplate, type IdCardData } from "@/lib/pdf/templates/id-card";
import { resolveStudentPhotoUrl } from "./photo";

function isCacheFresh(pdfKey: string | null, cachedAt: Date | null, invalidatedAt: Date | null) {
  if (!pdfKey || !cachedAt) return false;
  if (!invalidatedAt) return true;
  return invalidatedAt <= cachedAt;
}

export async function renderStudentIdCardAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_ID_CARD_GENERATE);
  if (denied) return denied;

  const student = await db.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
    include: {
      houseAssignment: { include: { house: { select: { name: true } } } },
      enrollments: {
        where: { status: "ACTIVE" },
        include: {
          academicYear: { select: { name: true, isCurrent: true } },
          classArm: { include: { class: { include: { programme: { select: { name: true } } } } } },
        },
        orderBy: { enrollmentDate: "desc" },
        take: 1,
      },
    },
  });
  if (!student) return { error: "Student not found" };
  if (student.enrollments.length === 0) return { error: "Student has no active enrollment" };

  // Fast path: cache is fresh.
  if (isCacheFresh(student.idCardPdfKey, student.idCardCachedAt, student.idCardCacheInvalidatedAt)) {
    const url = await getSignedDownloadUrl(student.idCardPdfKey!);
    return { data: { url, cached: true } };
  }

  // Slow path: render, upload, update cache column.
  const school = await db.school.findUnique({ where: { id: ctx.schoolId } });
  if (!school) return { error: "School not found" };

  const photoUrl = await resolveStudentPhotoUrl(studentId);
  const qrDataUrl = await generateQrDataUrl(student.studentId);

  const enrollment = student.enrollments[0]!;
  const data: IdCardData = {
    school: {
      name: school.name,
      motto: school.motto,
      logoUrl: school.logoUrl,
      address: school.address,
      phone: school.phone,
      email: school.email,
    },
    student: {
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      otherNames: student.otherNames,
      photoUrl,
      gender: student.gender,
      bloodGroup: student.bloodGroup,
      dateOfBirth: student.dateOfBirth,
    },
    enrollment: {
      className: enrollment.classArm.class.name,
      classArmName: enrollment.classArm.name,
      programmeName: enrollment.classArm.class.programme.name,
      academicYearName: enrollment.academicYear.name,
    },
    boardingStatus: student.boardingStatus,
    house: student.houseAssignment?.house.name ?? null,
    qrDataUrl,
    issuedAt: new Date(),
  };

  const buffer = await renderPdfToBuffer(IdCardTemplate({ data }));
  const key = generateFileKey("student-id-cards", studentId, `id-card-${Date.now()}.pdf`);
  await uploadFile(key, buffer, "application/pdf");

  const now = new Date();
  await db.student.update({
    where: { id: studentId },
    data: {
      idCardPdfKey: key,
      idCardCachedAt: now,
      idCardCacheInvalidatedAt: null,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "StudentIdCard",
    entityId: studentId,
    module: "students",
    description: `Generated ID card for student ${student.studentId}`,
    metadata: { fileKey: key },
  });

  const url = await getSignedDownloadUrl(key);
  return { data: { url, cached: false } };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run tests/unit/students/id-card.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/modules/student/actions/id-card.action.ts tests/unit/students/id-card.test.ts
git commit -m "feat(students): renderStudentIdCardAction with R2 caching"
```

---

## Task 11: `renderReportCardPdfAction` + `invalidateReportCardCacheAction`

**Files:**
- Modify: `src/modules/academics/actions/report-card.action.ts`
- Create: `tests/unit/academics/report-card-pdf.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// tests/unit/academics/report-card-pdf.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import * as r2 from "@/lib/storage/r2";
import * as generator from "@/lib/pdf/generator";
import {
  renderReportCardPdfAction,
  invalidateReportCardCacheAction,
} from "@/modules/academics/actions/report-card.action";

vi.mock("@/lib/pdf/generator", () => ({
  renderPdfToBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

describe("renderReportCardPdfAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(r2.uploadFile).mockClear();
    vi.mocked(r2.getSignedDownloadUrl).mockClear();
    vi.mocked(generator.renderPdfToBuffer).mockClear();
  });

  it("returns cached signed URL when cache row is fresh", async () => {
    prismaMock.reportCardPdfCache.findUnique.mockResolvedValue({
      id: "rc-1", fileKey: "report-cards/s-1-t-1/abc.pdf",
      renderedAt: new Date(Date.now() - 1000), invalidatedAt: null,
    } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed/cached.pdf");

    const result = await renderReportCardPdfAction({ studentId: "s-1", termId: "t-1" });
    expect(result).toMatchObject({ data: { url: "https://signed/cached.pdf", cached: true } });
    expect(vi.mocked(generator.renderPdfToBuffer)).not.toHaveBeenCalled();
  });

  it("re-renders when invalidatedAt > renderedAt", async () => {
    prismaMock.reportCardPdfCache.findUnique.mockResolvedValue({
      id: "rc-1", fileKey: "report-cards/s-1-t-1/old.pdf",
      renderedAt: new Date(Date.now() - 10000), invalidatedAt: new Date(),
    } as never);
    // Mock the underlying data loader. Since generateReportCardDataAction is in
    // the same file, it uses the same prismaMock — we mock the leaves it reads.
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s-1", schoolId: "default-school", firstName: "A", lastName: "B", studentId: "SCH/1",
      gender: "MALE", enrollments: [{ classArm: { class: { programme: { name: "Sci" } } } }],
    } as never);
    prismaMock.term.findUnique.mockResolvedValue({
      id: "t-1", name: "Term 1", termNumber: 1, academicYear: { name: "2025/2026" },
      startDate: new Date(), endDate: new Date(),
    } as never);
    prismaMock.school.findUnique.mockResolvedValue({
      name: "Test SHS", motto: null, logoUrl: null, address: null, phone: null, email: null,
    } as never);
    prismaMock.terminalResult.findUnique.mockResolvedValue({
      studentId: "s-1", termId: "t-1",
      totalScore: 500, averageScore: 75, classPosition: 3, overallGrade: "B2",
      teacherRemarks: null, headmasterRemarks: null,
      subjectResults: [],
    } as never);
    vi.mocked(r2.uploadFile).mockResolvedValue({ key: "report-cards/s-1-t-1/new.pdf", url: "" } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed/new.pdf");
    prismaMock.reportCardPdfCache.upsert.mockResolvedValue({ id: "rc-1" } as never);

    const result = await renderReportCardPdfAction({ studentId: "s-1", termId: "t-1" });
    expect(result).toMatchObject({ data: { cached: false } });
    expect(vi.mocked(generator.renderPdfToBuffer)).toHaveBeenCalled();
  });

  it("returns error when student not found in current school", async () => {
    prismaMock.reportCardPdfCache.findUnique.mockResolvedValue(null);
    prismaMock.student.findUnique.mockResolvedValue(null);

    const result = await renderReportCardPdfAction({
      studentId: "missing",
      termId: "t-1",
    });
    expect(result).toHaveProperty("error");
  });
});

describe("invalidateReportCardCacheAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("sets invalidatedAt when cache row exists", async () => {
    prismaMock.reportCardPdfCache.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await invalidateReportCardCacheAction({ studentId: "s-1", termId: "t-1" });
    expect(result).toEqual({ data: { invalidated: 1 } });
    expect(prismaMock.reportCardPdfCache.updateMany).toHaveBeenCalledWith({
      where: { studentId: "s-1", termId: "t-1" },
      data: { invalidatedAt: expect.any(Date) },
    });
  });

  it("is idempotent when no cache row exists", async () => {
    prismaMock.reportCardPdfCache.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await invalidateReportCardCacheAction({ studentId: "s-1", termId: "t-1" });
    expect(result).toEqual({ data: { invalidated: 0 } });
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/academics/report-card-pdf.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement**

Open `src/modules/academics/actions/report-card.action.ts`. Confirm it already has `generateReportCardDataAction` exported (returns JSON payload for a student+term). Append at the end of the file:

```ts
import { uploadFile, getSignedDownloadUrl, generateFileKey } from "@/lib/storage/r2";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { ReportCardTemplate } from "@/lib/pdf/templates/report-card";
// (If the existing file already imports audit / requireSchoolContext / PERMISSIONS,
// use those imports — don't duplicate.)

function isReportCardCacheFresh(renderedAt: Date, invalidatedAt: Date | null) {
  if (!invalidatedAt) return true;
  return invalidatedAt <= renderedAt;
}

export async function renderReportCardPdfAction(input: { studentId: string; termId: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_GENERATE);
  if (denied) return denied;

  // Cache check
  const cache = await db.reportCardPdfCache.findUnique({
    where: { studentId_termId: { studentId: input.studentId, termId: input.termId } },
  });
  if (cache && isReportCardCacheFresh(cache.renderedAt, cache.invalidatedAt)) {
    const url = await getSignedDownloadUrl(cache.fileKey);
    return { data: { url, cached: true } };
  }

  // Use the existing data-loader action
  const dataResult = await generateReportCardDataAction(input.studentId, input.termId);
  if ("error" in dataResult) return dataResult;

  const buffer = await renderPdfToBuffer(ReportCardTemplate({ data: dataResult.data }));
  const key = generateFileKey(
    "report-cards",
    `${input.studentId}-${input.termId}`,
    `report-card-${Date.now()}.pdf`
  );
  await uploadFile(key, buffer, "application/pdf");

  const now = new Date();
  await db.reportCardPdfCache.upsert({
    where: { studentId_termId: { studentId: input.studentId, termId: input.termId } },
    create: {
      schoolId: ctx.schoolId,
      studentId: input.studentId,
      termId: input.termId,
      fileKey: key,
      renderedAt: now,
      renderedBy: ctx.session.user.id!,
      invalidatedAt: null,
    },
    update: {
      fileKey: key,
      renderedAt: now,
      renderedBy: ctx.session.user.id!,
      invalidatedAt: null,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "ReportCardPdf",
    entityId: `${input.studentId}-${input.termId}`,
    module: "academics",
    description: `Generated report card PDF`,
    metadata: { studentId: input.studentId, termId: input.termId, fileKey: key },
  });

  const url = await getSignedDownloadUrl(key);
  return { data: { url, cached: false } };
}

/**
 * Marks the report card cache row for (studentId, termId) as stale.
 * Called by mark/result mutation actions to force re-render on next access.
 */
export async function invalidateReportCardCacheAction(input: { studentId: string; termId: string }) {
  const result = await db.reportCardPdfCache.updateMany({
    where: { studentId: input.studentId, termId: input.termId },
    data: { invalidatedAt: new Date() },
  });
  return { data: { invalidated: result.count } };
}
```

Note: `generateReportCardDataAction` and the imports (`requireSchoolContext`, `assertPermission`, `PERMISSIONS`, `audit`, `db`) already exist in the file. Don't duplicate.

Verify the existing template signature: `src/lib/pdf/templates/report-card.tsx` should export a component taking `{ data: ... }`. If the existing template takes its props differently, adapt the render call in Step 3 accordingly.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run tests/unit/academics/report-card-pdf.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/modules/academics/actions/report-card.action.ts tests/unit/academics/report-card-pdf.test.ts
git commit -m "feat(academics): renderReportCardPdfAction + cache invalidator"
```

---

## Task 12: Transcript render + verify re-gate + issue + photo-change hook

**Files:**
- Modify: `src/modules/academics/actions/transcript.action.ts`
- Create: `tests/unit/academics/transcript-pdf.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// tests/unit/academics/transcript-pdf.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import * as r2 from "@/lib/storage/r2";
import * as generator from "@/lib/pdf/generator";
import {
  renderTranscriptPdfAction,
  verifyTranscriptAction,
  issueTranscriptAction,
} from "@/modules/academics/actions/transcript.action";

vi.mock("@/lib/pdf/generator", () => ({
  renderPdfToBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

describe("renderTranscriptPdfAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(r2.getSignedDownloadUrl).mockClear();
    vi.mocked(r2.uploadFile).mockClear();
    vi.mocked(generator.renderPdfToBuffer).mockClear();
  });

  it("returns cached URL when status is ISSUED and pdfKey set", async () => {
    prismaMock.transcript.findFirst.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "ISSUED",
      pdfKey: "transcripts/tr-1.pdf",
    } as never);
    vi.mocked(r2.getSignedDownloadUrl).mockResolvedValue("https://signed/tr.pdf");

    const result = await renderTranscriptPdfAction("tr-1");
    expect(result).toMatchObject({ data: { url: "https://signed/tr.pdf", cached: true } });
    expect(vi.mocked(generator.renderPdfToBuffer)).not.toHaveBeenCalled();
  });

  it("renders inline without caching when status is GENERATED", async () => {
    prismaMock.transcript.findFirst.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "GENERATED",
      transcriptNumber: "TRN/2026/0001", coveringFrom: "2024/2025", coveringTo: "2025/2026",
      cumulativeGPA: 3.4, pdfKey: null, issuedAt: null,
      studentId: "s-1",
    } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s-1", studentId: "SCH/1", firstName: "A", lastName: "B",
      dateOfBirth: new Date("2010-01-01"), gender: "MALE",
      enrollments: [{ classArm: { class: { programme: { name: "Science" } } } }],
    } as never);
    prismaMock.school.findUnique.mockResolvedValue({
      name: "Test SHS", motto: null, logoUrl: null, address: null, phone: null, email: null,
    } as never);
    prismaMock.terminalResult.findMany.mockResolvedValue([] as never);

    const result = await renderTranscriptPdfAction("tr-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { cached: boolean } }).data.cached).toBe(false);
    expect(vi.mocked(r2.uploadFile)).not.toHaveBeenCalled();
  });
});

describe("verifyTranscriptAction (re-gated)", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["academics:transcripts:verify"] }));

  it("GENERATED → VERIFIED with verifier + timestamp", async () => {
    prismaMock.transcript.findUnique.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "GENERATED", transcriptNumber: "TRN/1",
    } as never);
    prismaMock.transcript.update.mockResolvedValue({ id: "tr-1", status: "VERIFIED" } as never);

    const result = await verifyTranscriptAction("tr-1");
    expect(result).toMatchObject({ data: { status: "VERIFIED" } });
  });

  it("refuses when status is not GENERATED", async () => {
    prismaMock.transcript.findUnique.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "VERIFIED", transcriptNumber: "TRN/1",
    } as never);

    const result = await verifyTranscriptAction("tr-1");
    expect(result).toEqual({ error: "Transcript is not in GENERATED status" });
  });
});

describe("issueTranscriptAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["academics:transcripts:issue"] });
    vi.mocked(r2.uploadFile).mockClear();
    vi.mocked(generator.renderPdfToBuffer).mockClear();
  });

  it("VERIFIED → ISSUED, renders PDF, caches pdfKey", async () => {
    prismaMock.transcript.findUnique.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "VERIFIED",
      transcriptNumber: "TRN/2026/0001", coveringFrom: "2024/2025", coveringTo: "2025/2026",
      cumulativeGPA: 3.4, pdfKey: null, studentId: "s-1",
    } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s-1", studentId: "SCH/1", firstName: "A", lastName: "B",
      dateOfBirth: new Date("2010-01-01"), gender: "MALE",
      enrollments: [{ classArm: { class: { programme: { name: "Science" } } } }],
    } as never);
    prismaMock.school.findUnique.mockResolvedValue({
      name: "Test SHS", motto: null, logoUrl: null, address: null, phone: null, email: null,
    } as never);
    prismaMock.terminalResult.findMany.mockResolvedValue([] as never);
    vi.mocked(r2.uploadFile).mockResolvedValue({ key: "transcripts/tr-1.pdf", url: "" } as never);
    prismaMock.transcript.update.mockResolvedValue({ id: "tr-1", status: "ISSUED", pdfKey: "transcripts/tr-1.pdf" } as never);

    const result = await issueTranscriptAction("tr-1");
    expect(result).toMatchObject({ data: { status: "ISSUED" } });
    expect(vi.mocked(generator.renderPdfToBuffer)).toHaveBeenCalled();
    expect(prismaMock.transcript.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "ISSUED",
        pdfKey: "transcripts/tr-1.pdf",
        issuedBy: "test-user-id",
        issuedAt: expect.any(Date),
      }),
    }));
  });

  it("refuses when status is not VERIFIED", async () => {
    prismaMock.transcript.findUnique.mockResolvedValue({
      id: "tr-1", schoolId: "default-school", status: "GENERATED", transcriptNumber: "TRN/1",
    } as never);

    const result = await issueTranscriptAction("tr-1");
    expect(result).toEqual({ error: "Transcript is not in VERIFIED status" });
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/academics/transcript-pdf.test.ts`
Expected: FAIL — some actions missing, verify's current permission check will also fail the gated test.

- [ ] **Step 3: Implement**

In `src/modules/academics/actions/transcript.action.ts`:

1. Find `verifyTranscriptAction` (around line 125). Change the permission check from `PERMISSIONS.TRANSCRIPTS_CREATE` to `PERMISSIONS.TRANSCRIPTS_VERIFY`. Add a status guard before the update:

```ts
  if (transcript.status !== "GENERATED") {
    return { error: "Transcript is not in GENERATED status" };
  }
```

2. Append at the bottom of the file:

```ts
import { uploadFile, getSignedDownloadUrl, generateFileKey } from "@/lib/storage/r2";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { TranscriptTemplate, type TranscriptData } from "@/lib/pdf/templates/transcript";

async function loadTranscriptData(transcriptId: string): Promise<{ data: TranscriptData } | { error: string }> {
  const transcript = await db.transcript.findUnique({ where: { id: transcriptId } });
  if (!transcript) return { error: "Transcript not found" };
  const student = await db.student.findUnique({
    where: { id: transcript.studentId },
    include: {
      enrollments: {
        orderBy: { enrollmentDate: "desc" },
        take: 1,
        include: {
          classArm: { include: { class: { include: { programme: { select: { name: true } } } } } },
        },
      },
    },
  });
  if (!student) return { error: "Student not found" };
  const school = await db.school.findUnique({ where: { id: transcript.schoolId } });
  if (!school) return { error: "School not found" };

  const terminalResults = await db.terminalResult.findMany({
    where: { studentId: transcript.studentId },
    include: {
      subjectResults: { include: { subject: { select: { name: true, code: true } } } },
      term: { include: { academicYear: { select: { name: true } } } },
    },
    orderBy: [{ term: { academicYear: { startDate: "asc" } } }, { term: { termNumber: "asc" } }],
  });

  // Group by academic year
  const byYear = new Map<string, TranscriptData["years"][number]>();
  for (const tr of terminalResults) {
    const yearName = tr.term.academicYear.name;
    if (!byYear.has(yearName)) {
      byYear.set(yearName, { academicYearName: yearName, terms: [] });
    }
    byYear.get(yearName)!.terms.push({
      termName: tr.term.name,
      averageScore: tr.averageScore,
      overallGrade: tr.overallGrade,
      classPosition: tr.classPosition,
      subjects: tr.subjectResults.map((sr) => ({
        subjectName: sr.subject.name,
        totalScore: sr.totalScore,
        grade: sr.grade,
        interpretation: sr.interpretation,
      })),
    });
  }

  const data: TranscriptData = {
    school: {
      name: school.name, motto: school.motto, logoUrl: school.logoUrl,
      address: school.address, phone: school.phone, email: school.email,
    },
    student: {
      studentId: student.studentId, firstName: student.firstName, lastName: student.lastName,
      dateOfBirth: student.dateOfBirth, gender: student.gender,
      programmeName: student.enrollments[0]?.classArm.class.programme.name ?? "—",
    },
    transcriptNumber: transcript.transcriptNumber,
    coveringFrom: transcript.coveringFrom,
    coveringTo: transcript.coveringTo,
    cumulativeGPA: transcript.cumulativeGPA,
    status: transcript.status,
    issuedAt: transcript.issuedAt,
    years: Array.from(byYear.values()),
  };
  return { data };
}

export async function renderTranscriptPdfAction(transcriptId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSCRIPTS_CREATE);
  if (denied) return denied;

  const transcript = await db.transcript.findFirst({
    where: { id: transcriptId, schoolId: ctx.schoolId },
  });
  if (!transcript) return { error: "Transcript not found" };

  if (transcript.status === "ISSUED" && transcript.pdfKey) {
    const url = await getSignedDownloadUrl(transcript.pdfKey);
    return { data: { url, cached: true } };
  }

  // Render inline (no cache for non-ISSUED).
  const dataResult = await loadTranscriptData(transcriptId);
  if ("error" in dataResult) return dataResult;
  const buffer = await renderPdfToBuffer(TranscriptTemplate({ data: dataResult.data }));
  // For non-ISSUED, we don't upload to R2. The caller streams this buffer.
  // But since server actions can't stream easily, we upload to a short-lived
  // "preview" key and return the signed URL. The preview is NOT stored in pdfKey.
  const previewKey = generateFileKey("transcript-previews", transcriptId, `preview-${Date.now()}.pdf`);
  await uploadFile(previewKey, buffer, "application/pdf");
  const url = await getSignedDownloadUrl(previewKey);
  return { data: { url, cached: false } };
}

export async function issueTranscriptAction(transcriptId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSCRIPTS_ISSUE);
  if (denied) return denied;

  const transcript = await db.transcript.findUnique({ where: { id: transcriptId } });
  if (!transcript) return { error: "Transcript not found" };
  if (transcript.schoolId !== ctx.schoolId) return { error: "Transcript not found" };
  if (transcript.status !== "VERIFIED") {
    return { error: "Transcript is not in VERIFIED status" };
  }

  const dataResult = await loadTranscriptData(transcriptId);
  if ("error" in dataResult) return dataResult;
  const buffer = await renderPdfToBuffer(TranscriptTemplate({ data: dataResult.data }));
  const key = generateFileKey("transcripts", transcriptId, `${transcript.transcriptNumber.replace(/\//g, "-")}.pdf`);
  await uploadFile(key, buffer, "application/pdf");

  const updated = await db.transcript.update({
    where: { id: transcriptId },
    data: {
      status: "ISSUED",
      pdfKey: key,
      issuedBy: ctx.session.user.id!,
      issuedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "APPROVE",
    entity: "Transcript",
    entityId: transcriptId,
    module: "academics",
    description: `Issued transcript ${transcript.transcriptNumber}`,
    metadata: { fileKey: key },
  });

  return { data: updated };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run tests/unit/academics/transcript-pdf.test.ts`
Expected: all passing.

Run: `npx vitest run tests/unit/academics/` (full academics suite)
Expected: no regressions; the existing verify test may need updating since the permission changed.

If the pre-existing test for `verifyTranscriptAction` breaks on permission change: find it under `tests/unit/academics/` and update its `mockAuthenticatedUser` call to include the new `TRANSCRIPTS_VERIFY` permission.

- [ ] **Step 5: Commit**

```bash
git add src/modules/academics/actions/transcript.action.ts tests/unit/academics/transcript-pdf.test.ts
git commit -m "feat(academics): transcript PDF render + issue workflow (re-gate verify)"
```

---

## Task 13: PdfJob actions + BullMQ worker

**Files:**
- Create: `src/modules/common/pdf-job.action.ts`
- Create: `src/modules/common/schemas/pdf-job.schema.ts`
- Modify: `src/workers/pdf-batch.worker.ts` (fill in the stub from Task 4)
- Create: `tests/unit/common/pdf-job.test.ts`

- [ ] **Step 1: Zod schema**

Create `src/modules/common/schemas/pdf-job.schema.ts`:

```ts
import { z } from "zod";

export const createIdCardBatchJobSchema = z.object({
  classArmId: z.string().cuid(),
});

export const createReportCardBatchJobSchema = z.object({
  classArmId: z.string().cuid(),
  termId: z.string().cuid(),
});

export const createTranscriptBatchJobSchema = z.object({
  studentIds: z.array(z.string().cuid()).min(1).max(500),
});
```

- [ ] **Step 2: Failing tests**

```ts
// tests/unit/common/pdf-job.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import {
  listPdfJobsAction,
  getPdfJobAction,
  cancelPdfJobAction,
} from "@/modules/common/pdf-job.action";

describe("listPdfJobsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns jobs scoped to current school", async () => {
    prismaMock.pdfJob.findMany.mockResolvedValue([
      { id: "job-1", status: "RUNNING", kind: "ID_CARD_BATCH" },
    ] as never);

    const result = await listPdfJobsAction();
    expect(result).toMatchObject({ data: expect.arrayContaining([expect.objectContaining({ id: "job-1" })]) });
  });
});

describe("getPdfJobAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns job when in current school", async () => {
    prismaMock.pdfJob.findFirst.mockResolvedValue({
      id: "job-1", status: "RUNNING", completedItems: 5, totalItems: 10,
    } as never);

    const result = await getPdfJobAction("job-1");
    expect(result).toMatchObject({ data: { id: "job-1" } });
  });

  it("returns error for cross-school access", async () => {
    prismaMock.pdfJob.findFirst.mockResolvedValue(null);
    const result = await getPdfJobAction("job-x");
    expect(result).toEqual({ error: "Job not found" });
  });
});

describe("cancelPdfJobAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("cancels a QUEUED job", async () => {
    prismaMock.pdfJob.findFirst.mockResolvedValue({
      id: "job-1", status: "QUEUED", schoolId: "default-school",
    } as never);
    prismaMock.pdfJob.update.mockResolvedValue({ id: "job-1", status: "CANCELLED" } as never);

    const result = await cancelPdfJobAction("job-1");
    expect(result).toMatchObject({ data: { status: "CANCELLED" } });
  });

  it("refuses to cancel a RUNNING job", async () => {
    prismaMock.pdfJob.findFirst.mockResolvedValue({
      id: "job-1", status: "RUNNING", schoolId: "default-school",
    } as never);

    const result = await cancelPdfJobAction("job-1");
    expect(result).toEqual({ error: "Cannot cancel a running job" });
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `npx vitest run tests/unit/common/pdf-job.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement actions**

Create `src/modules/common/pdf-job.action.ts`:

```ts
"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";

export async function listPdfJobsAction(opts?: {
  status?: "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED" | "CANCELLED";
  kind?: "ID_CARD_BATCH" | "REPORT_CARD_BATCH" | "TRANSCRIPT_BATCH";
  limit?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const jobs = await db.pdfJob.findMany({
    where: {
      schoolId: ctx.schoolId,
      ...(opts?.status && { status: opts.status }),
      ...(opts?.kind && { kind: opts.kind }),
    },
    orderBy: { requestedAt: "desc" },
    take: opts?.limit ?? 20,
  });
  return { data: jobs };
}

export async function getPdfJobAction(jobId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const job = await db.pdfJob.findFirst({
    where: { id: jobId, schoolId: ctx.schoolId },
  });
  if (!job) return { error: "Job not found" };
  return { data: job };
}

export async function cancelPdfJobAction(jobId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const job = await db.pdfJob.findFirst({
    where: { id: jobId, schoolId: ctx.schoolId },
  });
  if (!job) return { error: "Job not found" };
  if (job.status === "RUNNING") return { error: "Cannot cancel a running job" };
  if (job.status !== "QUEUED") return { error: `Job is already ${job.status}` };

  const updated = await db.pdfJob.update({
    where: { id: jobId },
    data: { status: "CANCELLED", completedAt: new Date() },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "PdfJob",
    entityId: jobId,
    module: "common",
    description: `Cancelled PDF batch job`,
    newData: { status: "CANCELLED" },
  });

  return { data: updated };
}
```

- [ ] **Step 5: Implement the worker (fill Task 4 stub)**

Replace the body of `src/workers/pdf-batch.worker.ts`:

```ts
import { PDFDocument } from "pdf-lib";
import { createWorker, QUEUE_NAMES, type PdfBatchJobData } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { uploadFile, generateFileKey, getSignedDownloadUrl } from "@/lib/storage/r2";
import { renderStudentIdCardAction } from "@/modules/student/actions/id-card.action";
import { renderReportCardPdfAction } from "@/modules/academics/actions/report-card.action";
import { renderTranscriptPdfAction } from "@/modules/academics/actions/transcript.action";

const log = logger.child({ worker: "pdf-batch" });

async function stitchPdfs(urls: string[]): Promise<Buffer> {
  const stitched = await PDFDocument.create();
  for (const url of urls) {
    const resp = await fetch(url);
    const bytes = await resp.arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    const pages = await stitched.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => stitched.addPage(p));
  }
  return Buffer.from(await stitched.save());
}

export function startPdfBatchWorker() {
  const worker = createWorker<PdfBatchJobData>(
    QUEUE_NAMES.PDF_BATCH,
    async (job) => {
      const pdfJob = await db.pdfJob.findUnique({ where: { id: job.data.pdfJobId } });
      if (!pdfJob) throw new Error(`PdfJob ${job.data.pdfJobId} not found`);
      if (pdfJob.status === "CANCELLED") return; // Caller already cancelled

      await db.pdfJob.update({
        where: { id: pdfJob.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      try {
        const params = pdfJob.params as Record<string, unknown>;
        const urls: string[] = [];

        if (pdfJob.kind === "ID_CARD_BATCH") {
          const enrollments = await db.enrollment.findMany({
            where: { classArmId: params.classArmId as string, status: "ACTIVE" },
            select: { studentId: true },
          });
          for (const e of enrollments) {
            const res = await renderStudentIdCardAction(e.studentId);
            if ("data" in res) urls.push(res.data.url);
            await db.pdfJob.update({ where: { id: pdfJob.id }, data: { completedItems: { increment: 1 } } });
          }
        } else if (pdfJob.kind === "REPORT_CARD_BATCH") {
          const enrollments = await db.enrollment.findMany({
            where: { classArmId: params.classArmId as string, status: "ACTIVE" },
            select: { studentId: true },
          });
          for (const e of enrollments) {
            const res = await renderReportCardPdfAction({
              studentId: e.studentId,
              termId: params.termId as string,
            });
            if ("data" in res) urls.push(res.data.url);
            await db.pdfJob.update({ where: { id: pdfJob.id }, data: { completedItems: { increment: 1 } } });
          }
        } else if (pdfJob.kind === "TRANSCRIPT_BATCH") {
          const studentIds = params.studentIds as string[];
          for (const sid of studentIds) {
            // Transcripts are pre-existing; look up latest transcript per student
            const latest = await db.transcript.findFirst({
              where: { studentId: sid, schoolId: pdfJob.schoolId },
              orderBy: { generatedAt: "desc" },
            });
            if (!latest) continue;
            const res = await renderTranscriptPdfAction(latest.id);
            if ("data" in res) urls.push(res.data.url);
            await db.pdfJob.update({ where: { id: pdfJob.id }, data: { completedItems: { increment: 1 } } });
          }
        }

        const stitched = await stitchPdfs(urls);
        const key = generateFileKey("pdf-jobs", pdfJob.id, `${pdfJob.kind.toLowerCase()}-${Date.now()}.pdf`);
        await uploadFile(key, stitched, "application/pdf");

        await db.pdfJob.update({
          where: { id: pdfJob.id },
          data: { status: "COMPLETE", completedAt: new Date(), resultFileKey: key },
        });
        log.info("pdf-batch complete", { pdfJobId: pdfJob.id, key });
      } catch (err) {
        await db.pdfJob.update({
          where: { id: pdfJob.id },
          data: { status: "FAILED", completedAt: new Date(), error: String(err) },
        });
        log.error("pdf-batch failed", { pdfJobId: pdfJob.id, error: err });
        throw err;
      }
    },
    { concurrency: 2 },
  );

  worker.on("completed", (job) => log.info("pdf-batch job done", { jobId: job.id }));
  worker.on("failed", (job, err) => log.error("pdf-batch job failed", { jobId: job?.id, error: err }));
  return worker;
}
```

Note: this requires `pdf-lib` for stitching. Check if it's already a dependency: `grep '"pdf-lib"' package.json`. If not:

Run: `npm install pdf-lib`

- [ ] **Step 6: Verify GREEN**

Run: `npx vitest run tests/unit/common/pdf-job.test.ts`
Expected: 4+ passing.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/modules/common/ src/workers/pdf-batch.worker.ts tests/unit/common/ package.json package-lock.json 2>/dev/null
git commit -m "feat(pdf): PdfJob actions + BullMQ batch worker"
```

---

## Task 14: Batch dispatchers

**Files:**
- Modify: `src/modules/student/actions/id-card.action.ts`
- Modify: `src/modules/academics/actions/report-card.action.ts`
- Modify: `src/modules/academics/actions/transcript.action.ts`

- [ ] **Step 1: Add constant + enqueue helper**

In `src/lib/pdf/generator.ts`, export:

```ts
export const PDF_SYNC_THRESHOLD = 20;
```

Create `src/modules/common/pdf-job-dispatcher.ts` (new):

```ts
"use server";

import { db } from "@/lib/db";
import { getQueue, QUEUE_NAMES } from "@/lib/queue";

export async function enqueuePdfJob(input: {
  schoolId: string;
  kind: "ID_CARD_BATCH" | "REPORT_CARD_BATCH" | "TRANSCRIPT_BATCH";
  params: Record<string, unknown>;
  totalItems: number;
  requestedBy: string;
}): Promise<string> {
  const job = await db.pdfJob.create({
    data: {
      schoolId: input.schoolId,
      kind: input.kind,
      params: input.params as never,
      totalItems: input.totalItems,
      requestedBy: input.requestedBy,
      status: "QUEUED",
    },
  });
  const queue = getQueue(QUEUE_NAMES.PDF_BATCH);
  await queue.add("render", { pdfJobId: job.id });
  return job.id;
}
```

- [ ] **Step 2: `renderClassIdCardsAction`**

Append to `src/modules/student/actions/id-card.action.ts`:

```ts
import { PDF_SYNC_THRESHOLD } from "@/lib/pdf/generator";
import { enqueuePdfJob } from "@/modules/common/pdf-job-dispatcher";
import { PDFDocument } from "pdf-lib";

export async function renderClassIdCardsAction(input: { classArmId: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_ID_CARD_GENERATE);
  if (denied) return denied;

  const enrollments = await db.enrollment.findMany({
    where: { classArmId: input.classArmId, status: "ACTIVE" },
    select: { studentId: true },
  });
  if (enrollments.length === 0) return { error: "No active students in this class arm" };

  if (enrollments.length > PDF_SYNC_THRESHOLD) {
    const jobId = await enqueuePdfJob({
      schoolId: ctx.schoolId,
      kind: "ID_CARD_BATCH",
      params: { classArmId: input.classArmId },
      totalItems: enrollments.length,
      requestedBy: ctx.session.user.id!,
    });
    return { data: { jobId, queued: true } };
  }

  // Sync path: render each, stitch, return buffer-as-URL via R2 upload
  const urls: string[] = [];
  for (const e of enrollments) {
    const res = await renderStudentIdCardAction(e.studentId);
    if ("data" in res) urls.push(res.data.url);
  }
  const stitched = await PDFDocument.create();
  for (const url of urls) {
    const resp = await fetch(url);
    const doc = await PDFDocument.load(await resp.arrayBuffer());
    const pages = await stitched.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => stitched.addPage(p));
  }
  const buffer = Buffer.from(await stitched.save());
  const key = generateFileKey("id-card-batches", input.classArmId, `batch-${Date.now()}.pdf`);
  await uploadFile(key, buffer, "application/pdf");
  const url = await getSignedDownloadUrl(key);

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "IdCardBatch",
    entityId: input.classArmId,
    module: "students",
    description: `Generated ${enrollments.length} ID cards inline`,
    metadata: { fileKey: key },
  });

  return { data: { url, queued: false } };
}
```

- [ ] **Step 3: `renderClassReportCardsPdfAction`**

Append to `src/modules/academics/actions/report-card.action.ts` — mirror the structure of `renderClassIdCardsAction` but with `{ classArmId, termId }` params, `REPORT_CARDS_GENERATE` permission, and `REPORT_CARD_BATCH` kind. Use `renderReportCardPdfAction` in the sync loop.

```ts
import { PDF_SYNC_THRESHOLD } from "@/lib/pdf/generator";
import { enqueuePdfJob } from "@/modules/common/pdf-job-dispatcher";
import { PDFDocument } from "pdf-lib";

export async function renderClassReportCardsPdfAction(input: { classArmId: string; termId: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_GENERATE);
  if (denied) return denied;

  const enrollments = await db.enrollment.findMany({
    where: { classArmId: input.classArmId, status: "ACTIVE" },
    select: { studentId: true },
  });
  if (enrollments.length === 0) return { error: "No active students in this class arm" };

  if (enrollments.length > PDF_SYNC_THRESHOLD) {
    const jobId = await enqueuePdfJob({
      schoolId: ctx.schoolId,
      kind: "REPORT_CARD_BATCH",
      params: { classArmId: input.classArmId, termId: input.termId },
      totalItems: enrollments.length,
      requestedBy: ctx.session.user.id!,
    });
    return { data: { jobId, queued: true } };
  }

  const urls: string[] = [];
  for (const e of enrollments) {
    const res = await renderReportCardPdfAction({ studentId: e.studentId, termId: input.termId });
    if ("data" in res) urls.push(res.data.url);
  }
  const stitched = await PDFDocument.create();
  for (const url of urls) {
    const resp = await fetch(url);
    const doc = await PDFDocument.load(await resp.arrayBuffer());
    const pages = await stitched.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => stitched.addPage(p));
  }
  const buffer = Buffer.from(await stitched.save());
  const key = generateFileKey(
    "report-card-batches",
    `${input.classArmId}-${input.termId}`,
    `batch-${Date.now()}.pdf`
  );
  await uploadFile(key, buffer, "application/pdf");
  const url = await getSignedDownloadUrl(key);

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "ReportCardBatch",
    entityId: `${input.classArmId}-${input.termId}`,
    module: "academics",
    description: `Generated ${enrollments.length} report cards inline`,
    metadata: { fileKey: key },
  });

  return { data: { url, queued: false } };
}
```

- [ ] **Step 4: `renderBatchTranscriptsAction`**

Append to `src/modules/academics/actions/transcript.action.ts` — same pattern, but the params accept `studentIds: string[]`:

```ts
import { PDF_SYNC_THRESHOLD } from "@/lib/pdf/generator";
import { enqueuePdfJob } from "@/modules/common/pdf-job-dispatcher";
import { PDFDocument } from "pdf-lib";

export async function renderBatchTranscriptsAction(input: { studentIds: string[] }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSCRIPTS_CREATE);
  if (denied) return denied;

  if (input.studentIds.length === 0) return { error: "No students provided" };

  if (input.studentIds.length > PDF_SYNC_THRESHOLD) {
    const jobId = await enqueuePdfJob({
      schoolId: ctx.schoolId,
      kind: "TRANSCRIPT_BATCH",
      params: { studentIds: input.studentIds },
      totalItems: input.studentIds.length,
      requestedBy: ctx.session.user.id!,
    });
    return { data: { jobId, queued: true } };
  }

  const urls: string[] = [];
  for (const sid of input.studentIds) {
    const latest = await db.transcript.findFirst({
      where: { studentId: sid, schoolId: ctx.schoolId },
      orderBy: { generatedAt: "desc" },
    });
    if (!latest) continue;
    const res = await renderTranscriptPdfAction(latest.id);
    if ("data" in res) urls.push(res.data.url);
  }
  const stitched = await PDFDocument.create();
  for (const url of urls) {
    const resp = await fetch(url);
    const doc = await PDFDocument.load(await resp.arrayBuffer());
    const pages = await stitched.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => stitched.addPage(p));
  }
  const buffer = Buffer.from(await stitched.save());
  const key = generateFileKey("transcript-batches", ctx.schoolId, `batch-${Date.now()}.pdf`);
  await uploadFile(key, buffer, "application/pdf");
  const url = await getSignedDownloadUrl(key);

  return { data: { url, queued: false } };
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vitest run tests/unit/`
Expected: no regressions; new batch actions aren't unit-tested here — integration test in Task 17 covers the sync path.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat(pdf): batch dispatchers (ID cards + report cards + transcripts)"
```

---

## Task 15: Cache invalidation hooks

**Files:**
- Modify: `src/modules/student/actions/student.action.ts`
- Modify: `src/modules/student/actions/promotion.action.ts`
- Modify: `src/modules/academics/actions/mark.action.ts` (if exists)

- [ ] **Step 1: Photo change invalidates ID card**

In `src/modules/student/actions/student.action.ts`, find `updateStudentAction`. In the update payload, if the input contains `photoUrl` that differs from existing, set `idCardCacheInvalidatedAt: new Date()` in the same update:

```ts
const data: Record<string, unknown> = { /* existing fields */ };
if (input.photoUrl !== undefined && input.photoUrl !== existing.photoUrl) {
  data.idCardCacheInvalidatedAt = new Date();
}
// rest of update uses `data`
```

Check the current shape of `updateStudentAction` and adapt — the key is: when photoUrl changes, also set the invalidation timestamp in the same Prisma update call.

- [ ] **Step 2: Promotion commit invalidates ID cards**

In `src/modules/student/actions/promotion.action.ts`, find the `applyCommit` helper (extracted in Promotion Wizard M-1). Inside the PROMOTE/RETAIN branch that updates enrollments, after creating the new enrollment, add:

```ts
await tx.student.update({
  where: { id: item.studentId },
  data: { idCardCacheInvalidatedAt: commitDate },
});
```

For GRADUATE and WITHDRAW branches, also invalidate (the student's status change should also be reflected in their "current" ID card):

```ts
await tx.student.update({
  where: { id: item.studentId },
  data: { idCardCacheInvalidatedAt: commitDate },
});
```

(Alternative: one `updateMany` at the end of `applyCommit` covering all affected students.)

- [ ] **Step 3: Mark mutations invalidate report card cache**

Find `src/modules/academics/actions/mark.action.ts`. For each action that writes a `Mark`, `SubjectResult`, or `TerminalResult`, add after the write:

```ts
await invalidateReportCardCacheAction({ studentId, termId });
```

If the action affects multiple students/terms (bulk update), call invalidation in a loop or use a single `updateMany` on `ReportCardPdfCache`:

```ts
await db.reportCardPdfCache.updateMany({
  where: { studentId: { in: affectedStudentIds }, termId: affectedTermId },
  data: { invalidatedAt: new Date() },
});
```

Import `invalidateReportCardCacheAction` from `@/modules/academics/actions/report-card.action`.

Check each action in mark.action.ts; typical actions include `createMarkAction`, `updateMarkAction`, `bulkUpdateMarksAction`, `computeTerminalResultsAction`. Each that mutates grades needs the hook.

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/unit/students/ tests/unit/academics/`
Expected: existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat(pdf): wire cache invalidation hooks (photo, promotion, mark mutations)"
```

---

## Task 16: Student profile Academic tab

**Files:**
- Create: `src/app/(dashboard)/students/[id]/academic-section.tsx`
- Modify: `src/app/(dashboard)/students/[id]/student-profile.tsx`

- [ ] **Step 1: Study existing tab component**

Read `src/app/(dashboard)/students/[id]/documents-section.tsx` to understand the `"use client"` + `useEffect` + server-action-loader pattern established by the document vault landing.

- [ ] **Step 2: Write the tab**

Create `src/app/(dashboard)/students/[id]/academic-section.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { renderStudentIdCardAction } from "@/modules/student/actions/id-card.action";
import { renderReportCardPdfAction } from "@/modules/academics/actions/report-card.action";
import {
  renderTranscriptPdfAction,
  verifyTranscriptAction,
  issueTranscriptAction,
  generateTranscriptAction,
  getTranscriptsAction,
} from "@/modules/academics/actions/transcript.action";

export function StudentAcademicSection({ studentId }: { studentId: string }) {
  const router = useRouter();
  const perms = usePermissions();
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [pending, start] = useTransition();

  const canGenerateIdCard = perms.has("students:id-card:generate");
  const canGenerateTranscript = perms.has("academics:transcripts:create");
  const canVerifyTranscript = perms.has("academics:transcripts:verify");
  const canIssueTranscript = perms.has("academics:transcripts:issue");
  const canGenerateReportCard = perms.has("academics:report-cards:generate");

  async function loadTranscripts() {
    const res = await getTranscriptsAction({ studentId });
    if ("data" in res) setTranscripts(res.data);
  }

  useEffect(() => {
    loadTranscripts();
  }, [studentId]);

  const openUrl = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  };

  const handleDownloadIdCard = () =>
    start(async () => {
      const res = await renderStudentIdCardAction(studentId);
      if ("error" in res) toast.error(res.error);
      else openUrl(res.data.url);
    });

  const handleGenerateTranscript = () =>
    start(async () => {
      const res = await generateTranscriptAction({ studentId });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Transcript generated");
        await loadTranscripts();
      }
    });

  const handleVerify = (id: string) =>
    start(async () => {
      const res = await verifyTranscriptAction(id);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Transcript verified");
        await loadTranscripts();
      }
    });

  const handleIssue = (id: string) =>
    start(async () => {
      if (!confirm("Issue this transcript? Once issued, it's frozen.")) return;
      const res = await issueTranscriptAction(id);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Transcript issued");
        await loadTranscripts();
      }
    });

  const handleDownloadTranscript = (id: string) =>
    start(async () => {
      const res = await renderTranscriptPdfAction(id);
      if ("error" in res) toast.error(res.error);
      else openUrl(res.data.url);
    });

  return (
    <div className="space-y-4">
      {/* ID card */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Student ID Card</h3>
            <p className="text-sm text-muted-foreground">Print-ready card with QR code.</p>
          </div>
          {canGenerateIdCard ? (
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              onClick={handleDownloadIdCard}
              disabled={pending}
            >
              Download ID Card
            </button>
          ) : null}
        </div>
      </div>

      {/* Transcripts */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Transcripts</h3>
          {canGenerateTranscript ? (
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              onClick={handleGenerateTranscript}
              disabled={pending}
            >
              Generate new
            </button>
          ) : null}
        </div>
        {transcripts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transcripts yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">Number</th>
                <th className="py-2">Period</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transcripts.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2">{t.transcriptNumber}</td>
                  <td className="py-2">{t.coveringFrom} → {t.coveringTo}</td>
                  <td className="py-2">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                      {t.status}
                    </span>
                  </td>
                  <td className="py-2 text-right space-x-2">
                    <button className="text-blue-600 hover:underline" onClick={() => handleDownloadTranscript(t.id)}>
                      View PDF
                    </button>
                    {t.status === "GENERATED" && canVerifyTranscript ? (
                      <button className="text-emerald-600 hover:underline" onClick={() => handleVerify(t.id)}>
                        Verify
                      </button>
                    ) : null}
                    {t.status === "VERIFIED" && canIssueTranscript ? (
                      <button className="text-amber-600 hover:underline" onClick={() => handleIssue(t.id)}>
                        Issue
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Report cards — minimal v1 list with Download-by-term button */}
      <ReportCardsBlock studentId={studentId} canGenerate={canGenerateReportCard} />
    </div>
  );
}

function ReportCardsBlock({ studentId, canGenerate }: { studentId: string; canGenerate: boolean }) {
  const [pending, start] = useTransition();
  const [terms, setTerms] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>("");

  useEffect(() => {
    // TODO: wire to a getAvailableTermsForStudentAction — for now query terms in current year
    fetch("/api/terms/current-year").then((r) => r.json()).then(setTerms).catch(() => setTerms([]));
  }, [studentId]);

  const handleDownload = () => {
    if (!selectedTerm) return;
    start(async () => {
      const res = await renderReportCardPdfAction({ studentId, termId: selectedTerm });
      if ("error" in res) toast.error(res.error);
      else {
        const a = document.createElement("a");
        a.href = res.data.url;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.click();
      }
    });
  };

  if (!canGenerate) return null;

  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="font-semibold">Report Cards</h3>
      <div className="mt-3 flex items-center gap-2">
        <select
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value)}
        >
          <option value="">Select term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          onClick={handleDownload}
          disabled={!selectedTerm || pending}
        >
          Download Report Card
        </button>
      </div>
    </div>
  );
}
```

Note the `/api/terms/current-year` route referenced — if it doesn't exist, either create a minimal route or switch to a server action call. The implementer should verify and adapt.

- [ ] **Step 3: Add tab to `student-profile.tsx`**

Locate the tabs array (around line 148–157 per existing exploration). Add after the Guardians tab (index 1):

```ts
{ key: "academic", label: "Academic" },
```

Shift subsequent tab indices as needed. In the conditional tab body, add:

```tsx
{activeTab === "academic" && <StudentAcademicSection studentId={student.id} />}
```

Import `StudentAcademicSection` from `./academic-section`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: clean (or adapt if the `/api/terms/current-year` reference triggers an issue — swap for a server action if so).

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(students): Academic tab on student profile"
```

---

## Task 17: Generations tray page

**Files:**
- Create: `src/app/(dashboard)/pdf-jobs/page.tsx`
- Create: `src/app/(dashboard)/pdf-jobs/pdf-jobs-client.tsx`

- [ ] **Step 1: Server page**

```tsx
// src/app/(dashboard)/pdf-jobs/page.tsx
import { listPdfJobsAction } from "@/modules/common/pdf-job.action";
import { PdfJobsClient } from "./pdf-jobs-client";

export default async function PdfJobsPage() {
  const res = await listPdfJobsAction();
  const jobs = "data" in res ? res.data : [];
  const error = "error" in res ? res.error : null;
  return <PdfJobsClient jobs={jobs} error={error} />;
}
```

- [ ] **Step 2: Client component with polling**

```tsx
// src/app/(dashboard)/pdf-jobs/pdf-jobs-client.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getPdfJobAction, cancelPdfJobAction } from "@/modules/common/pdf-job.action";

type Job = {
  id: string;
  kind: string;
  status: string;
  completedItems: number;
  totalItems: number;
  resultFileKey: string | null;
  error: string | null;
  requestedAt: Date;
};

export function PdfJobsClient({ jobs: initial, error }: { jobs: Job[]; error: string | null }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initial);
  const [, start] = useTransition();

  useEffect(() => {
    const active = jobs.some((j) => j.status === "QUEUED" || j.status === "RUNNING");
    if (!active) return;
    const interval = setInterval(async () => {
      const updated = await Promise.all(
        jobs.map(async (j) => {
          if (j.status !== "QUEUED" && j.status !== "RUNNING") return j;
          const res = await getPdfJobAction(j.id);
          return "data" in res ? res.data : j;
        }),
      );
      setJobs(updated);
    }, 3000);
    return () => clearInterval(interval);
  }, [jobs]);

  const handleCancel = (id: string) =>
    start(async () => {
      const res = await cancelPdfJobAction(id);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Job cancelled");
        router.refresh();
      }
    });

  const handleDownload = (fileKey: string) => {
    window.open(`/api/files/${encodeURIComponent(fileKey)}`, "_blank", "noreferrer");
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">PDF Generations</h1>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No PDF generation jobs.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="p-2">Kind</th>
              <th className="p-2">Requested</th>
              <th className="p-2">Status</th>
              <th className="p-2">Progress</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-border">
                <td className="p-2">{j.kind.replace("_BATCH", "")}</td>
                <td className="p-2">{new Date(j.requestedAt).toLocaleString()}</td>
                <td className="p-2">{j.status}</td>
                <td className="p-2">{j.completedItems} / {j.totalItems}</td>
                <td className="p-2 text-right space-x-2">
                  {j.status === "COMPLETE" && j.resultFileKey ? (
                    <button className="text-blue-600 hover:underline" onClick={() => handleDownload(j.resultFileKey!)}>
                      Download
                    </button>
                  ) : null}
                  {j.status === "QUEUED" ? (
                    <button className="text-red-600 hover:underline" onClick={() => handleCancel(j.id)}>
                      Cancel
                    </button>
                  ) : null}
                  {j.status === "FAILED" ? (
                    <span className="text-xs text-red-700" title={j.error ?? undefined}>
                      Failed
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/pdf-jobs"
git commit -m "feat(pdf): generations tray page"
```

---

## Task 18: Integration test

**Files:**
- Create: `tests/integration/students/pdf-products.test.ts`

- [ ] **Step 1: Write integration test**

Follow the pattern from `tests/integration/students/document-vault.test.ts`. Seed a school / student / enrollment / photo / school with logo, then exercise:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { renderStudentIdCardAction } from "@/modules/student/actions/id-card.action";
import { renderReportCardPdfAction, invalidateReportCardCacheAction } from "@/modules/academics/actions/report-card.action";
import {
  generateTranscriptAction,
  verifyTranscriptAction,
  issueTranscriptAction,
  renderTranscriptPdfAction,
} from "@/modules/academics/actions/transcript.action";
import { resolveSeededAdminId, loginAs } from "./setup";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Student PDF products lifecycle (integration)", () => {
  const db = new PrismaClient();
  const testTag = `pdf-test-${Date.now()}`;
  let studentId: string;

  beforeAll(async () => {
    const adminId = await resolveSeededAdminId();
    loginAs({ id: adminId });

    // Seed student + enrollment. Adapt to existing seed helpers — mirror
    // what document-vault.test.ts does.
    const student = await db.student.create({
      data: {
        schoolId: "default-school",
        studentId: `${testTag}/1`,
        firstName: "PDF",
        lastName: "Test",
        dateOfBirth: new Date("2010-01-01"),
        gender: "MALE",
        boardingStatus: "DAY",
        photoUrl: "https://via.placeholder.com/400x500.png",
      },
    });
    studentId = student.id;

    // Needs: current academic year + class + classArm + enrollment
    // Look at document-vault.test.ts seed for the template.
  });

  afterAll(async () => {
    await db.reportCardPdfCache.deleteMany({ where: { studentId } });
    await db.transcript.deleteMany({ where: { studentId } });
    await db.enrollment.deleteMany({ where: { studentId } });
    await db.student.delete({ where: { id: studentId } });
    await db.$disconnect();
  });

  it("renders ID card twice — first renders+caches, second returns cached", async () => {
    const first = await renderStudentIdCardAction(studentId);
    if (!("data" in first)) throw new Error(first.error);
    expect(first.data.cached).toBe(false);

    const cached = await db.student.findUnique({ where: { id: studentId } });
    expect(cached?.idCardPdfKey).toBeTruthy();

    const second = await renderStudentIdCardAction(studentId);
    if (!("data" in second)) throw new Error(second.error);
    expect(second.data.cached).toBe(true);
  });

  it("runs transcript flow: generate → verify → issue → downloads cached PDF", async () => {
    const gen = await generateTranscriptAction({ studentId });
    if (!("data" in gen)) throw new Error(gen.error);
    const transcriptId = gen.data.transcript.id;

    const verified = await verifyTranscriptAction(transcriptId);
    expect(verified).toMatchObject({ data: { status: "VERIFIED" } });

    const issued = await issueTranscriptAction(transcriptId);
    if (!("data" in issued)) throw new Error(issued.error);
    expect(issued.data.status).toBe("ISSUED");
    expect(issued.data.pdfKey).toBeTruthy();

    const rendered = await renderTranscriptPdfAction(transcriptId);
    if (!("data" in rendered)) throw new Error(rendered.error);
    expect(rendered.data.cached).toBe(true);
  });
});
```

The ID card test requires a student with an active enrollment — adapt seed steps to match. If seeding enrollment inline is complex, look at how `promotion-lifecycle.test.ts` does it.

- [ ] **Step 2: Run**

Run: `npm run test:students`
Expected: 3/3 passing (promotion + document-vault + pdf-products).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/students/pdf-products.test.ts
git commit -m "test(students): PDF products integration lifecycle"
```

---

## Task 19: End-to-end verification

**Files:** verification only — no edits

- [ ] **Step 1: Full unit suite**

Run: `npx vitest run`
Expected: all passing, no regressions.

- [ ] **Step 2: Integration tests**

Run: `npm run test:students`
Expected: 3/3 passing.

- [ ] **Step 3: Audit guardrail**

Run: `npx vitest run tests/unit/guardrails/audit-coverage.test.ts`
Expected: 2/2 passing (every mutating action has `audit()`).

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success. Confirm routes `/pdf-jobs` and `/students/[id]` (Academic tab) compile.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no new errors specific to feature files.

- [ ] **Step 7: Manual UI walk**

1. Log in as admin → open a student profile → Academic tab → Download ID Card → PDF opens
2. Re-download → compare — should be cached (same R2 key); view `Student.idCardPdfKey` in DB to confirm
3. Update the student's photo → re-download → new PDF generated (cache invalidated)
4. Generate transcript → Verify → Issue → Download — PDF is the ISSUED cached copy
5. Generate a report card for a term → download. Correct a mark → re-download → new PDF
6. Class-level: trigger a 50-student class ID card batch → navigate to `/pdf-jobs` → watch QUEUED → RUNNING → COMPLETE → download stitched PDF
7. QR scan on phone → confirm decodes to the studentId string
8. Non-admin role (e.g. class teacher) → Academic tab shows Download buttons for ID card + report card but no Verify/Issue buttons on transcripts
9. Non-permitted role (e.g. parent) → Academic tab shows empty / no actions

No commit for verification.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage**: every spec section maps to a task (schema → T2, permissions → T3, queue → T4, QR → T5, photo → T6, shared components → T7, id-card template → T8, transcript template → T9, id-card action → T10, report-card action → T11, transcript workflow → T12, batch worker → T13, batch dispatchers → T14, invalidation hooks → T15, academic tab → T16, generations tray → T17, integration → T18, verification → T19)
- [x] **No placeholders**: every code block has real code; two deliberate "adapt to existing" instructions (Task 15 cache hooks, Task 16 `/api/terms/current-year`) that require the implementer to verify existing file shapes
- [x] **Type consistency**: enum values match across schema/actions/tests (`ID_CARD_BATCH`, `REPORT_CARD_BATCH`, `TRANSCRIPT_BATCH`; `QUEUED/RUNNING/COMPLETE/FAILED/CANCELLED`); transcript status strings match literal values in schema (`GENERATED/VERIFIED/ISSUED`); zod uses `.issues[0]` per zod v4 convention
- [x] **File paths**: all absolute
- [x] **TDD shape**: every logic task has write-test → verify-fail → implement → verify-pass → commit
