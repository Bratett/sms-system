// ─── Hostel Types ───────────────────────────────────────────────────

export interface HostelRow {
  id: string;
  name: string;
  gender: string;
  capacity: number;
  wardenId: string | null;
  wardenName: string | null;
  description: string | null;
  status: string;
  dormitoryCount: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  createdAt: Date;
}

export interface DormitoryRow {
  id: string;
  hostelId: string;
  name: string;
  floor: string | null;
  capacity: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  maintenanceBeds: number;
}

export interface BedRow {
  id: string;
  bedNumber: string;
  status: string;
  studentName: string | null;
  studentId: string | null;
  allocationId: string | null;
}

// ─── Allocation Types ───────────────────────────────────────────────

export interface AllocationRow {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  hostelName: string;
  hostelId: string;
  dormitoryName: string;
  bedNumber: string;
  allocatedAt: Date;
  status: string;
  termId: string;
  academicYearId: string;
}

export interface OccupancyRow {
  hostelId: string;
  hostelName: string;
  gender: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyPercent: number;
}

// ─── Exeat Types ────────────────────────────────────────────────────

export interface ExeatRow {
  id: string;
  exeatNumber: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  type: string;
  reason: string;
  departureDate: Date;
  departureTime: string | null;
  expectedReturnDate: Date;
  actualReturnDate: Date | null;
  actualReturnTime: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  status: string;
  requestedAt: Date;
  approvalCount: number;
}

export interface ExeatStats {
  total: number;
  requested: number;
  housemasterApproved: number;
  headmasterApproved: number;
  rejected: number;
  departed: number;
  returned: number;
  overdue: number;
  cancelled: number;
}

export interface ExeatApprovalRow {
  id: string;
  approverRole: string;
  approverName: string;
  action: string;
  comments: string | null;
  actionAt: Date;
}

// ─── Roll Call Types ────────────────────────────────────────────────

export interface RollCallHistoryRow {
  id: string;
  hostelId: string;
  date: Date;
  type: string;
  conductedBy: string;
  conductedAt: Date;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  exeatCount: number;
  sickBayCount: number;
}

export interface RollCallRecordRow {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  status: string;
  notes: string | null;
}

export interface BoardingStudentRow {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  dormitory: string;
  bed: string;
}
