"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateExport, type ExportFormat } from "@/lib/export";

export async function exportAttendanceSummaryAction(data: {
  classArmId: string;
  termId: string;
  format: ExportFormat;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  // Get term info
  const term = await db.term.findUnique({
    where: { id: data.termId },
    select: { name: true, startDate: true, endDate: true, academicYear: { select: { name: true } } },
  });

  if (!term) {
    return { error: "Term not found." };
  }

  // Get class arm info
  const classArm = await db.classArm.findUnique({
    where: { id: data.classArmId },
    select: { name: true, class: { select: { name: true } } },
  });

  if (!classArm) {
    return { error: "Class arm not found." };
  }

  // Get all registers for this class arm within the term date range
  const registers = await db.attendanceRegister.findMany({
    where: {
      classArmId: data.classArmId,
      date: { gte: term.startDate, lte: term.endDate },
    },
    include: { records: true },
  });

  const totalDays = registers.length;

  // Get enrolled students
  const enrollments = await db.enrollment.findMany({
    where: { classArmId: data.classArmId, status: "ACTIVE" },
    include: {
      student: {
        select: { id: true, studentId: true, firstName: true, lastName: true },
      },
    },
    orderBy: { student: { firstName: "asc" } },
  });

  // Build per-student summary
  const allRecords = registers.flatMap((r) => r.records);
  const recordsByStudent = new Map<string, typeof allRecords>();
  for (const record of allRecords) {
    const existing = recordsByStudent.get(record.studentId) ?? [];
    existing.push(record);
    recordsByStudent.set(record.studentId, existing);
  }

  const exportData = enrollments.map((e, index) => {
    const records = recordsByStudent.get(e.student.id) ?? [];
    const present = records.filter((r) => r.status === "PRESENT").length;
    const absent = records.filter((r) => r.status === "ABSENT").length;
    const late = records.filter((r) => r.status === "LATE").length;
    const excused = records.filter((r) => r.status === "EXCUSED" || r.status === "SICK").length;
    const attendanceRate = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 0;

    return {
      no: index + 1,
      studentId: e.student.studentId,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      totalDays,
      present,
      absent,
      late,
      excused,
      attendanceRate,
    };
  });

  const className = `${classArm.class.name} ${classArm.name}`;
  const filename = `Attendance_${className}_${term.name}`.replace(/\s+/g, "_");

  const buffer = generateExport({
    filename,
    format: data.format,
    sheetName: "Attendance Summary",
    columns: [
      { key: "no", header: "#" },
      { key: "studentId", header: "Student ID" },
      { key: "studentName", header: "Student Name" },
      { key: "totalDays", header: "Total Days" },
      { key: "present", header: "Present" },
      { key: "absent", header: "Absent" },
      { key: "late", header: "Late" },
      { key: "excused", header: "Excused/Sick" },
      { key: "attendanceRate", header: "Attendance Rate (%)" },
    ],
    data: exportData as unknown as Record<string, unknown>[],
  });

  // Return as base64 for client-side download
  return {
    data: {
      base64: buffer.toString("base64"),
      filename: `${filename}.${data.format}`,
      contentType:
        data.format === "csv"
          ? "text/csv"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  };
}
