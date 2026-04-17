import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getPortalStatementAction,
  initiatePortalPaymentAction,
  confirmPortalPaymentAction,
} from "@/modules/portal/actions/portal-payment.action";

// Stub the payment registry so the tests stay provider-agnostic
vi.mock("@/lib/payment/registry", () => {
  const provider = {
    name: "paystack",
    displayName: "Paystack",
    supportedCurrencies: ["GHS"],
    toSmallestUnit: (n: number) => Math.round(n * 100),
    fromSmallestUnit: (n: number) => n / 100,
    initializePayment: vi.fn().mockResolvedValue({
      success: true,
      authorizationUrl: "https://pay.test/abc",
      accessCode: "acc-1",
      reference: "PTL-test",
    }),
    verifyPayment: vi.fn().mockResolvedValue({
      success: true,
      amount: 5000, // 50 in currency major units
      currency: "GHS",
      reference: "PTL-test",
      channel: "mobile_money",
      paidAt: new Date(),
    }),
  };
  return {
    getPaymentProvider: vi.fn(() => provider),
    getProviderForCurrency: vi.fn(() => provider),
  };
});

describe("Portal payment actions", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("requires auth", async () => {
    mockUnauthenticated();
    const res = await getPortalStatementAction("stu-1");
    expect(res.error).toBe("Unauthorized");
  });

  it("rejects access to non-linked student", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue(null as never);
    prismaMock.student.findUnique.mockResolvedValue({ userId: "other-user" } as never);
    const res = await getPortalStatementAction("stu-1");
    expect(res.error).toMatch(/do not have access/);
  });

  it("returns a statement for an authorised guardian", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue({ id: "g-1" } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({ id: "link-1" } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      studentId: "STD-100",
      firstName: "Ama",
      lastName: "Mensah",
      schoolId: "default-school",
    } as never);
    prismaMock.studentBill.findMany.mockResolvedValue([
      {
        id: "bill-1",
        totalAmount: 1500,
        paidAmount: 500,
        balanceAmount: 1000,
        status: "PARTIAL",
        dueDate: new Date(),
        generatedAt: new Date(),
        feeStructure: { name: "Term 2 fees", termId: "t-1", academicYearId: "y-1" },
        payments: [],
        installments: [],
        penalties: [],
      },
    ] as never);
    const res = await getPortalStatementAction("stu-1");
    expect("data" in res).toBe(true);
    if ("data" in res) {
      expect(res.data.summary.totalBalance).toBe(1000);
      expect(res.data.bills).toHaveLength(1);
    }
  });

  it("rejects payment amount above balance", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue({ id: "g-1" } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({ id: "link-1" } as never);
    prismaMock.studentBill.findUnique.mockResolvedValue({
      id: "bill-1",
      studentId: "stu-1",
      schoolId: "default-school",
      balanceAmount: 500,
      status: "PARTIAL",
    } as never);
    const res = await initiatePortalPaymentAction({
      studentBillId: "bill-1",
      amount: 1000,
      email: "parent@example.com",
    });
    expect(res.error).toMatch(/exceeds outstanding/);
  });

  it("initiates a payment successfully", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue({ id: "g-1" } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({ id: "link-1" } as never);
    prismaMock.studentBill.findUnique.mockResolvedValue({
      id: "bill-1",
      studentId: "stu-1",
      schoolId: "default-school",
      balanceAmount: 500,
      status: "PARTIAL",
    } as never);
    prismaMock.dunningCase.findFirst.mockResolvedValue(null as never);
    prismaMock.onlinePaymentTransaction.create.mockResolvedValue({ id: "ot-1", reference: "PTL-1" } as never);
    const res = await initiatePortalPaymentAction({
      studentBillId: "bill-1",
      amount: 100,
      email: "parent@example.com",
    });
    expect("data" in res).toBe(true);
    if ("data" in res) expect(res.data.authorizationUrl).toMatch(/pay.test/);
  });

  it("confirms a payment and applies it to the bill", async () => {
    prismaMock.onlinePaymentTransaction.findUnique.mockResolvedValue({
      reference: "PTL-test",
      studentId: "stu-1",
      studentBillId: "bill-1",
      schoolId: "default-school",
      provider: "paystack",
      status: "INITIATED",
    } as never);
    prismaMock.guardian.findUnique.mockResolvedValue({ id: "g-1" } as never);
    prismaMock.studentGuardian.findFirst.mockResolvedValue({ id: "link-1" } as never);

    // The $transaction callback uses prismaMock; stub the calls inside.
    prismaMock.studentBill.findUnique.mockResolvedValue({
      id: "bill-1",
      paidAmount: 0,
      totalAmount: 100,
      balanceAmount: 100,
    } as never);
    prismaMock.payment.create.mockResolvedValue({ id: "pay-1" } as never);
    prismaMock.receipt.create.mockResolvedValue({ receiptNumber: "RCP/2026/ONL/ABC123" } as never);
    prismaMock.studentBill.update.mockResolvedValue({
      id: "bill-1",
      balanceAmount: 50,
      status: "PARTIAL",
    } as never);
    prismaMock.onlinePaymentTransaction.update.mockResolvedValue({ reference: "PTL-test" } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      firstName: "Ama",
      lastName: "Mensah",
      guardians: [],
    } as never);

    const res = await confirmPortalPaymentAction("PTL-test");
    expect("data" in res).toBe(true);
    if ("data" in res) {
      expect(res.data.status).toBe("success");
      expect(res.data.receiptNumber).toMatch(/RCP\//);
    }
  });
});
