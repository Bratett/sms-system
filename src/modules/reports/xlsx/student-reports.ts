import { generateExport } from "@/lib/export";
import type { CensusRow } from "@/modules/reports/actions/student-census.action";
import type { NominalRollRow } from "@/modules/reports/actions/student-nominal-roll.action";

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

export function renderCensusXlsx(input: {
  schoolName: string;
  generatedAt: Date;
  generatedBy: string;
  groupBy: string;
  rows: CensusRow[];
}): Buffer {
  return generateExport({
    filename: "student-census",
    sheetName: `Census by ${input.groupBy}`,
    format: "xlsx",
    columns: [
      { key: "groupLabel", header: input.groupBy.charAt(0).toUpperCase() + input.groupBy.slice(1) },
      { key: "total", header: "Total" },
      { key: "male", header: "Male" },
      { key: "female", header: "Female" },
      { key: "day", header: "Day" },
      { key: "boarding", header: "Boarding" },
    ],
    data: input.rows as unknown as Record<string, unknown>[],
  });
}

export function renderNominalRollXlsx(input: {
  schoolName: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: NominalRollRow[];
}): Buffer {
  return generateExport({
    filename: "nominal-roll",
    sheetName: "Nominal Roll",
    format: "xlsx",
    columns: [
      { key: "row", header: "#" },
      { key: "studentId", header: "Student ID" },
      { key: "surname", header: "Surname" },
      { key: "otherNames", header: "Other Names" },
      { key: "gender", header: "Sex" },
      { key: "dateOfBirth", header: "DOB", transform: (v) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "") },
      { key: "primaryGuardianPhone", header: "Guardian Phone" },
    ],
    data: input.rows as unknown as Record<string, unknown>[],
  });
}
