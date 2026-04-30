import { describe, it, expect } from "vitest";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { StudentRosterPdf } from "@/lib/pdf/templates/student-roster";
import React from "react";

describe("StudentRosterPdf", () => {
  it("renders a non-empty PDF buffer", async () => {
    const buffer = await renderPdfToBuffer(
      React.createElement(StudentRosterPdf, {
        schoolName: "Demo SHS",
        schoolMotto: "Knowledge & Service",
        schoolLogoUrl: null,
        title: "Class Roster",
        filterSummary: "Form 2A · 2025/2026",
        generatedAt: new Date("2026-04-30T10:00:00Z"),
        generatedBy: "Test Admin",
        students: [
          {
            studentId: "SCH/2024/0001",
            name: "Adwoa Mensah",
            className: "Form 2 A",
            gender: "FEMALE",
            boardingStatus: "DAY",
            status: "ACTIVE",
          },
        ],
        totals: { total: 1, male: 0, female: 1, day: 1, boarding: 0 },
      }),
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
