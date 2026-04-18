import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { generateBillsAction } from "@/modules/finance/actions/billing.action";

describe("generateBillsAction — Free SHS placement students", () => {
  beforeEach(() => {
    mockAuthenticatedUser();

    // Fee structure with one TUITION + one BOARDING + one PTA item.
    // No programmeId/boardingStatus → student-filter branch skipped; every student is billed.
    const feeStructure = {
      id: "fee-1",
      schoolId: "default-school",
      academicYearId: "ay-1",
      termId: "term-1",
      programmeId: null,
      boardingStatus: null,
      status: "ACTIVE",
      name: "SHS 1 Fees",
      totalAmount: 3000,
      feeItems: [
        { id: "fi-1", name: "Tuition", amount: 1500, type: "TUITION", isOptional: false },
        { id: "fi-2", name: "Boarding", amount: 1000, type: "BOARDING", isOptional: false },
        { id: "fi-3", name: "PTA Dues", amount: 500, type: "PTA", isOptional: false },
      ],
    };

    prismaMock.feeStructure.findUnique.mockResolvedValue(feeStructure as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "student-free", studentId: "STU/2026/0001", firstName: "Ama", lastName: "M" },
      { id: "student-paying", studentId: "STU/2026/0002", firstName: "Kofi", lastName: "A" },
    ] as never);
    prismaMock.studentBill.findUnique.mockResolvedValue(null);
    prismaMock.studentScholarship.findMany.mockResolvedValue([] as never);
    prismaMock.studentBill.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) =>
        ({ id: `bill-${args.data.studentId}`, ...args.data } as never),
    );
    prismaMock.studentBillItem.createMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.account.findFirst.mockResolvedValue(null); // skip journal posting path
  });

  it("omits tuition items for isFreeShsPlacement students and keeps boarding + PTA", async () => {
    // Two active enrollments: one Free-SHS, one standard.
    prismaMock.enrollment.findMany.mockResolvedValue([
      { studentId: "student-free", isFreeShsPlacement: true },
      { studentId: "student-paying", isFreeShsPlacement: false },
    ] as never);

    const result = await generateBillsAction({ feeStructureId: "fee-1" });
    expect(result).toHaveProperty("data");

    // Find the createMany call for the Free-SHS student.
    const createManyCalls = prismaMock.studentBillItem.createMany.mock.calls;
    expect(createManyCalls.length).toBe(2); // one per student

    // Locate each call via the associated studentBill.create args (which returned bill-<id>).
    const billCreateCalls = prismaMock.studentBill.create.mock.calls;
    const freeStudentBillCall = billCreateCalls.find(
      (c) => (c[0] as { data: { studentId: string } }).data.studentId === "student-free",
    );
    const payingStudentBillCall = billCreateCalls.find(
      (c) => (c[0] as { data: { studentId: string } }).data.studentId === "student-paying",
    );

    // Free-SHS bill total should be 1500 (1000 boarding + 500 PTA).
    expect(
      (freeStudentBillCall?.[0] as { data: { totalAmount: number } }).data.totalAmount,
    ).toBe(1500);
    // Standard bill total should be the full 3000.
    expect(
      (payingStudentBillCall?.[0] as { data: { totalAmount: number } }).data.totalAmount,
    ).toBe(3000);

    // For the Free-SHS student, TUITION (fi-1) must NOT appear in billItems.
    const freeStudentItems = (
      createManyCalls
        .map((c) => (c[0] as { data: Array<{ feeItemId: string }> }).data)
        .find((rows) => rows.some((r) => r.feeItemId === "fi-2" || r.feeItemId === "fi-3")) ?? []
    );
    expect(freeStudentItems.some((r) => r.feeItemId === "fi-1")).toBe(false);
    // It should contain fi-2 (BOARDING) and fi-3 (PTA).
    expect(freeStudentItems.some((r) => r.feeItemId === "fi-2")).toBe(true);
    expect(freeStudentItems.some((r) => r.feeItemId === "fi-3")).toBe(true);
  });

  it("bills the full tuition when the student has no active enrollment row", async () => {
    // No enrollments returned → map is empty → all students billed full tuition.
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);

    const result = await generateBillsAction({ feeStructureId: "fee-1" });
    expect(result).toHaveProperty("data");

    const billCreateCalls = prismaMock.studentBill.create.mock.calls;
    for (const call of billCreateCalls) {
      expect((call[0] as { data: { totalAmount: number } }).data.totalAmount).toBe(3000);
    }
  });
});
