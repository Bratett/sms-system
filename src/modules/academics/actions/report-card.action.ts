"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  uploadFile,
  getSignedDownloadUrl,
  generateFileKey,
} from "@/lib/storage/r2";
import { renderPdfToBuffer, PDF_SYNC_THRESHOLD } from "@/lib/pdf/generator";
import {
  ReportCard,
  type ReportCardProps,
  type SubjectRow,
} from "@/lib/pdf/templates/report-card";
import { enqueuePdfJob } from "@/modules/common/pdf-job-dispatcher";
import { createReportCardBatchJobSchema } from "@/modules/common/schemas/pdf-job.schema";
import { stitchPdfsFromUrls } from "@/lib/pdf/stitch";

// ─── Generate Report Card Data for a Single Student ───────────────────

export async function generateReportCardDataAction(
  studentId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_READ);
  if (denied) return denied;

  // Get student info
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      houseAssignment: true,
    },
  });

  if (!student) {
    return { error: "Student not found." };
  }

  // Get school info
  const school = await db.school.findUnique({
    where: { id: ctx.schoolId },
  });

  if (!school) {
    return { error: "School not found." };
  }

  // Get terminal result with subject results
  const terminalResult = await db.terminalResult.findFirst({
    where: { studentId, termId },
    include: {
      subjectResults: {
        include: {
          subject: {
            select: { id: true, name: true, code: true, type: true },
          },
        },
        orderBy: { subject: { name: "asc" } },
      },
    },
  });

  if (!terminalResult) {
    return {
      error:
        "No computed results found for this student and term. Compute results first.",
    };
  }

  // Get term and academic year info
  const term = await db.term.findUnique({
    where: { id: termId },
    include: {
      academicYear: true,
    },
  });

  if (!term) {
    return { error: "Term not found." };
  }

  // Get enrollment info (class arm -> class -> programme)
  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId,
      academicYearId: term.academicYearId,
      status: "ACTIVE",
    },
    include: {
      classArm: {
        include: {
          class: true,
        },
      },
    },
  });

  // Get programme name
  let programmeName = "";
  if (enrollment?.classArm?.class?.programmeId) {
    const programme = await db.programme.findUnique({
      where: { id: enrollment.classArm.class.programmeId },
      select: { name: true },
    });
    programmeName = programme?.name ?? "";
  }

  // Get house name
  let houseName = "";
  if (student.houseAssignment?.houseId) {
    const house = await db.house.findFirst({
      where: { id: student.houseAssignment.houseId },
      select: { name: true },
    });
    houseName = house?.name ?? "";
  }

  // Get class size (how many students in this class arm have results)
  const classSize = await db.terminalResult.count({
    where: {
      classArmId: terminalResult.classArmId,
      termId,
      academicYearId: term.academicYearId,
    },
  });

  const data = {
    school: {
      name: school.name,
      motto: school.motto ?? "",
      address: school.address ?? "",
      logoUrl: school.logoUrl ?? "",
      phone: school.phone ?? "",
      email: school.email ?? "",
    },
    student: {
      id: student.id,
      studentId: student.studentId,
      name: `${student.lastName} ${student.firstName}${student.otherNames ? " " + student.otherNames : ""}`,
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender,
      class: enrollment
        ? `${enrollment.classArm.class.name} ${enrollment.classArm.name}`
        : "",
      programme: programmeName,
      house: houseName,
    },
    term: {
      id: term.id,
      name: term.name,
      termNumber: term.termNumber,
      academicYear: term.academicYear.name,
      startDate: term.startDate,
      endDate: term.endDate,
    },
    subjectResults: terminalResult.subjectResults.map((sr) => ({
      subjectId: sr.subjectId,
      subjectName: sr.subject.name,
      subjectCode: sr.subject.code,
      subjectType: sr.subject.type,
      classScore: sr.classScore,
      examScore: sr.examScore,
      totalScore: sr.totalScore,
      grade: sr.grade,
      interpretation: sr.interpretation,
      position: sr.position,
      caBreakdown: sr.caBreakdown,
    })),
    overall: {
      totalScore: terminalResult.totalScore,
      averageScore: terminalResult.averageScore,
      position: terminalResult.classPosition,
      classSize,
      overallGrade: terminalResult.overallGrade,
    },
    remarks: {
      teacherRemarks: terminalResult.teacherRemarks ?? "",
      headmasterRemarks: terminalResult.headmasterRemarks ?? "",
    },
    attendance: await (async () => {
      const registers = await db.attendanceRegister.findMany({
        where: {
          classArmId: terminalResult.classArmId,
          date: { gte: term.startDate, lte: term.endDate },
          type: "DAILY",
          status: "CLOSED",
        },
        select: { id: true },
      });
      const registerIds = registers.map((r) => r.id);
      if (registerIds.length === 0) {
        return { totalSchoolDays: 0, present: 0, absent: 0, late: 0, excused: 0, sick: 0 };
      }
      const records = await db.attendanceRecord.findMany({
        where: {
          registerId: { in: registerIds },
          studentId,
        },
        select: { status: true },
      });
      const counts = { present: 0, absent: 0, late: 0, excused: 0, sick: 0 };
      for (const r of records) {
        if (r.status === "PRESENT") counts.present++;
        else if (r.status === "ABSENT") counts.absent++;
        else if (r.status === "LATE") counts.late++;
        else if (r.status === "EXCUSED") counts.excused++;
        else if (r.status === "SICK") counts.sick++;
      }
      return { totalSchoolDays: registerIds.length, ...counts };
    })(),
  };

  return { data };
}

// ─── Generate Report Cards for Entire Class ───────────────────────────

export async function generateClassReportCardsAction(
  classArmId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_READ);
  if (denied) return denied;

  // Get all terminal results for this class arm and term
  const terminalResults = await db.terminalResult.findMany({
    where: { classArmId, termId },
    orderBy: { classPosition: "asc" },
    select: { studentId: true },
  });

  if (terminalResults.length === 0) {
    return {
      error:
        "No computed results found for this class. Compute results first.",
    };
  }

  const reportCards = [];
  const errors: string[] = [];

  for (const result of terminalResults) {
    const cardResult = await generateReportCardDataAction(
      result.studentId,
      termId,
    );
    if ("error" in cardResult) {
      errors.push(cardResult.error);
    } else if (cardResult.data) {
      reportCards.push(cardResult.data);
    }
  }

  return { data: reportCards, errors };
}

// ─── PDF Rendering with R2 Cache ──────────────────────────────────────

type ReportCardData = Extract<
  Awaited<ReturnType<typeof generateReportCardDataAction>>,
  { data: unknown }
>["data"];

function isReportCardCacheFresh(
  renderedAt: Date,
  invalidatedAt: Date | null,
) {
  if (!invalidatedAt) return true;
  return invalidatedAt <= renderedAt;
}

function mapReportCardDataToTemplateProps(
  data: ReportCardData,
): ReportCardProps {
  const subjects: SubjectRow[] = data.subjectResults.map((sr) => ({
    name: sr.subjectName,
    classScore: sr.classScore ?? 0,
    examScore: sr.examScore ?? 0,
    totalScore: sr.totalScore ?? 0,
    grade: sr.grade ?? "",
    interpretation: sr.interpretation ?? "",
    position: sr.position ?? "",
    remarks: "",
    caBreakdown: (sr.caBreakdown as SubjectRow["caBreakdown"]) ?? null,
  }));

  return {
    schoolName: data.school.name,
    schoolMotto: data.school.motto,
    studentName: data.student.name,
    studentId: data.student.studentId,
    className: data.student.class,
    programme: data.student.programme,
    house: data.student.house,
    termName: data.term.name,
    academicYear: data.term.academicYear,
    subjects,
    totalScore: data.overall.totalScore ?? 0,
    averageScore: data.overall.averageScore ?? 0,
    classPosition: data.overall.position ?? "",
    totalStudents: data.overall.classSize,
    classTeacherComment: data.remarks.teacherRemarks,
    headmasterComment: data.remarks.headmasterRemarks,
    promotionStatus: "",
    attendance: data.attendance,
  };
}

export async function renderReportCardPdfAction(input: {
  studentId: string;
  termId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.REPORT_CARDS_GENERATE,
  );
  if (denied) return denied;

  // Cache check
  const cache = await db.reportCardPdfCache.findUnique({
    where: {
      studentId_termId: {
        studentId: input.studentId,
        termId: input.termId,
      },
    },
  });
  if (cache && isReportCardCacheFresh(cache.renderedAt, cache.invalidatedAt)) {
    const url = await getSignedDownloadUrl(cache.fileKey);
    return { data: { url, cached: true } };
  }

  // Load data via the existing data-loader action
  const dataResult = await generateReportCardDataAction(
    input.studentId,
    input.termId,
  );
  if ("error" in dataResult) return dataResult;

  const templateProps = mapReportCardDataToTemplateProps(dataResult.data);
  const buffer = await renderPdfToBuffer(ReportCard(templateProps));
  const initialKey = generateFileKey(
    "report-cards",
    `${input.studentId}-${input.termId}`,
    `report-card-${Date.now()}.pdf`,
  );
  const uploaded = await uploadFile(initialKey, buffer, "application/pdf");
  const key = uploaded.key;

  const now = new Date();
  await db.reportCardPdfCache.upsert({
    where: {
      studentId_termId: {
        studentId: input.studentId,
        termId: input.termId,
      },
    },
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
    metadata: {
      studentId: input.studentId,
      termId: input.termId,
      fileKey: key,
    },
  });

  const url = await getSignedDownloadUrl(key);
  return { data: { url, cached: false } };
}

/**
 * Marks the report card cache row for (studentId, termId) as stale.
 * Called by mark/result mutation actions to force re-render on next access.
 */
export async function invalidateReportCardCacheAction(input: {
  studentId: string;
  termId: string;
}) {
  const result = await db.reportCardPdfCache.updateMany({
    where: { studentId: input.studentId, termId: input.termId },
    data: { invalidatedAt: new Date() },
  });
  return { data: { invalidated: result.count } };
}

export async function renderClassReportCardsPdfAction(input: { classArmId: string; termId: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_GENERATE);
  if (denied) return denied;

  const parsed = createReportCardBatchJobSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { classArmId, termId } = parsed.data;

  const enrollments = await db.enrollment.findMany({
    where: { classArmId, status: "ACTIVE" },
    select: { studentId: true },
  });
  if (enrollments.length === 0) return { error: "No active students in this class arm" };

  if (enrollments.length > PDF_SYNC_THRESHOLD) {
    const jobId = await enqueuePdfJob({
      schoolId: ctx.schoolId,
      kind: "REPORT_CARD_BATCH",
      params: { classArmId, termId },
      totalItems: enrollments.length,
      requestedBy: ctx.session.user.id!,
    });
    return { data: { jobId, queued: true } };
  }

  const urls: string[] = [];
  for (const e of enrollments) {
    const res = await renderReportCardPdfAction({ studentId: e.studentId, termId });
    if ("data" in res) urls.push(res.data.url);
  }
  const buffer = await stitchPdfsFromUrls(urls);
  const initialKey = generateFileKey(
    "report-card-batches",
    `${classArmId}-${termId}`,
    `batch-${Date.now()}.pdf`
  );
  const uploaded = await uploadFile(initialKey, buffer, "application/pdf");
  const url = await getSignedDownloadUrl(uploaded.key);

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "ReportCardBatch",
    entityId: `${classArmId}-${termId}`,
    module: "academics",
    description: `Generated ${enrollments.length} report cards inline`,
    metadata: { fileKey: uploaded.key },
  });

  return { data: { url, queued: false } };
}
