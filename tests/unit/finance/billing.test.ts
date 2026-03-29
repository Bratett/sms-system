import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { generateBillsAction } from "@/modules/finance/actions/billing.action";

describe("generateBillsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await generateBillsAction({ feeStructureId: "fee-1" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if fee structure not found", async () => {
    prismaMock.feeStructure.findUnique.mockResolvedValue(null);

    const result = await generateBillsAction({ feeStructureId: "nonexistent" });
    expect(result).toEqual({ error: "Fee structure not found" });
  });

  it("should reject if fee structure is not ACTIVE", async () => {
    prismaMock.feeStructure.findUnique.mockResolvedValue({
      id: "fee-1",
      schoolId: "default-school",
      status: "DRAFT",
      feeItems: [],
    } as never);

    const result = await generateBillsAction({ feeStructureId: "fee-1" });
    expect(result).toEqual({ error: "Fee structure must be ACTIVE to generate bills" });
  });

  it("should generate bills for eligible students", async () => {
    const feeStructure = {
      id: "fee-1",
      schoolId: "default-school",
      academicYearId: "ay-1",
      termId: "term-1",
      programmeId: "prog-1",
      boardingStatus: null,
      status: "ACTIVE",
      name: "SHS 1 Fees",
      totalAmount: 1500,
      feeItems: [
        { id: "fi-1", name: "Tuition", amount: 1000, category: "TUITION" },
        { id: "fi-2", name: "PTA Dues", amount: 500, category: "PTA" },
      ],
    };

    prismaMock.feeStructure.findUnique.mockResolvedValue(feeStructure as never);

    // Students in the programme
    prismaMock.classArm.findMany.mockResolvedValue([{ id: "ca-1" }] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { studentId: "student-1" },
      { studentId: "student-2" },
    ] as never);

    // Students
    prismaMock.student.findMany.mockResolvedValue([
      { id: "student-1", schoolId: "default-school", status: "ACTIVE" },
      { id: "student-2", schoolId: "default-school", status: "ACTIVE" },
    ] as never);

    // No existing bills
    prismaMock.studentBill.findFirst.mockResolvedValue(null);

    // Mock bill creation
    prismaMock.studentBill.create.mockResolvedValue({
      id: "bill-1",
      studentId: "student-1",
      totalAmount: 1500,
      status: "UNPAID",
    } as never);

    prismaMock.studentBillItem.createMany.mockResolvedValue({ count: 2 } as never);

    const result = await generateBillsAction({ feeStructureId: "fee-1" });

    // Should not return an error
    expect(result.error).toBeUndefined();
  });
});
