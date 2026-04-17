"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

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
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSCRIPTS_CREATE);
  if (denied) return denied;

  const transcript = await db.transcript.findUnique({ where: { id } });
  if (!transcript) return { error: "Transcript not found" };

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
