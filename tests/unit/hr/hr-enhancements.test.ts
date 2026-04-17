import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  prismaMock,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "../setup";

// ─── Module mocks needed by HR actions ────────────────────────────

vi.mock("@/lib/notifications/dispatcher", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/events", () => ({
  NOTIFICATION_EVENTS: {
    LEAVE_REQUESTED: "leave_requested",
    LEAVE_APPROVED: "leave_approved",
    LEAVE_REJECTED: "leave_rejected",
    PAYROLL_GENERATED: "payroll_generated",
    PAYROLL_APPROVED: "payroll_approved",
    CONTRACT_EXPIRING: "contract_expiring",
    STAFF_DISCIPLINE_REPORTED: "staff_discipline_reported",
  },
  EVENT_CHANNELS: {},
}));

vi.mock("@/lib/crypto/field-encrypt", () => ({
  encryptField: vi.fn((v: string) => `enc:${v}`),
  decryptField: vi.fn((v: string) => v.startsWith("enc:") ? v.slice(4) : v),
  encryptOptional: vi.fn((v: string | null | undefined) => v ? `enc:${v}` : null),
  decryptOptional: vi.fn((v: string | null | undefined) => {
    if (!v) return null;
    return v.startsWith("enc:") ? v.slice(4) : v;
  }),
  isEncrypted: vi.fn((v: string) => v.startsWith("enc:")),
}));

vi.mock("@/lib/storage/r2", () => ({
  uploadFile: vi.fn().mockResolvedValue({ key: "mock-key", url: "https://mock.url" }),
  getSignedDownloadUrl: vi.fn().mockResolvedValue("https://mock-signed.url"),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  generateFileKey: vi.fn((_m: string, _e: string, f: string) => `mock/${f}`),
}));

vi.mock("@/lib/pdf/generator", () => ({
  renderPdfToBuffer: vi.fn().mockResolvedValue(Buffer.from("mock-pdf")),
}));

// ─── Holiday Actions ──────────────────────────────────────────────

import {
  getHolidaysAction,
  createHolidayAction,
  deleteHolidayAction,
  importGhanaHolidaysAction,
} from "@/modules/hr/actions/holiday.action";

describe("Holiday Actions", () => {
  describe("getHolidaysAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await getHolidaysAction();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return paginated holidays", async () => {
      mockAuthenticatedUser();
      prismaMock.publicHoliday.findMany.mockResolvedValue([
        { id: "h-1", name: "Independence Day", date: new Date("2026-03-06"), recurring: true },
      ] as never);
      prismaMock.publicHoliday.count.mockResolvedValue(1 as never);

      const result = await getHolidaysAction({ year: 2026 });
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total", 1);
    });
  });

  describe("createHolidayAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createHolidayAction({ name: "Test", date: "2026-01-01" });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid input", async () => {
      mockAuthenticatedUser();
      const result = await createHolidayAction({ name: "", date: "" });
      expect(result).toHaveProperty("error", "Invalid input");
    });

    it("should reject duplicate dates", async () => {
      mockAuthenticatedUser();
      prismaMock.publicHoliday.findUnique.mockResolvedValue({ id: "existing" } as never);
      const result = await createHolidayAction({ name: "Dup", date: "2026-03-06" });
      expect(result).toEqual({ error: "A holiday already exists on this date." });
    });

    it("should create a holiday successfully", async () => {
      mockAuthenticatedUser();
      prismaMock.publicHoliday.findUnique.mockResolvedValue(null);
      prismaMock.publicHoliday.create.mockResolvedValue({
        id: "h-1", name: "Test Holiday", date: new Date("2026-07-01"), recurring: false,
      } as never);

      const result = await createHolidayAction({ name: "Test Holiday", date: "2026-07-01" });
      expect(result).toHaveProperty("data");
    });
  });

  describe("deleteHolidayAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await deleteHolidayAction("h-1");
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return error if not found", async () => {
      mockAuthenticatedUser();
      prismaMock.publicHoliday.findUnique.mockResolvedValue(null);
      const result = await deleteHolidayAction("nonexistent");
      expect(result).toEqual({ error: "Holiday not found." });
    });

    it("should delete successfully", async () => {
      mockAuthenticatedUser();
      prismaMock.publicHoliday.findUnique.mockResolvedValue({ id: "h-1", name: "Test" } as never);
      prismaMock.publicHoliday.delete.mockResolvedValue({} as never);
      const result = await deleteHolidayAction("h-1");
      expect(result).toEqual({ success: true });
    });
  });

  describe("importGhanaHolidaysAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await importGhanaHolidaysAction(2026);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should import Ghana holidays for a year", async () => {
      mockAuthenticatedUser();
      prismaMock.publicHoliday.findUnique.mockResolvedValue(null);
      prismaMock.publicHoliday.create.mockResolvedValue({} as never);

      const result = await importGhanaHolidaysAction(2026);
      expect(result).toHaveProperty("data");
      expect((result as { data: { imported: number } }).data.imported).toBeGreaterThan(0);
    });
  });
});

// ─── Staff Attendance Actions ─────────────────────────────────────

import {
  recordStaffAttendanceAction,
  bulkRecordStaffAttendanceAction,
  getStaffAttendanceAction,
  getStaffAttendanceSummaryAction,
  getDailyAttendanceOverviewAction,
} from "@/modules/hr/actions/staff-attendance.action";

describe("Staff Attendance Actions", () => {
  describe("recordStaffAttendanceAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await recordStaffAttendanceAction({
        staffId: "s-1", date: "2026-04-01", status: "PRESENT",
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid input", async () => {
      mockAuthenticatedUser();
      const result = await recordStaffAttendanceAction({
        staffId: "", date: "", status: "PRESENT",
      });
      expect(result).toHaveProperty("error", "Invalid input");
    });

    it("should upsert attendance record", async () => {
      mockAuthenticatedUser();
      prismaMock.staffAttendance.upsert.mockResolvedValue({
        id: "att-1", staffId: "s-1", status: "PRESENT",
      } as never);

      const result = await recordStaffAttendanceAction({
        staffId: "s-1", date: "2026-04-01", status: "PRESENT",
      });
      expect(result).toHaveProperty("data");
    });
  });

  describe("bulkRecordStaffAttendanceAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await bulkRecordStaffAttendanceAction({
        date: "2026-04-01", records: [],
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should bulk upsert attendance records", async () => {
      mockAuthenticatedUser();
      prismaMock.staffAttendance.upsert.mockResolvedValue({} as never);

      const result = await bulkRecordStaffAttendanceAction({
        date: "2026-04-01",
        records: [
          { staffId: "s-1", status: "PRESENT" },
          { staffId: "s-2", status: "LATE" },
        ],
      });
      expect(result).toHaveProperty("saved", 2);
    });
  });

  describe("getStaffAttendanceAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await getStaffAttendanceAction();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return paginated attendance records", async () => {
      mockAuthenticatedUser();
      prismaMock.staffAttendance.findMany.mockResolvedValue([] as never);
      prismaMock.staffAttendance.count.mockResolvedValue(0 as never);

      const result = await getStaffAttendanceAction({ page: 1 });
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total", 0);
    });
  });

  describe("getStaffAttendanceSummaryAction", () => {
    it("should return monthly summary", async () => {
      mockAuthenticatedUser();
      prismaMock.staffAttendance.findMany.mockResolvedValue([
        { status: "PRESENT" },
        { status: "PRESENT" },
        { status: "LATE" },
      ] as never);

      const result = await getStaffAttendanceSummaryAction("s-1", 4, 2026);
      expect(result).toHaveProperty("data");
      const data = (result as { data: { PRESENT: number; LATE: number } }).data;
      expect(data.PRESENT).toBe(2);
      expect(data.LATE).toBe(1);
    });
  });

  describe("getDailyAttendanceOverviewAction", () => {
    it("should return daily overview", async () => {
      mockAuthenticatedUser();
      prismaMock.staff.count.mockResolvedValue(10 as never);
      prismaMock.staffAttendance.findMany.mockResolvedValue([
        { status: "PRESENT" },
        { status: "ABSENT" },
      ] as never);

      const result = await getDailyAttendanceOverviewAction("2026-04-01");
      expect(result).toHaveProperty("data");
      const data = (result as { data: { totalActive: number; present: number; absent: number } }).data;
      expect(data.totalActive).toBe(10);
      expect(data.present).toBe(1);
      expect(data.absent).toBe(1);
    });
  });
});

// ─── Contract Actions ─────────────────────────────────────────────

import {
  getStaffContractsAction,
  getAllContractsAction,
  createContractAction,
  renewContractAction,
  getExpiringContractsAction,
} from "@/modules/hr/actions/contract.action";

describe("Contract Actions", () => {
  describe("getStaffContractsAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await getStaffContractsAction("s-1");
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return contracts for a staff member", async () => {
      mockAuthenticatedUser();
      prismaMock.staffContract.findMany.mockResolvedValue([
        { id: "c-1", type: "PERMANENT", status: "ACTIVE" },
      ] as never);

      const result = await getStaffContractsAction("s-1");
      expect(result).toHaveProperty("data");
      expect((result as { data: unknown[] }).data).toHaveLength(1);
    });
  });

  describe("createContractAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createContractAction({
        staffId: "s-1", type: "PERMANENT", startDate: "2026-01-01",
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid input", async () => {
      mockAuthenticatedUser();
      const result = await createContractAction({
        staffId: "", type: "PERMANENT", startDate: "",
      });
      expect(result).toHaveProperty("error", "Invalid input");
    });

    it("should return error if staff not found", async () => {
      mockAuthenticatedUser();
      prismaMock.staff.findUnique.mockResolvedValue(null);
      const result = await createContractAction({
        staffId: "nonexistent", type: "FIXED_TERM", startDate: "2026-01-01",
      });
      expect(result).toEqual({ error: "Staff member not found." });
    });

    it("should create a contract successfully", async () => {
      mockAuthenticatedUser();
      prismaMock.staff.findUnique.mockResolvedValue({ id: "s-1", firstName: "Jane", lastName: "Smith" } as never);
      prismaMock.staffContract.create.mockResolvedValue({
        id: "c-1", type: "FIXED_TERM", status: "ACTIVE",
      } as never);

      const result = await createContractAction({
        staffId: "s-1", type: "FIXED_TERM", startDate: "2026-01-01", endDate: "2027-01-01",
      });
      expect(result).toHaveProperty("data");
    });
  });

  describe("renewContractAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await renewContractAction("c-1", { newEndDate: "2028-01-01" });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return error if contract not found", async () => {
      mockAuthenticatedUser();
      prismaMock.staffContract.findUnique.mockResolvedValue(null);
      const result = await renewContractAction("nonexistent", { newEndDate: "2028-01-01" });
      expect(result).toEqual({ error: "Contract not found." });
    });

    it("should reject renewing non-active contracts", async () => {
      mockAuthenticatedUser();
      prismaMock.staffContract.findUnique.mockResolvedValue({ id: "c-1", status: "EXPIRED" } as never);
      const result = await renewContractAction("c-1", { newEndDate: "2028-01-01" });
      expect(result).toEqual({ error: "Only active contracts can be renewed." });
    });

    it("should renew active contract", async () => {
      mockAuthenticatedUser();
      prismaMock.staffContract.findUnique.mockResolvedValue({
        id: "c-1", status: "ACTIVE", schoolId: "s", staffId: "s-1", type: "FIXED_TERM",
        endDate: new Date("2027-01-01"), terms: "Original",
      } as never);
      prismaMock.staffContract.update.mockResolvedValue({} as never);
      prismaMock.staffContract.create.mockResolvedValue({ id: "c-2", status: "ACTIVE" } as never);

      const result = await renewContractAction("c-1", { newEndDate: "2028-06-01" });
      expect(result).toHaveProperty("data");
    });
  });

  describe("getExpiringContractsAction", () => {
    it("should return contracts expiring within N days", async () => {
      mockAuthenticatedUser();
      prismaMock.staffContract.findMany.mockResolvedValue([
        { id: "c-1", endDate: new Date(), staff: { firstName: "Jane", lastName: "Smith" } },
      ] as never);

      const result = await getExpiringContractsAction(30);
      expect(result).toHaveProperty("data");
      expect((result as { data: unknown[] }).data).toHaveLength(1);
    });
  });
});

// ─── Loan Actions ─────────────────────────────────────────────────

import {
  getLoansAction,
  createLoanAction,
  approveLoanAction,
  cancelLoanAction,
  getLoanRepaymentsAction,
} from "@/modules/hr/actions/loan.action";

describe("Loan Actions", () => {
  describe("createLoanAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createLoanAction({
        staffId: "s-1", type: "SALARY_ADVANCE", amount: 1000, tenure: 6,
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid input", async () => {
      mockAuthenticatedUser();
      const result = await createLoanAction({
        staffId: "", type: "SALARY_ADVANCE", amount: 0, tenure: 0,
      });
      expect(result).toHaveProperty("error", "Invalid input");
    });

    it("should reject if staff has existing active loan", async () => {
      mockAuthenticatedUser();
      prismaMock.staff.findUnique.mockResolvedValue({ id: "s-1" } as never);
      prismaMock.staffLoan.count.mockResolvedValue(1 as never);

      const result = await createLoanAction({
        staffId: "s-1", type: "SALARY_ADVANCE", amount: 1000, tenure: 6,
      });
      expect(result.error).toContain("already has an active");
    });

    it("should create a loan with calculated repayment", async () => {
      mockAuthenticatedUser();
      prismaMock.staff.findUnique.mockResolvedValue({ id: "s-1", firstName: "Jane", lastName: "Smith" } as never);
      prismaMock.staffLoan.count.mockResolvedValue(0 as never);
      prismaMock.staffLoan.create.mockResolvedValue({
        id: "l-1", loanNumber: "LN/2026/0001", amount: 1000,
        monthlyDeduction: 166.67, totalRepayment: 1000, remainingBalance: 1000,
      } as never);

      const result = await createLoanAction({
        staffId: "s-1", type: "SALARY_ADVANCE", amount: 1000, tenure: 6,
      });
      expect(result).toHaveProperty("data");
    });
  });

  describe("approveLoanAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await approveLoanAction("l-1");
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject approving non-pending loans", async () => {
      mockAuthenticatedUser();
      prismaMock.staffLoan.findUnique.mockResolvedValue({ id: "l-1", status: "ACTIVE" } as never);
      const result = await approveLoanAction("l-1");
      expect(result).toEqual({ error: "Only pending loans can be approved." });
    });

    it("should approve pending loan", async () => {
      mockAuthenticatedUser();
      prismaMock.staffLoan.findUnique.mockResolvedValue({ id: "l-1", status: "PENDING", loanNumber: "LN/2026/0001" } as never);
      prismaMock.staffLoan.update.mockResolvedValue({ id: "l-1", status: "ACTIVE" } as never);

      const result = await approveLoanAction("l-1");
      expect(result).toHaveProperty("data");
      expect((result as { data: { status: string } }).data.status).toBe("ACTIVE");
    });
  });

  describe("cancelLoanAction", () => {
    it("should reject cancelling non-pending loans", async () => {
      mockAuthenticatedUser();
      prismaMock.staffLoan.findUnique.mockResolvedValue({ id: "l-1", status: "ACTIVE" } as never);
      const result = await cancelLoanAction("l-1");
      expect(result).toEqual({ error: "Only pending loans can be cancelled." });
    });

    it("should cancel pending loan", async () => {
      mockAuthenticatedUser();
      prismaMock.staffLoan.findUnique.mockResolvedValue({ id: "l-1", status: "PENDING", loanNumber: "LN/2026/0001" } as never);
      prismaMock.staffLoan.update.mockResolvedValue({ id: "l-1", status: "CANCELLED" } as never);

      const result = await cancelLoanAction("l-1");
      expect(result).toHaveProperty("data");
    });
  });

  describe("getLoansAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await getLoansAction();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return paginated loans", async () => {
      mockAuthenticatedUser();
      prismaMock.staffLoan.findMany.mockResolvedValue([] as never);
      prismaMock.staffLoan.count.mockResolvedValue(0 as never);

      const result = await getLoansAction();
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total", 0);
    });
  });

  describe("getLoanRepaymentsAction", () => {
    it("should return repayments for a loan", async () => {
      mockAuthenticatedUser();
      prismaMock.loanRepayment.findMany.mockResolvedValue([
        { id: "r-1", amount: 166.67 },
      ] as never);

      const result = await getLoanRepaymentsAction("l-1");
      expect(result).toHaveProperty("data");
      expect((result as { data: unknown[] }).data).toHaveLength(1);
    });
  });
});

// ─── Promotion Actions ────────────────────────────────────────────

import {
  promoteStaffAction,
  getPromotionHistoryAction,
  getAllPromotionsAction,
} from "@/modules/hr/actions/promotion.action";

describe("Promotion Actions", () => {
  describe("promoteStaffAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await promoteStaffAction({
        staffId: "s-1", effectiveDate: "2026-04-01", newRank: "Senior Teacher",
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid input", async () => {
      mockAuthenticatedUser();
      const result = await promoteStaffAction({
        staffId: "", effectiveDate: "", newRank: "",
      });
      expect(result).toHaveProperty("error", "Invalid input");
    });

    it("should return error if staff not found", async () => {
      mockAuthenticatedUser();
      prismaMock.staff.findUnique.mockResolvedValue(null);
      const result = await promoteStaffAction({
        staffId: "nonexistent", effectiveDate: "2026-04-01", newRank: "Senior",
      });
      expect(result).toEqual({ error: "Staff member not found." });
    });

    it("should create promotion and update employment", async () => {
      mockAuthenticatedUser();
      prismaMock.staff.findUnique.mockResolvedValue({
        id: "s-1", firstName: "Jane", lastName: "Smith",
        employments: [{ id: "e-1", rank: "Teacher", salaryGrade: "Grade 3", status: "ACTIVE" }],
      } as never);
      prismaMock.staffPromotion.create.mockResolvedValue({ id: "p-1" } as never);
      prismaMock.employment.update.mockResolvedValue({} as never);

      const result = await promoteStaffAction({
        staffId: "s-1", effectiveDate: "2026-04-01", newRank: "Senior Teacher", newGrade: "Grade 5",
      });
      expect(result).toHaveProperty("data");
      expect(prismaMock.employment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "e-1" },
          data: expect.objectContaining({ rank: "Senior Teacher", salaryGrade: "Grade 5" }),
        }),
      );
    });
  });

  describe("getPromotionHistoryAction", () => {
    it("should return promotion history for a staff member", async () => {
      mockAuthenticatedUser();
      prismaMock.staffPromotion.findMany.mockResolvedValue([
        { id: "p-1", newRank: "Senior Teacher" },
      ] as never);

      const result = await getPromotionHistoryAction("s-1");
      expect(result).toHaveProperty("data");
      expect((result as { data: unknown[] }).data).toHaveLength(1);
    });
  });
});

// ─── Staff Document Actions ───────────────────────────────────────

import {
  getStaffDocumentsAction,
  uploadStaffDocumentAction,
  deleteStaffDocumentAction,
} from "@/modules/hr/actions/staff-documents.action";

describe("Staff Document Actions", () => {
  describe("getStaffDocumentsAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await getStaffDocumentsAction("s-1");
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return documents for a staff member", async () => {
      mockAuthenticatedUser();
      prismaMock.document.findMany.mockResolvedValue([
        { id: "d-1", title: "Contract", category: "CONTRACT" },
      ] as never);

      const result = await getStaffDocumentsAction("s-1");
      expect(result).toHaveProperty("data");
      expect((result as { data: unknown[] }).data).toHaveLength(1);
    });
  });

  describe("uploadStaffDocumentAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await uploadStaffDocumentAction({
        staffId: "s-1", title: "Test", category: "CERTIFICATE",
        fileKey: "key", fileName: "test.pdf", fileSize: 1024, contentType: "application/pdf",
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid category", async () => {
      mockAuthenticatedUser();
      const result = await uploadStaffDocumentAction({
        staffId: "s-1", title: "Test", category: "INVALID" as never,
        fileKey: "key", fileName: "test.pdf", fileSize: 1024, contentType: "application/pdf",
      });
      expect(result).toHaveProperty("error", "Invalid input");
    });

    it("should upload document successfully", async () => {
      mockAuthenticatedUser();
      prismaMock.staff.findUnique.mockResolvedValue({ id: "s-1", firstName: "Jane", lastName: "Smith" } as never);
      prismaMock.document.create.mockResolvedValue({ id: "d-1", title: "Test" } as never);

      const result = await uploadStaffDocumentAction({
        staffId: "s-1", title: "Test Certificate", category: "CERTIFICATE",
        fileKey: "staff/s-1/cert.pdf", fileName: "cert.pdf", fileSize: 2048, contentType: "application/pdf",
      });
      expect(result).toHaveProperty("data");
    });
  });

  describe("deleteStaffDocumentAction", () => {
    it("should return error if document not found", async () => {
      mockAuthenticatedUser();
      prismaMock.document.findUnique.mockResolvedValue(null);
      const result = await deleteStaffDocumentAction("nonexistent");
      expect(result).toEqual({ error: "Document not found." });
    });

    it("should reject deleting non-staff documents", async () => {
      mockAuthenticatedUser();
      prismaMock.document.findUnique.mockResolvedValue({
        id: "d-1", entityType: "Student", fileKey: "key",
      } as never);
      const result = await deleteStaffDocumentAction("d-1");
      expect(result).toEqual({ error: "Document does not belong to a staff member." });
    });

    it("should delete staff document", async () => {
      mockAuthenticatedUser();
      prismaMock.document.findUnique.mockResolvedValue({
        id: "d-1", entityType: "Staff", fileKey: "key", title: "Test",
      } as never);
      prismaMock.document.delete.mockResolvedValue({} as never);

      const result = await deleteStaffDocumentAction("d-1");
      expect(result).toEqual({ success: true });
    });
  });
});

// ─── Reports Actions ──────────────────────────────────────────────

import {
  getStaffTurnoverReportAction,
  getLeaveUtilizationReportAction,
  getPayrollSummaryReportAction,
  getStaffDemographicsReportAction,
  getAttendanceTrendReportAction,
} from "@/modules/hr/actions/reports.action";

describe("Report Actions", () => {
  describe("getStaffTurnoverReportAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await getStaffTurnoverReportAction("2025-01-01", "2026-01-01");
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return turnover data", async () => {
      mockAuthenticatedUser();
      prismaMock.staff.count.mockResolvedValue(5 as never);

      const result = await getStaffTurnoverReportAction("2025-01-01", "2026-01-01");
      expect(result).toHaveProperty("data");
      expect((result as { data: { turnoverRate: string } }).data.turnoverRate).toContain("%");
    });
  });

  describe("getStaffDemographicsReportAction", () => {
    it("should return demographics data", async () => {
      mockAuthenticatedUser();
      prismaMock.staff.findMany.mockResolvedValue([
        { gender: "MALE", staffType: "TEACHING", dateOfBirth: new Date("1990-01-01") },
        { gender: "FEMALE", staffType: "NON_TEACHING", dateOfBirth: null },
      ] as never);

      const result = await getStaffDemographicsReportAction();
      expect(result).toHaveProperty("data");
      const data = (result as { data: { totalActive: number; gender: Record<string, number> } }).data;
      expect(data.totalActive).toBe(2);
      expect(data.gender.MALE).toBe(1);
      expect(data.gender.FEMALE).toBe(1);
    });
  });

  describe("getPayrollSummaryReportAction", () => {
    it("should return monthly payroll summary", async () => {
      mockAuthenticatedUser();
      prismaMock.payrollPeriod.findMany.mockResolvedValue([
        {
          month: 1, year: 2026, status: "APPROVED",
          entries: [{ basicSalary: 3000, totalAllowances: 500, totalDeductions: 300, netPay: 3200 }],
        },
      ] as never);

      const result = await getPayrollSummaryReportAction(2026);
      expect(result).toHaveProperty("data");
      const data = (result as { data: { monthly: unknown[]; grandTotal: { totalNet: number } } }).data;
      expect(data.monthly).toHaveLength(1);
      expect(data.grandTotal.totalNet).toBeGreaterThan(0);
    });
  });

  describe("getLeaveUtilizationReportAction", () => {
    it("should return leave utilization by type", async () => {
      mockAuthenticatedUser();
      prismaMock.leaveBalance.findMany.mockResolvedValue([
        { totalDays: 20, usedDays: 5, remainingDays: 15, leaveType: { name: "Annual" } },
        { totalDays: 20, usedDays: 10, remainingDays: 10, leaveType: { name: "Annual" } },
      ] as never);

      const result = await getLeaveUtilizationReportAction();
      expect(result).toHaveProperty("data");
      const data = (result as { data: { leaveType: string; staffCount: number }[] }).data;
      expect(data[0].leaveType).toBe("Annual");
      expect(data[0].staffCount).toBe(2);
    });
  });

  describe("getAttendanceTrendReportAction", () => {
    it("should return daily attendance trend", async () => {
      mockAuthenticatedUser();
      prismaMock.staffAttendance.findMany.mockResolvedValue([
        { date: new Date("2026-04-01"), status: "PRESENT" },
        { date: new Date("2026-04-01"), status: "ABSENT" },
        { date: new Date("2026-04-02"), status: "PRESENT" },
      ] as never);

      const result = await getAttendanceTrendReportAction(4, 2026);
      expect(result).toHaveProperty("data");
      const data = (result as { data: { daily: { date: string; present: number }[] } }).data;
      expect(data.daily.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ─── Bulk Leave Balance Action ────────────────────────────────────

import {
  bulkInitializeLeaveBalancesAction,
} from "@/modules/hr/actions/leave.action";

describe("bulkInitializeLeaveBalancesAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await bulkInitializeLeaveBalancesAction("ay-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should initialize leave balances for all active staff", async () => {
    mockAuthenticatedUser();
    prismaMock.staff.findMany.mockResolvedValue([
      { id: "s-1", firstName: "Jane", lastName: "Smith", gender: "FEMALE" },
      { id: "s-2", firstName: "John", lastName: "Doe", gender: "MALE" },
    ] as never);
    prismaMock.leaveType.findMany.mockResolvedValue([
      { id: "lt-1", name: "Annual", defaultDays: 20, applicableGender: null },
      { id: "lt-2", name: "Maternity", defaultDays: 90, applicableGender: "FEMALE" },
    ] as never);
    prismaMock.leaveBalance.findUnique.mockResolvedValue(null);
    prismaMock.leaveBalance.create.mockResolvedValue({} as never);

    const result = await bulkInitializeLeaveBalancesAction("ay-1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: { staffCount: number; created: number } }).data;
    expect(data.staffCount).toBe(2);
    // 2 staff x Annual + 1 female x Maternity = 3
    expect(data.created).toBe(3);
  });

  it("should skip existing balances", async () => {
    mockAuthenticatedUser();
    prismaMock.staff.findMany.mockResolvedValue([
      { id: "s-1", firstName: "Jane", lastName: "Smith", gender: "FEMALE" },
    ] as never);
    prismaMock.leaveType.findMany.mockResolvedValue([
      { id: "lt-1", name: "Annual", defaultDays: 20, applicableGender: null },
    ] as never);
    prismaMock.leaveBalance.findUnique.mockResolvedValue({ id: "existing" } as never);

    const result = await bulkInitializeLeaveBalancesAction("ay-1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: { created: number; skipped: number } }).data;
    expect(data.created).toBe(0);
    expect(data.skipped).toBe(1);
  });
});

// ─── Business Days Utility ────────────────────────────────────────

import { getBusinessDays, toDateKey } from "@/modules/hr/utils/business-days";

describe("Business Days Utility", () => {
  it("should count weekdays only", () => {
    // Mon Apr 6 to Fri Apr 10 = 5 business days
    const count = getBusinessDays(new Date("2026-04-06"), new Date("2026-04-10"));
    expect(count).toBe(5);
  });

  it("should exclude weekends", () => {
    // Mon Apr 6 to Sun Apr 12 = 5 business days (Mon-Fri)
    const count = getBusinessDays(new Date("2026-04-06"), new Date("2026-04-12"));
    expect(count).toBe(5);
  });

  it("should exclude holidays from set", () => {
    const holidays = new Set(["2026-04-08"]); // Wednesday
    const count = getBusinessDays(new Date("2026-04-06"), new Date("2026-04-10"), holidays);
    expect(count).toBe(4); // 5 - 1 holiday
  });

  it("should format dates correctly via toDateKey", () => {
    expect(toDateKey(new Date("2026-03-06"))).toBe("2026-03-06");
    expect(toDateKey(new Date("2026-12-25"))).toBe("2026-12-25");
  });
});
