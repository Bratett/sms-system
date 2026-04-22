"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { uploadFile, getSignedDownloadUrl, generateFileKey, deleteFile } from "@/lib/storage/r2";
import { renderPdfToBuffer, PDF_SYNC_THRESHOLD } from "@/lib/pdf/generator";
import { TranscriptTemplate, type TranscriptData } from "@/lib/pdf/templates/transcript";
import { enqueuePdfJob } from "@/modules/common/pdf-job-dispatcher";
import { stitchPdfsFromUrls } from "@/lib/pdf/stitch";

// ─── Generate Transcript ───────────────────────────────────────────

export async function generateTranscriptAction(data: { studentId: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSCRIPTS_CREATE);
  if (denied) return denied;

  const student = await db.student.findUnique({ where: { id: data.studentId } });
  if (!student) return { error: "Student not found" };

  // Fetch all terminal results across all academic years
  const terminalResults = await db.terminalResult.findMany({
    where: { studentId: data.studentId },
    include: {
      subjectResults: { include: { subject: true } },
    },
    orderBy: [{ academicYearId: "asc" }, { termId: "asc" }],
  });

  if (terminalResults.length === 0) {
    return { error: "No results found for this student" };
  }

  // Calculate cumulative GPA (average of all term averages)
  const termAverages = terminalResults
    .map((r) => r.averageScore)
    .filter((a): a is number => a !== null);
  const cumulativeGPA = termAverages.length > 0
    ? termAverages.reduce((sum, avg) => sum + avg, 0) / termAverages.length
    : null;

  // Generate transcript number
  const year = new Date().getFullYear();
  const count = await db.transcript.count({
    where: { schoolId: ctx.schoolId, transcriptNumber: { startsWith: `TRN/${year}` } },
  });
  const transcriptNumber = `TRN/${year}/${String(count + 1).padStart(4, "0")}`;

  // Determine covering period
  const academicYearIds = [...new Set(terminalResults.map((r) => r.academicYearId))];
  const academicYears = await db.academicYear.findMany({
    where: { id: { in: academicYearIds } },
    orderBy: { startDate: "asc" },
  });

  const transcript = await db.transcript.create({
    data: {
      schoolId: ctx.schoolId,
      studentId: data.studentId,
      transcriptNumber,
      generatedBy: ctx.session.user.id!,
      coveringFrom: academicYears[0]?.name || null,
      coveringTo: academicYears[academicYears.length - 1]?.name || null,
      cumulativeGPA,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "Transcript",
    entityId: transcript.id,
    module: "academics",
    description: `Generated transcript ${transcriptNumber} for ${student.studentId}`,
    newData: transcript,
  });

  return {
    data: {
      transcript,
      student,
      terminalResults,
      academicYears,
    },
  };
}

// ─── Get Transcripts ───────────────────────────────────────────────

export async function getTranscriptsAction(filters?: {
  studentId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSCRIPTS_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.status) where.status = filters.status;

  const [transcripts, total] = await Promise.all([
    db.transcript.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.transcript.count({ where }),
  ]);

  return {
    data: transcripts,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ─── Verify Transcript ─────────────────────────────────────────────

export async function verifyTranscriptAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSCRIPTS_VERIFY);
  if (denied) return denied;

  const transcript = await db.transcript.findUnique({ where: { id } });
  if (!transcript) return { error: "Transcript not found" };
  if (transcript.status !== "GENERATED") {
    return { error: "Transcript is not in GENERATED status" };
  }

  const updated = await db.transcript.update({
    where: { id },
    data: {
      status: "VERIFIED",
      verifiedBy: ctx.session.user.id!,
      verifiedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "APPROVE",
    entity: "Transcript",
    entityId: id,
    module: "academics",
    description: `Verified transcript ${transcript.transcriptNumber}`,
  });

  return { data: updated };
}

// ─── Load Transcript Data (for PDF rendering) ──────────────────────

async function loadTranscriptData(
  transcriptId: string,
): Promise<{ data: TranscriptData } | { error: string }> {
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
    },
  });

  const termIds = [...new Set(terminalResults.map((tr) => tr.termId))];
  const academicYearIds = [...new Set(terminalResults.map((tr) => tr.academicYearId))];
  const [terms, academicYears] = await Promise.all([
    termIds.length
      ? db.term.findMany({
          where: { id: { in: termIds } },
          select: { id: true, name: true, termNumber: true, academicYearId: true },
        })
      : Promise.resolve([] as Array<{ id: string; name: string; termNumber: number; academicYearId: string }>),
    academicYearIds.length
      ? db.academicYear.findMany({
          where: { id: { in: academicYearIds } },
          select: { id: true, name: true, startDate: true },
        })
      : Promise.resolve([] as Array<{ id: string; name: string; startDate: Date }>),
  ]);
  const termById = new Map(terms.map((t) => [t.id, t]));
  const yearById = new Map(academicYears.map((y) => [y.id, y]));

  // Sort terminal results by (academicYear.startDate asc, term.termNumber asc)
  const sortedResults = [...terminalResults].sort((a, b) => {
    const ay = yearById.get(a.academicYearId);
    const by = yearById.get(b.academicYearId);
    const ayStart = ay ? ay.startDate.getTime() : 0;
    const byStart = by ? by.startDate.getTime() : 0;
    if (ayStart !== byStart) return ayStart - byStart;
    const at = termById.get(a.termId);
    const bt = termById.get(b.termId);
    return (at?.termNumber ?? 0) - (bt?.termNumber ?? 0);
  });

  const byYear = new Map<string, TranscriptData["years"][number]>();
  for (const tr of sortedResults) {
    const year = yearById.get(tr.academicYearId);
    const term = termById.get(tr.termId);
    const yearName = year?.name ?? "-";
    if (!byYear.has(yearName)) {
      byYear.set(yearName, { academicYearName: yearName, terms: [] });
    }
    byYear.get(yearName)!.terms.push({
      termName: term?.name ?? "-",
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
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      programmeName: student.enrollments[0]?.classArm.class.programme.name ?? "-",
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

// ─── Render Transcript PDF ─────────────────────────────────────────

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

  // Non-ISSUED path: render preview, replacing any previous preview.
  const dataResult = await loadTranscriptData(transcriptId);
  if ("error" in dataResult) return dataResult;

  // Delete old preview if any (best-effort; a stray orphan is one file).
  if (transcript.previewKey) {
    try {
      await deleteFile(transcript.previewKey);
    } catch {
      // best-effort; orphan is one file
    }
  }

  const buffer = await renderPdfToBuffer(TranscriptTemplate({ data: dataResult.data }));
  const initialKey = generateFileKey(
    "transcript-previews",
    transcriptId,
    `preview-${Date.now()}.pdf`,
  );
  const uploaded = await uploadFile(initialKey, buffer, "application/pdf");

  await db.transcript.update({
    where: { id: transcriptId },
    data: { previewKey: uploaded.key, previewRenderedAt: new Date() },
  });

  const url = await getSignedDownloadUrl(uploaded.key);
  return { data: { url, cached: false } };
}

// ─── Issue Transcript ──────────────────────────────────────────────

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
  const initialKey = generateFileKey(
    "transcripts",
    transcriptId,
    `${transcript.transcriptNumber.replace(/\//g, "-")}.pdf`,
  );
  const uploaded = await uploadFile(initialKey, buffer, "application/pdf");

  const updated = await db.transcript.update({
    where: { id: transcriptId },
    data: {
      status: "ISSUED",
      pdfKey: uploaded.key,
      previewKey: null,
      issuedBy: ctx.session.user.id!,
      issuedAt: new Date(),
    },
  });

  // Preview is now superseded by the issued PDF; delete it best-effort.
  if (transcript.previewKey) {
    try {
      await deleteFile(transcript.previewKey);
    } catch {
      // best-effort
    }
  }

  await audit({
    userId: ctx.session.user.id!,
    action: "APPROVE",
    entity: "Transcript",
    entityId: transcriptId,
    module: "academics",
    description: `Issued transcript ${transcript.transcriptNumber}`,
    metadata: { fileKey: uploaded.key },
  });

  return { data: updated };
}

// ─── Batch Transcript Rendering ─────────────────────────────────────

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
  const buffer = await stitchPdfsFromUrls(urls);
  const initialKey = generateFileKey("transcript-batches", ctx.schoolId, `batch-${Date.now()}.pdf`);
  const uploaded = await uploadFile(initialKey, buffer, "application/pdf");
  const url = await getSignedDownloadUrl(uploaded.key);

  return { data: { url, queued: false } };
}
