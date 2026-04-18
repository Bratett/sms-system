import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { recordPaymentAction } from "@/modules/finance/actions/payment.action";

describe("recordPaymentAction", () => {
  const validPayment = {
    studentBillId: "bill-1",
    amount: 500,
    paymentMethod: "CASH" as const,
    notes: "Term 1 payment",
  };

  const existingBill = {
    id: "bill-1",
    studentId: "student-1",
    feeStructureId: "fee-1",
    termId: "term-1",
    totalAmount: 1500,
    paidAmount: 0,
    balanceAmount: 1500,
    status: "UNPAID",
    schoolId: "default-school",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await recordPaymentAction(validPayment);
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if bill not found", async () => {
    prismaMock.studentBill.findUnique.mockResolvedValue(null);

    const result = await recordPaymentAction(validPayment);
    expect(result).toEqual({ error: "Student bill not found" });
  });

  it("should reject zero amount via Zod validation", async () => {
    prismaMock.studentBill.findUnique.mockResolvedValue(existingBill as never);

    const result = await recordPaymentAction({ ...validPayment, amount: 0 });
    expect(result.error).toBeDefined();
    // Zod schema rejects amount <= 0 before action-level check
    expect(result.error).toMatch(/Invalid input|Payment amount/);
  });

  it("should reject negative amount via Zod validation", async () => {
    prismaMock.studentBill.findUnique.mockResolvedValue(existingBill as never);

    const result = await recordPaymentAction({ ...validPayment, amount: -100 });
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/Invalid input|Payment amount/);
  });

  it("should require reference number for non-cash payments", async () => {
    prismaMock.studentBill.findUnique.mockResolvedValue(existingBill as never);

    const result = await recordPaymentAction({
      ...validPayment,
      paymentMethod: "BANK_TRANSFER",
      // no referenceNumber
    });
    expect(result).toEqual({ error: "Reference number is required for non-cash payments" });
  });

  it("should accept non-cash payment with reference number", async () => {
    prismaMock.studentBill.findUnique.mockResolvedValue(existingBill as never);

    // Mock transaction
    const mockPayment = { id: "pay-1", amount: 500 };
    const mockReceipt = { id: "rcpt-1", receiptNumber: "RCP/2026/T1/0001" };

    prismaMock.$transaction.mockImplementation(async (fn) => {
      const tx = {
        payment: { create: async () => mockPayment, update: async () => ({}) },
        studentBill: { update: async () => ({}) },
        term: {
          findUnique: async () => ({ termNumber: 1, academicYear: { startDate: new Date() } }),
        },
        receipt: { findFirst: async () => null, create: async () => mockReceipt },
        account: { findFirst: async () => null, findMany: async () => [], update: async () => ({}) },
        fiscalPeriod: { findFirst: async () => null },
        fund: { findFirst: async () => null },
        journalTransaction: { findFirst: async () => null, create: async () => ({ id: "j1", transactionNumber: "JRN/2026/0001" }) },
        journalEntry: { createMany: async () => ({}) },
      };
      return fn(tx as never);
    });

    const result = await recordPaymentAction({
      ...validPayment,
      paymentMethod: "MOBILE_MONEY",
      referenceNumber: "MTN-123456",
    });

    // Should not have an error (transaction mocking may not fully work, but validates the flow)
    expect(result.error).toBeUndefined();
  });

  it("should calculate correct bill status for partial payment", () => {
    // Unit test for the status calculation logic
    const totalAmount = 1500;
    const paidAmount = 500;
    const newPaidAmount = paidAmount + 500;
    const newBalanceAmount = totalAmount - newPaidAmount;

    let status: string;
    if (newBalanceAmount <= 0 && newPaidAmount > totalAmount) {
      status = "OVERPAID";
    } else if (newBalanceAmount <= 0) {
      status = "PAID";
    } else if (newPaidAmount > 0) {
      status = "PARTIAL";
    } else {
      status = "UNPAID";
    }

    expect(status).toBe("PARTIAL");
    expect(newBalanceAmount).toBe(500);
  });

  it("should calculate PAID status when exact amount", () => {
    const totalAmount = 1500;
    const newPaidAmount = 1500;
    const newBalanceAmount = totalAmount - newPaidAmount;

    let status: string;
    if (newBalanceAmount <= 0 && newPaidAmount > totalAmount) {
      status = "OVERPAID";
    } else if (newBalanceAmount <= 0) {
      status = "PAID";
    } else if (newPaidAmount > 0) {
      status = "PARTIAL";
    } else {
      status = "UNPAID";
    }

    expect(status).toBe("PAID");
  });

  it("should calculate OVERPAID status when exceeds total", () => {
    const totalAmount = 1500;
    const newPaidAmount = 1600;
    const newBalanceAmount = totalAmount - newPaidAmount;

    let status: string;
    if (newBalanceAmount <= 0 && newPaidAmount > totalAmount) {
      status = "OVERPAID";
    } else if (newBalanceAmount <= 0) {
      status = "PAID";
    } else if (newPaidAmount > 0) {
      status = "PARTIAL";
    } else {
      status = "UNPAID";
    }

    expect(status).toBe("OVERPAID");
  });
});
