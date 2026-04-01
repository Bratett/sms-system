import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { exportAttendanceSummaryAction } from "@/modules/attendance/actions/attendance-export.action";

describe("exportAttendanceSummaryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await exportAttendanceSummaryAction({
      classArmId: "ca-1",
      termId: "term-1",
      format: "csv",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject when term not found", async () => {
    prismaMock.term.findUnique.mockResolvedValue(null);
    const result = await exportAttendanceSummaryAction({
      classArmId: "ca-1",
      termId: "nonexistent",
      format: "csv",
    });
    expect(result).toEqual({ error: "Term not found." });
  });

  it("should reject when class arm not found", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      name: "Term 1",
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-03-27"),
      academicYear: { name: "2025/2026" },
    } as never);
    prismaMock.classArm.findUnique.mockResolvedValue(null);

    const result = await exportAttendanceSummaryAction({
      classArmId: "nonexistent",
      termId: "term-1",
      format: "csv",
    });
    expect(result).toEqual({ error: "Class arm not found." });
  });

  it("should generate CSV export with correct data", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      name: "Term 1",
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-03-27"),
      academicYear: { name: "2025/2026" },
    } as never);
    prismaMock.classArm.findUnique.mockResolvedValue({
      id: "ca-1",
      name: "A",
      class: { name: "SHS 1" },
    } as never);
    prismaMock.attendanceRegister.findMany.mockResolvedValue([
      {
        records: [
          { studentId: "s1", status: "PRESENT" },
          { studentId: "s2", status: "ABSENT" },
        ],
      },
      {
        records: [
          { studentId: "s1", status: "LATE" },
          { studentId: "s2", status: "PRESENT" },
        ],
      },
    ] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        student: { id: "s1", studentId: "SCH/2026/0001", firstName: "Kwame", lastName: "Asante" },
      },
      {
        student: { id: "s2", studentId: "SCH/2026/0002", firstName: "Ama", lastName: "Mensah" },
      },
    ] as never);

    const result = await exportAttendanceSummaryAction({
      classArmId: "ca-1",
      termId: "term-1",
      format: "csv",
    });

    expect(result.data).toBeDefined();
    expect(result.data!.filename).toContain("Attendance_SHS_1_A_Term_1");
    expect(result.data!.filename).toMatch(/\.csv$/);
    expect(result.data!.contentType).toBe("text/csv");
    expect(result.data!.base64).toBeTruthy();

    // Decode and verify CSV content
    const csvContent = Buffer.from(result.data!.base64, "base64").toString("utf-8");
    expect(csvContent).toContain("Kwame Asante");
    expect(csvContent).toContain("Ama Mensah");
    expect(csvContent).toContain("Attendance Rate (%)");
  });

  it("should generate XLSX export", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      name: "Term 1",
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-03-27"),
      academicYear: { name: "2025/2026" },
    } as never);
    prismaMock.classArm.findUnique.mockResolvedValue({
      id: "ca-1",
      name: "A",
      class: { name: "SHS 1" },
    } as never);
    prismaMock.attendanceRegister.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);

    const result = await exportAttendanceSummaryAction({
      classArmId: "ca-1",
      termId: "term-1",
      format: "xlsx",
    });

    expect(result.data).toBeDefined();
    expect(result.data!.filename).toMatch(/\.xlsx$/);
    expect(result.data!.contentType).toContain("spreadsheetml");
  });
});
