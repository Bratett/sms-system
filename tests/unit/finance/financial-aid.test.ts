import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createFinancialAidApplicationAction,
  reviewFinancialAidAction,
} from "@/modules/finance/actions/financial-aid.action";

describe("Financial Aid Actions", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  describe("createFinancialAidApplicationAction", () => {
    const validInput = {
      studentId: "student-1",
      academicYearId: "ay-1",
      termId: "term-1",
      aidType: "NEEDS_BASED" as const,
      requestedAmount: 2000,
      reason: "Family experiencing financial hardship",
      supportingDocs: [],
    };

    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createFinancialAidApplicationAction(validInput);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid aid type", async () => {
      const result = await createFinancialAidApplicationAction({ ...validInput, aidType: "INVALID" as never });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject zero requested amount", async () => {
      const result = await createFinancialAidApplicationAction({ ...validInput, requestedAmount: 0 });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject empty reason", async () => {
      const result = await createFinancialAidApplicationAction({ ...validInput, reason: "" });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject if student not found", async () => {
      prismaMock.student.findUnique.mockResolvedValue(null);
      const result = await createFinancialAidApplicationAction(validInput);
      expect(result).toEqual({ error: "Student not found" });
    });

    it("should reject duplicate active application", async () => {
      prismaMock.student.findUnique.mockResolvedValue({ id: "student-1" } as never);
      prismaMock.financialAidApplication.findFirst.mockResolvedValue({ id: "existing" } as never);

      const result = await createFinancialAidApplicationAction(validInput);
      expect(result.error).toContain("already exists");
    });

    it("should create application with valid data", async () => {
      prismaMock.student.findUnique.mockResolvedValue({ id: "student-1", firstName: "Kwame", lastName: "Asante" } as never);
      prismaMock.financialAidApplication.findFirst.mockResolvedValue(null);
      prismaMock.financialAidApplication.create.mockResolvedValue({ id: "aid-1", status: "SUBMITTED" } as never);

      const result = await createFinancialAidApplicationAction(validInput);
      expect(result.data).toBeDefined();
    });
  });

  describe("reviewFinancialAidAction", () => {
    it("should reject if application not found", async () => {
      prismaMock.financialAidApplication.findUnique.mockResolvedValue(null);
      const result = await reviewFinancialAidAction({
        applicationId: "nonexistent", status: "APPROVED", approvedAmount: 1000,
      });
      expect(result).toEqual({ error: "Application not found" });
    });

    it("should reject non-pending application", async () => {
      prismaMock.financialAidApplication.findUnique.mockResolvedValue({
        id: "aid-1", status: "APPROVED",
      } as never);

      const result = await reviewFinancialAidAction({
        applicationId: "aid-1", status: "REJECTED",
      });
      expect(result.error).toContain("submitted or under-review");
    });

    it("should approve application", async () => {
      prismaMock.financialAidApplication.findUnique.mockResolvedValue({
        id: "aid-1", status: "SUBMITTED",
      } as never);
      prismaMock.financialAidApplication.update.mockResolvedValue({
        id: "aid-1", status: "APPROVED", approvedAmount: 1500,
      } as never);

      const result = await reviewFinancialAidAction({
        applicationId: "aid-1", status: "APPROVED", approvedAmount: 1500,
      });
      expect(result.data).toBeDefined();
    });
  });
});
