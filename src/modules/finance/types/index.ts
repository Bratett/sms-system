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

// Phase 1A: Fee Template types
export interface FeeTemplateListItem {
  id: string;
  name: string;
  description: string | null;
  boardingStatus: BoardingStatus | null;
  programmeId: string | null;
  programmeName: string | null;
  isActive: boolean;
  itemCount: number;
  totalAmount: number;
}

export interface FeeTemplateItemData {
  id: string;
  name: string;
  code: string | null;
  amount: number;
  isOptional: boolean;
  description: string | null;
}

// Phase 1A: Installment types
export type InstallmentStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
export type PenaltyType = "PERCENTAGE" | "FIXED_AMOUNT" | "DAILY_PERCENTAGE" | "DAILY_FIXED";
export type WaiverType = "PERCENTAGE" | "FIXED_AMOUNT" | "FULL_WAIVER" | "STAFF_CHILD_DISCOUNT" | "SIBLING_DISCOUNT";
export type WaiverStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface InstallmentPlanListItem {
  id: string;
  name: string;
  feeStructureId: string | null;
  feeStructureName: string | null;
  numberOfInstallments: number;
  isActive: boolean;
  schedules: {
    installmentNumber: number;
    percentageOfTotal: number;
    dueDaysFromStart: number;
    label: string | null;
  }[];
  studentCount: number;
}

export interface StudentInstallmentItem {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: Date | string;
  paidAmount: number;
  status: InstallmentStatus;
  paidAt: Date | string | null;
  label: string | null;
}

export interface LatePenaltyRuleItem {
  id: string;
  name: string;
  type: PenaltyType;
  value: number;
  gracePeriodDays: number;
  maxPenalty: number | null;
  feeStructureId: string | null;
  feeStructureName: string | null;
  isActive: boolean;
  appliedCount: number;
}

// Phase 1B: Subsidy types
export type SubsidyType = "FREE_SHS" | "GOVERNMENT_PLACEMENT" | "CAPITATION_GRANT" | "OTHER_GOVERNMENT";
export type SubsidyStatus = "EXPECTED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "OVERDUE";
export type DonorType = "INDIVIDUAL" | "ORGANIZATION" | "FOUNDATION" | "ALUMNI" | "CORPORATE";
export type AidType = "NEEDS_BASED" | "MERIT_BASED" | "HARDSHIP" | "ORPHAN_SUPPORT" | "COMMUNITY_SPONSORED";
export type AidStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DISBURSED";

export interface GovernmentSubsidyItem {
  id: string;
  name: string;
  subsidyType: SubsidyType;
  academicYearId: string;
  academicYearName: string;
  termId: string | null;
  termName: string | null;
  expectedAmount: number;
  receivedAmount: number;
  variance: number;
  status: SubsidyStatus;
  referenceNumber: string | null;
  disbursementCount: number;
}

export interface DonorFundItem {
  id: string;
  donorName: string;
  donorType: DonorType;
  contactEmail: string | null;
  contactPhone: string | null;
  totalPledged: number;
  totalReceived: number;
  totalDisbursed: number;
  availableBalance: number;
  pledgeUtilization: number;
  purpose: string | null;
  isActive: boolean;
  allocationCount: number;
}

export interface FinancialAidApplicationItem {
  id: string;
  studentId: string;
  studentName: string;
  studentIdNumber: string;
  className: string;
  aidType: AidType;
  requestedAmount: number;
  approvedAmount: number | null;
  reason: string;
  status: AidStatus;
  termName: string;
  academicYearName: string;
  submittedByName: string;
  reviewedByName: string | null;
  createdAt: Date | string;
}

export interface FeeWaiverItem {
  id: string;
  studentBillId: string;
  studentName: string;
  studentIdNumber: string;
  className: string;
  waiverType: WaiverType;
  value: number;
  calculatedAmount: number;
  reason: string;
  status: WaiverStatus;
  requestedBy: string;
  requestedByName: string;
  requestedAt: Date | string;
  approvedBy: string | null;
  approvedByName: string | null;
  reviewedAt: Date | string | null;
  notes: string | null;
}
