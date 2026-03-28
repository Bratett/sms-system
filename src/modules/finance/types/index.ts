export type FeeStructureStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type BillStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID" | "WAIVED";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CHEQUE" | "OTHER";
export type PaymentStatus = "CONFIRMED" | "REVERSED";
export type ReversalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BoardingStatus = "DAY" | "BOARDING";

export interface FeeItemData {
  id: string;
  feeStructureId: string;
  name: string;
  code: string | null;
  amount: number;
  isOptional: boolean;
  description: string | null;
}

export interface FeeStructureListItem {
  id: string;
  name: string;
  academicYearId: string;
  termId: string;
  programmeId: string | null;
  boardingStatus: string | null;
  status: FeeStructureStatus;
  termName: string;
  academicYearName: string;
  programmeName: string | null;
  totalAmount: number;
  itemCount: number;
  billCount: number;
}

export interface StudentBillListItem {
  id: string;
  studentId: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: BillStatus;
  studentName: string;
  studentIdNumber: string;
  className: string;
}

export interface PaymentListItem {
  id: string;
  studentId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  receivedBy: string;
  receivedAt: Date | string;
  status: PaymentStatus;
  notes: string | null;
  studentName: string;
  studentIdNumber: string;
  receivedByName: string;
  receiptNumber: string | null;
}
