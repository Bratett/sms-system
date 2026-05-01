import { generateExport } from "@/lib/export";
import type { CensusRow } from "@/modules/reports/actions/student-census.action";
import type { NominalRollRow } from "@/modules/reports/actions/student-nominal-roll.action";
import type { FormRegisterRow } from "@/modules/reports/actions/student-form-register.action";
import type { BirthdayRow } from "@/modules/reports/actions/student-birthday-list.action";
import type { MissingDocsRow } from "@/modules/reports/actions/student-missing-docs.action";

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

export function renderFormRegisterXlsx(input: {
  schoolName: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: FormRegisterRow[];
  weeks: number;
  daysPerWeek: number;
}): Buffer {
  // Build dynamic columns: # / ID / Name / Sex + W1D1, W1D2, ..., W{weeks}D{daysPerWeek}
  const baseCols = [
    { key: "row", header: "#" },
    { key: "studentId", header: "Student ID" },
    { key: "fullName", header: "Name" },
    { key: "gender", header: "Sex" },
  ];
  const tickCols: { key: string; header: string }[] = [];
  for (let w = 1; w <= input.weeks; w++) {
    for (let d = 1; d <= input.daysPerWeek; d++) {
      const k = `w${w}d${d}`;
      tickCols.push({ key: k, header: `W${w}D${d}` });
    }
  }
  // Augment data with empty tick fields so generateExport emits the columns
  const data = input.rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    for (const c of tickCols) out[c.key] = "";
    return out;
  });
  return generateExport({
    filename: "form-register",
    sheetName: "Form Register",
    format: "xlsx",
    columns: [...baseCols, ...tickCols],
    data,
  });
}

export function renderBirthdayListXlsx(input: {
  schoolName: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: BirthdayRow[];
  includeGuardianPhone: boolean;
  mode: "month" | "upcomingDays";
}): Buffer {
  const cols = [
    { key: "studentId", header: "Student ID" },
    { key: "name", header: "Name" },
    { key: "className", header: "Class" },
    { key: "dateOfBirth", header: "DOB", transform: (v: unknown) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "") },
    { key: "ageTurning", header: "Age Turning" },
  ];
  if (input.mode === "upcomingDays") cols.push({ key: "daysUntil", header: "Days Until" });
  if (input.includeGuardianPhone) cols.push({ key: "primaryGuardianPhone", header: "Guardian Phone" });
  return generateExport({
    filename: "birthday-list", sheetName: "Birthdays", format: "xlsx",
    columns: cols,
    data: input.rows as unknown as Record<string, unknown>[],
  });
}

export function renderMissingDocsXlsx(input: {
  schoolName: string;
  filterSummary: string;
  generatedAt: Date;
  generatedBy: string;
  rows: MissingDocsRow[];
  note?: string;
}): Buffer {
  const data: MissingDocsRow[] = input.note
    ? [{
        studentId: "—",
        name: "(no data)",
        className: "—",
        missingTypes: [input.note],
        expiredTypes: [],
      }]
    : input.rows;

  return generateExport({
    filename: "missing-documents", sheetName: "Missing", format: "xlsx",
    columns: [
      { key: "studentId", header: "Student ID" },
      { key: "name", header: "Name" },
      { key: "className", header: "Class" },
      { key: "missingTypes", header: "Missing", transform: (v) => Array.isArray(v) ? v.join(", ") : "" },
      { key: "expiredTypes", header: "Expired", transform: (v) => Array.isArray(v) ? (v as Array<{ name: string; expiredOn: Date | null }>).map((e) => `${e.name} (${e.expiredOn ? e.expiredOn.toISOString().slice(0, 10) : "?"})`).join(", ") : "" },
    ],
    data: data as unknown as Record<string, unknown>[],
  });
}
