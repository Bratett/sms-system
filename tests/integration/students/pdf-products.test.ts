import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveSeededAdminId, loginAs } from "./setup";

/**
 * Full-lifecycle integration test for Student PDF products.
 *
 * Exercises three flows against the real DB:
 *   1. ID card  — renderStudentIdCardAction: miss -> cache -> hit
 *   2. Report card — renderReportCardPdfAction: miss -> invalidate -> miss ->
 *                    cache row renderedAt advances
 *   3. Transcript — generate -> verify -> issue (pdfKey set) ->
 *                   renderTranscriptPdfAction returns cached
 *
 * R2 storage and PDF rendering are mocked because this test targets the DB
 * cache/state machine, not the binary output. QR generation is likewise stubbed.
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */

// ─── Mocks for external side-effects ──────────────────────────────
// R2 storage: return deterministic key/url so upload calls succeed without
// real credentials. generateFileKey must return the key verbatim so the
// downstream uploadFile can return it.
vi.mock("@/lib/storage/r2", () => ({
  uploadFile: vi.fn(async (key: string) => ({
    key,
    url: `https://r2.example.com/${key}`,
  })),
  getSignedDownloadUrl: vi.fn(async (key: string) => `https://r2.example.com/signed/${key}`),
  deleteFile: vi.fn(),
  generateFileKey: (module: string, entityId: string, filename: string) =>
    `${module}/${entityId}/${filename}`,
}));

// PDF generator: heavy react-pdf render; not what we're testing.
vi.mock("@/lib/pdf/generator", () => ({
  renderPdfToBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  PDF_SYNC_THRESHOLD: 20,
}));

// QR helper pulled in by the ID-card action.
vi.mock("@/lib/pdf/qr", () => ({
  generateQrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,FAKE"),
}));

// Actions must be imported AFTER the mocks above are declared.
// (vi.mock is hoisted above imports, but keeping the block structure visually
// paired makes the intent clear.)
import { renderStudentIdCardAction } from "@/modules/student/actions/id-card.action";
import {
  renderReportCardPdfAction,
  invalidateReportCardCacheAction,
} from "@/modules/academics/actions/report-card.action";
import {
  generateTranscriptAction,
  verifyTranscriptAction,
  issueTranscriptAction,
  renderTranscriptPdfAction,
} from "@/modules/academics/actions/transcript.action";

const SCHOOL_ID = "default-school";
const hasDbUrl = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDbUrl ? describe : describe.skip;

describeIfDb("Student PDF products lifecycle (integration)", () => {
  const db = new PrismaClient();
  const TAG = `pdf-test-${Date.now()}`;

  let studentId: string;
  let termId: string;
  let academicYearId: string;
  let programmeId: string;
  let classId: string;
  let classArmId: string;
  let subjectId: string;
  let terminalResultId: string;
  let enrollmentId: string;
  const transcriptIds: string[] = [];

  beforeAll(async () => {
    const school = await db.school.findUnique({ where: { id: SCHOOL_ID } });
    if (!school) throw new Error("Run: npm run db:seed");

    const adminId = await resolveSeededAdminId();
    loginAs({ id: adminId });

    // 1. Current academic year (seeded) or create a private one.
    const currentYear = await db.academicYear.findFirst({
      where: { schoolId: SCHOOL_ID, isCurrent: true },
    });
    if (!currentYear) throw new Error("Seeded DB missing current academic year");
    academicYearId = currentYear.id;

    // 2. Dedicated programme / class / arm so we don't collide with seed data.
    const programme = await db.programme.create({
      data: { schoolId: SCHOOL_ID, name: `${TAG}-programme`, duration: 3 },
    });
    programmeId = programme.id;

    const klass = await db.class.create({
      data: {
        schoolId: SCHOOL_ID,
        programmeId: programme.id,
        academicYearId,
        yearGroup: 1,
        name: `${TAG}-SHS1`,
      },
    });
    classId = klass.id;

    const arm = await db.classArm.create({
      data: { classId: klass.id, schoolId: SCHOOL_ID, name: "A", capacity: 50 },
    });
    classArmId = arm.id;

    // 3. Student with photo URL + active enrollment.
    const student = await db.student.create({
      data: {
        schoolId: SCHOOL_ID,
        studentId: `${TAG}/1`,
        firstName: "Pdf",
        lastName: "Test",
        dateOfBirth: new Date("2008-01-01"),
        gender: "MALE",
        boardingStatus: "DAY",
        photoUrl: "https://example.com/student-photo.jpg",
        status: "ACTIVE",
      },
    });
    studentId = student.id;

    const enrollment = await db.enrollment.create({
      data: {
        studentId: student.id,
        classArmId: arm.id,
        schoolId: SCHOOL_ID,
        academicYearId,
        status: "ACTIVE",
        isFreeShsPlacement: false,
      },
    });
    enrollmentId = enrollment.id;

    // 4. Term (inside the current academic year).
    const term = await db.term.create({
      data: {
        schoolId: SCHOOL_ID,
        academicYearId,
        name: `${TAG}-Term1`,
        termNumber: 1,
        startDate: currentYear.startDate,
        endDate: currentYear.endDate,
        status: "ACTIVE",
      },
    });
    termId = term.id;

    // 5. Subject + TerminalResult + at least one SubjectResult.
    const subject = await db.subject.create({
      data: { schoolId: SCHOOL_ID, name: `${TAG}-Mathematics`, code: `${TAG}-MTH`, type: "CORE" },
    });
    subjectId = subject.id;

    const terminalResult = await db.terminalResult.create({
      data: {
        studentId: student.id,
        classArmId: arm.id,
        schoolId: SCHOOL_ID,
        termId: term.id,
        academicYearId,
        totalScore: 82,
        averageScore: 82,
        classPosition: 1,
        overallGrade: "A",
        teacherRemarks: "Excellent",
        headmasterRemarks: "Well done",
      },
    });
    terminalResultId = terminalResult.id;

    await db.subjectResult.create({
      data: {
        terminalResultId: terminalResult.id,
        subjectId: subject.id,
        schoolId: SCHOOL_ID,
        classScore: 32,
        examScore: 50,
        totalScore: 82,
        grade: "A",
        interpretation: "Excellent",
        position: 1,
      },
    });
  });

  afterAll(async () => {
    try {
      // Reverse dependency order. SubjectResult cascades with TerminalResult;
      // still delete explicitly to be safe across environments.
      if (transcriptIds.length > 0) {
        await db.transcript.deleteMany({ where: { id: { in: transcriptIds } } });
      }
      await db.reportCardPdfCache.deleteMany({ where: { studentId } }).catch(() => {});
      await db.subjectResult
        .deleteMany({ where: { terminalResultId } })
        .catch(() => {});
      await db.terminalResult.deleteMany({ where: { id: terminalResultId } }).catch(() => {});
      await db.subject.deleteMany({ where: { id: subjectId } }).catch(() => {});
      await db.term.deleteMany({ where: { id: termId } }).catch(() => {});
      await db.enrollment.deleteMany({ where: { id: enrollmentId } }).catch(() => {});
      await db.student.deleteMany({ where: { id: studentId } }).catch(() => {});
      await db.classArm.deleteMany({ where: { id: classArmId } }).catch(() => {});
      await db.class.deleteMany({ where: { id: classId } }).catch(() => {});
      await db.programme.deleteMany({ where: { id: programmeId } }).catch(() => {});
    } finally {
      await db.$disconnect();
    }
  });

  it("ID card flow — first render caches, second render returns cached", async () => {
    const first = await renderStudentIdCardAction(studentId);
    if (!("data" in first)) throw new Error(first.error);
    expect(first.data.cached).toBe(false);

    const after = await db.student.findUnique({ where: { id: studentId } });
    expect(after?.idCardPdfKey).toBeTruthy();
    expect(after?.idCardCachedAt).toBeTruthy();

    const second = await renderStudentIdCardAction(studentId);
    if (!("data" in second)) throw new Error(second.error);
    expect(second.data.cached).toBe(true);
  });

  it("Report card flow — fresh render → invalidate → fresh render again", async () => {
    const first = await renderReportCardPdfAction({ studentId, termId });
    if (!("data" in first)) throw new Error(first.error);
    expect(first.data.cached).toBe(false);

    const cacheAfterFirst = await db.reportCardPdfCache.findUnique({
      where: { studentId_termId: { studentId, termId } },
    });
    expect(cacheAfterFirst).toBeTruthy();
    expect(cacheAfterFirst!.fileKey).toBeTruthy();
    expect(cacheAfterFirst!.invalidatedAt).toBeNull();

    // Second call without invalidation: cache hit expected.
    const hit = await renderReportCardPdfAction({ studentId, termId });
    if (!("data" in hit)) throw new Error(hit.error);
    expect(hit.data.cached).toBe(true);

    // Invalidate, then re-render should be a miss and renderedAt must advance.
    // Small delay ensures the new timestamp is strictly greater on coarse clocks.
    await new Promise((r) => setTimeout(r, 10));
    const inv = await invalidateReportCardCacheAction({ studentId, termId });
    if (!("data" in inv)) throw new Error(inv.error);
    expect(inv.data.invalidated).toBeGreaterThanOrEqual(1);

    await new Promise((r) => setTimeout(r, 10));
    const second = await renderReportCardPdfAction({ studentId, termId });
    if (!("data" in second)) throw new Error(second.error);
    expect(second.data.cached).toBe(false);

    const cacheAfterSecond = await db.reportCardPdfCache.findUnique({
      where: { studentId_termId: { studentId, termId } },
    });
    expect(cacheAfterSecond).toBeTruthy();
    expect(cacheAfterSecond!.invalidatedAt).toBeNull();
    expect(cacheAfterSecond!.renderedAt.getTime()).toBeGreaterThan(
      cacheAfterFirst!.renderedAt.getTime(),
    );
  });

  it("Transcript flow — generate → verify → issue → cached render", async () => {
    const gen = await generateTranscriptAction({ studentId });
    if (!("data" in gen)) throw new Error(gen.error);
    const transcriptId = gen.data.transcript.id;
    transcriptIds.push(transcriptId);
    expect(gen.data.transcript.status).toBe("GENERATED");
    expect(gen.data.transcript.transcriptNumber).toMatch(/^TRN\/\d{4}\/\d{4}$/);

    const verified = await verifyTranscriptAction(transcriptId);
    if (!("data" in verified)) throw new Error(verified.error);
    expect(verified.data.status).toBe("VERIFIED");
    expect(verified.data.verifiedAt).toBeTruthy();

    const issued = await issueTranscriptAction(transcriptId);
    if (!("data" in issued)) throw new Error(issued.error);
    expect(issued.data.status).toBe("ISSUED");
    expect(issued.data.pdfKey).toBeTruthy();
    expect(issued.data.issuedAt).toBeTruthy();

    // Once ISSUED, re-render should short-circuit to cached.
    const rendered = await renderTranscriptPdfAction(transcriptId);
    if (!("data" in rendered)) throw new Error(rendered.error);
    expect(rendered.data.cached).toBe(true);
  });
});
