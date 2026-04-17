import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../setup";
import { reconcileWebhookPayment } from "@/lib/payment/reconcile";

// Stub the receipt helper — its internals use $executeRawUnsafe / $queryRawUnsafe
// which aren't representable in the deep mock without extra setup.
vi.mock("@/lib/receipt", () => ({
  generateOnlineReceiptNumber: vi.fn(async () => "RCP/2026/ON/000042"),
}));

describe("reconcileWebhookPayment", () => {
  beforeEach(() => {
    prismaMock.payment.findFirst.mockResolvedValue(null as never);
  });

  it("is idempotent when a payment with the reference already exists", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: "pay-existing" } as never);
    const res = await reconcileWebhookPayment({
      reference: "REF-1",
      amount: 100,
      providerName: "paystack",
      providerDisplayName: "Paystack",
      paymentMethod: "MOBILE_MONEY",
    });
    expect(res.outcome).toBe("already-applied");
    expect(res.paymentId).toBe("pay-existing");
  });

  it("reports transaction-missing when there's no OnlinePaymentTransaction row", async () => {
    prismaMock.onlinePaymentTransaction.findUnique.mockResolvedValue(null as never);
    const res = await reconcileWebhookPayment({
      reference: "REF-2",
      amount: 100,
      providerName: "paystack",
      providerDisplayName: "Paystack",
      paymentMethod: "OTHER",
    });
    expect(res.outcome).toBe("transaction-missing");
  });

  it("reports bill-missing when the referenced bill is gone", async () => {
    prismaMock.onlinePaymentTransaction.findUnique.mockResolvedValue({
      reference: "REF-3",
      studentBillId: "bill-gone",
      studentId: "stu-1",
      schoolId: "default-school",
      provider: "paystack",
      status: "PENDING",
    } as never);
    prismaMock.studentBill.findUnique.mockResolvedValue(null as never);
    const res = await reconcileWebhookPayment({
      reference: "REF-3",
      amount: 100,
      providerName: "paystack",
      providerDisplayName: "Paystack",
      paymentMethod: "OTHER",
    });
    expect(res.outcome).toBe("bill-missing");
  });

  it("applies a clean payment end-to-end", async () => {
    prismaMock.onlinePaymentTransaction.findUnique.mockResolvedValue({
      reference: "REF-4",
      studentBillId: "bill-1",
      studentId: "stu-1",
      schoolId: "school-1",
      provider: "paystack",
      status: "PENDING",
    } as never);
    prismaMock.studentBill.findUnique.mockResolvedValue({
      id: "bill-1",
      schoolId: "school-1",
      studentId: "stu-1",
      paidAmount: 0,
      totalAmount: 100,
      balanceAmount: 100,
    } as never);
    prismaMock.payment.create.mockResolvedValue({ id: "pay-1" } as never);
    prismaMock.receipt.create.mockResolvedValue({ receiptNumber: "RCP/2026/ON/000042" } as never);
    prismaMock.studentBill.update.mockResolvedValue({} as never);
    prismaMock.onlinePaymentTransaction.update.mockResolvedValue({} as never);
    prismaMock.auditLog.create.mockResolvedValue({} as never);
    prismaMock.dunningCase.updateMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      firstName: "Ama",
      lastName: "Mensah",
      guardians: [],
    } as never);

    const res = await reconcileWebhookPayment({
      reference: "REF-4",
      amount: 50,
      providerName: "paystack",
      providerDisplayName: "Paystack",
      paymentMethod: "MOBILE_MONEY",
    });
    expect(res.outcome).toBe("applied");
    expect(res.paymentId).toBe("pay-1");
    expect(res.receiptNumber).toBe("RCP/2026/ON/000042");
    expect(res.newBalance).toBe(50);
  });

  it("auto-resolves dunning when balance is cleared", async () => {
    prismaMock.onlinePaymentTransaction.findUnique.mockResolvedValue({
      reference: "REF-5",
      studentBillId: "bill-2",
      studentId: "stu-2",
      schoolId: "school-1",
      provider: "paystack",
      status: "PENDING",
    } as never);
    prismaMock.studentBill.findUnique
      // first call inside reconcileWebhookPayment (get bill)
      .mockResolvedValueOnce({
        id: "bill-2",
        schoolId: "school-1",
        studentId: "stu-2",
        paidAmount: 0,
        totalAmount: 100,
        balanceAmount: 100,
      } as never)
      // second call inside resolveDunningIfPaid
      .mockResolvedValueOnce({
        id: "bill-2",
        balanceAmount: 0,
      } as never);
    prismaMock.payment.create.mockResolvedValue({ id: "pay-2" } as never);
    prismaMock.receipt.create.mockResolvedValue({ receiptNumber: "RCP/2026/ON/000043" } as never);
    prismaMock.studentBill.update.mockResolvedValue({} as never);
    prismaMock.onlinePaymentTransaction.update.mockResolvedValue({} as never);
    prismaMock.auditLog.create.mockResolvedValue({} as never);
    prismaMock.student.findUnique.mockResolvedValue({
      firstName: "Kofi",
      lastName: "Owusu",
      guardians: [],
    } as never);
    const updateMany = prismaMock.dunningCase.updateMany;
    updateMany.mockResolvedValue({ count: 1 } as never);

    await reconcileWebhookPayment({
      reference: "REF-5",
      amount: 100,
      providerName: "paystack",
      providerDisplayName: "Paystack",
      paymentMethod: "BANK_TRANSFER",
    });
    expect(updateMany).toHaveBeenCalled();
    const arg = (updateMany.mock.calls[0]?.[0] ?? {}) as {
      where?: { studentBillId?: string; status?: { in?: string[] } };
      data?: { status?: string; resolution?: string };
    };
    expect(arg.where?.studentBillId).toBe("bill-2");
    expect(arg.data?.status).toBe("RESOLVED");
  });
});
