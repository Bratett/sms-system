import { generateExport } from "@/lib/export";

export interface RosterStudentRow {
  id: string;
  studentId: string;
  name: string;
  className: string;
  gender: string;
  boardingStatus: string;
  status: string;
}

export interface RosterXlsxInput {
  schoolName: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  data: {
    totalStudents: number;
    students: RosterStudentRow[];
    genderDistribution: { MALE: number; FEMALE: number };
    boardingBreakdown: { DAY: number; BOARDING: number };
    statusBreakdown: { status: string; count: number }[];
  };
}

export function renderRosterXlsx(input: RosterXlsxInput): Buffer {
  return generateExport({
    filename: "student-roster",
    sheetName: "Roster",
    format: "xlsx",
    columns: [
      { key: "studentId", header: "Student ID" },
      { key: "name", header: "Name" },
      { key: "className", header: "Class" },
      { key: "gender", header: "Gender" },
      { key: "boardingStatus", header: "Boarding" },
      { key: "status", header: "Status" },
    ],
    data: input.data.students as unknown as Record<string, unknown>[],
  });
}
