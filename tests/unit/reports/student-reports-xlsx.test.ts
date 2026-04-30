import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { renderRosterXlsx } from "@/modules/reports/xlsx/student-reports";

describe("renderRosterXlsx", () => {
  it("returns a Buffer with one row per student plus header", () => {
    const buffer = renderRosterXlsx({
      schoolName: "Demo SHS",
      filterSummary: "Form 2A · 2025/2026",
      generatedAt: new Date("2026-04-30T10:00:00Z"),
      generatedBy: "Test Admin",
      data: {
        totalStudents: 2,
        students: [
          {
            id: "s1",
            studentId: "SCH/2024/0001",
            name: "Adwoa Mensah",
            className: "Form 2 A",
            gender: "FEMALE",
            boardingStatus: "DAY",
            status: "ACTIVE",
          },
          {
            id: "s2",
            studentId: "SCH/2024/0002",
            name: "Kwame Boateng",
            className: "Form 2 A",
            gender: "MALE",
            boardingStatus: "BOARDING",
            status: "ACTIVE",
          },
        ],
        genderDistribution: { MALE: 1, FEMALE: 1 },
        boardingBreakdown: { DAY: 1, BOARDING: 1 },
        statusBreakdown: [{ status: "ACTIVE", count: 2 }],
      },
    });

    expect(buffer).toBeInstanceOf(Buffer);
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(rows.length).toBe(2);
    expect(rows[0]["Student ID"]).toBe("SCH/2024/0001");
    expect(rows[0]["Name"]).toBe("Adwoa Mensah");
  });
});
