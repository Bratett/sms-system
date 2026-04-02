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

// ─── Incident Types ────────────────────────────────────────────────

export interface IncidentRow {
  id: string;
  incidentNumber: string;
  hostelName: string;
  hostelId: string;
  dormitoryName: string | null;
  studentNames: string[];
  studentIds: string[];
  reportedByName: string;
  date: Date;
  time: string | null;
  category: string;
  severity: string;
  title: string;
  description: string;
  actionTaken: string | null;
  status: string;
  resolvedByName: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
  linkedDisciplineId: string | null;
  parentNotified: boolean;
  createdAt: Date;
}

export interface IncidentStats {
  total: number;
  reported: number;
  investigating: number;
  actionTaken: number;
  resolved: number;
  escalated: number;
  dismissed: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

// ─── Sick Bay Types ────────────────────────────────────────────────

export interface SickBayAdmissionRow {
  id: string;
  admissionNumber: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  hostelName: string;
  hostelId: string;
  admittedByName: string;
  admittedAt: Date;
  symptoms: string;
  initialDiagnosis: string | null;
  temperature: number | null;
  severity: string;
  status: string;
  treatmentNotes: string | null;
  dischargedByName: string | null;
  dischargedAt: Date | null;
  dischargeNotes: string | null;
  referredTo: string | null;
  parentNotified: boolean;
  medicationCount: number;
}

export interface MedicationLogRow {
  id: string;
  medicationName: string;
  dosage: string;
  administeredByName: string;
  administeredAt: Date;
  notes: string | null;
}

export interface SickBayStats {
  currentlyAdmitted: number;
  underObservation: number;
  totalDischarged: number;
  totalReferred: number;
  bySeverity: Record<string, number>;
}

// ─── Visitor Types ─────────────────────────────────────────────────

export interface VisitorRow {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  visitorName: string;
  relationship: string;
  visitorPhone: string;
  visitorIdNumber: string | null;
  purpose: string;
  hostelName: string;
  hostelId: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  checkedInByName: string;
  checkedOutByName: string | null;
  status: string;
  notes: string | null;
}

export interface VisitorStats {
  activeVisitors: number;
  todayTotal: number;
  weekTotal: number;
  byRelationship: Record<string, number>;
}

// ─── Transfer Types ────────────────────────────────────────────────

export interface TransferRow {
  id: string;
  transferNumber: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  fromHostel: string;
  fromDormitory: string;
  fromBed: string;
  toHostel: string;
  toDormitory: string;
  toBed: string;
  reason: string;
  reasonDetails: string | null;
  requestedByName: string;
  requestedAt: Date;
  status: string;
  approvedByName: string | null;
  approvedAt: Date | null;
  completedAt: Date | null;
  rejectionReason: string | null;
}

export interface TransferStats {
  pending: number;
  approved: number;
  completed: number;
  rejected: number;
}

// ─── Inspection Types ──────────────────────────────────────────────

export interface InspectionRow {
  id: string;
  hostelName: string;
  hostelId: string;
  dormitoryName: string | null;
  inspectedByName: string;
  inspectionDate: Date;
  type: string;
  overallRating: string;
  cleanlinessRating: string;
  facilityRating: string;
  safetyRating: string;
  remarks: string | null;
  issues: string | null;
  followUpRequired: boolean;
  createdAt: Date;
}

// ─── Maintenance Types ─────────────────────────────────────────────

export interface MaintenanceRow {
  id: string;
  requestNumber: string;
  hostelName: string;
  hostelId: string;
  dormitoryName: string | null;
  bedNumber: string | null;
  reportedByName: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignedToName: string | null;
  assignedAt: Date | null;
  resolvedAt: Date | null;
  resolvedByName: string | null;
  resolutionNotes: string | null;
  createdAt: Date;
}

export interface MaintenanceStats {
  open: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}
