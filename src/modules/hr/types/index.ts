export interface StaffRow {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  gender: string;
  phone: string;
  email: string | null;
  staffType: string;
  status: string;
  position: string | null;
  departmentName: string | null;
  createdAt: Date;
}

export interface StaffDetail {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  dateOfBirth: Date | null;
  gender: string;
  phone: string;
  email: string | null;
  address: string | null;
  region: string | null;
  ghanaCardNumber: string | null;
  ssnitNumber: string | null;
  tinNumber: string | null;
  staffType: string;
  specialization: string | null;
  qualifications: { degree: string; institution: string; year?: string }[] | null;
  dateOfFirstAppointment: Date | null;
  dateOfPostingToSchool: Date | null;
  photoUrl: string | null;
  status: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  employments: EmploymentRecord[];
  leaveBalances: LeaveBalanceRecord[];
  user: { id: string; username: string; email: string | null; status: string } | null;
}

export interface EmploymentRecord {
  id: string;
  position: string;
  rank: string | null;
  departmentId: string | null;
  departmentName: string | null;
  startDate: Date;
  endDate: Date | null;
  appointmentType: string;
  salaryGrade: string | null;
  status: string;
}

export interface LeaveBalanceRecord {
  id: string;
  leaveTypeName: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

export interface LeaveRequestRow {
  id: string;
  staffId: string;
  staffName: string;
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  reason: string | null;
  status: string;
  appliedAt: Date;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

export interface LeaveTypeRow {
  id: string;
  name: string;
  defaultDays: number;
  requiresApproval: boolean;
  applicableGender: string | null;
  status: string;
}

export interface PayrollPeriodRow {
  id: string;
  month: number;
  year: number;
  status: string;
  entriesCount: number;
  totalNetPay: number;
  createdAt: Date;
}

export interface PayrollEntryRow {
  id: string;
  staffId: string;
  staffName: string;
  staffStaffId: string;
  basicSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  netPay: number;
  details: {
    allowances: { name: string; amount: number }[];
    deductions: { name: string; amount: number }[];
  } | null;
}

export interface AllowanceRow {
  id: string;
  name: string;
  type: string;
  amount: number;
  status: string;
}

export interface DeductionRow {
  id: string;
  name: string;
  type: string;
  amount: number;
  isStatutory: boolean;
  status: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface StaffOption {
  id: string;
  staffId: string;
  name: string;
}
