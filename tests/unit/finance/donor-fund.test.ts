import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createDonorFundAction,
  allocateDonorFundAction,
  deleteDonorFundAction,
} from "@/modules/finance/actions/donor-fund.action";

describe("Donor Fund Actions", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  describe("createDonorFundAction", () => {
    const validInput = {
      donorName: "Ghana Education Trust",
      donorType: "FOUNDATION" as const,
      totalPledged: 100000,
    };

    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createDonorFundAction(validInput);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject zero pledge amount", async () => {
      const result = await createDonorFundAction({ ...validInput, totalPledged: 0 });
      expect(result.error).toBe("Invalid input");
    });

    it("should create donor fund", async () => {
      prismaMock.donorFund.create.mockResolvedValue({ id: "df-1", donorName: validInput.donorName } as never);

      const result = await createDonorFundAction(validInput);
      expect(result.data).toBeDefined();
    });
  });

  describe("allocateDonorFundAction", () => {
    it("should reject if fund not found", async () => {
      prismaMock.donorFund.findUnique.mockResolvedValue(null);
      const result = await allocateDonorFundAction({
        donorFundId: "nonexistent", studentId: "s-1", termId: "t-1", amount: 500,
      });
      expect(result).toEqual({ error: "Donor fund not found" });
    });

    it("should reject if fund is inactive", async () => {
      prismaMock.donorFund.findUnique.mockResolvedValue({ id: "df-1", isActive: false } as never);
      const result = await allocateDonorFundAction({
        donorFundId: "df-1", studentId: "s-1", termId: "t-1", amount: 500,
      });
      expect(result).toEqual({ error: "Donor fund is inactive" });
    });

    it("should reject if insufficient balance", async () => {
      prismaMock.donorFund.findUnique.mockResolvedValue({
        id: "df-1", isActive: true, totalReceived: 1000, totalDisbursed: 800,
      } as never);

      const result = await allocateDonorFundAction({
        donorFundId: "df-1", studentId: "s-1", termId: "t-1", amount: 500,
      });
      expect(result.error).toContain("Insufficient");
    });

    it("should reject if student not found", async () => {
      prismaMock.donorFund.findUnique.mockResolvedValue({
        id: "df-1", isActive: true, totalReceived: 10000, totalDisbursed: 0,
      } as never);
      prismaMock.student.findUnique.mockResolvedValue(null);

      const result = await allocateDonorFundAction({
        donorFundId: "df-1", studentId: "nonexistent", termId: "t-1", amount: 500,
      });
      expect(result).toEqual({ error: "Student not found" });
    });
  });

  describe("deleteDonorFundAction", () => {
    it("should reject if fund has allocations", async () => {
      prismaMock.donorFund.findUnique.mockResolvedValue({
        id: "df-1", donorName: "Test", _count: { allocations: 3 },
      } as never);

      const result = await deleteDonorFundAction("df-1");
      expect(result.error).toContain("Cannot delete");
    });
  });
});
