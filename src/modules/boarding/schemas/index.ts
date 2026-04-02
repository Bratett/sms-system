import { z } from "zod";

// ─── Hostel Schemas ─────────────────────────────────────────────────

export const createHostelSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  gender: z.enum(["MALE", "FEMALE"], { message: "Gender must be MALE or FEMALE" }),
  capacity: z.number().int().min(0).optional(),
  wardenId: z.string().optional(),
  description: z.string().optional(),
});

export const updateHostelSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }).optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  capacity: z.number().int().min(0).optional(),
  wardenId: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// ─── Dormitory Schemas ──────────────────────────────────────────────

export const createDormitorySchema = z.object({
  hostelId: z.string().min(1, { message: "Hostel ID is required" }),
  name: z.string().min(1, { message: "Name is required" }),
  floor: z.string().optional(),
  capacity: z.number().int().min(0).optional(),
});

export const updateDormitorySchema = z.object({
  name: z.string().min(1, { message: "Name is required" }).optional(),
  floor: z.string().optional(),
  capacity: z.number().int().min(0).optional(),
});

// ─── Bed Schemas ────────────────────────────────────────────────────

export const createBedsSchema = z.object({
  dormitoryId: z.string().min(1, { message: "Dormitory ID is required" }),
  count: z.number().int().min(1, { message: "At least 1 bed required" }).max(100),
  prefix: z.string().optional(),
});

// ─── Allocation Schemas ─────────────────────────────────────────────

export const allocateBedSchema = z.object({
  studentId: z.string().min(1, { message: "Student ID is required" }),
  bedId: z.string().min(1, { message: "Bed ID is required" }),
  termId: z.string().min(1, { message: "Term ID is required" }),
  academicYearId: z.string().min(1, { message: "Academic year ID is required" }),
});

// ─── Exeat Schemas ──────────────────────────────────────────────────

export const requestExeatSchema = z.object({
  studentId: z.string().min(1, { message: "Student ID is required" }),
  termId: z.string().min(1, { message: "Term ID is required" }),
  reason: z.string().min(1, { message: "Reason is required" }),
  type: z.enum(["NORMAL", "EMERGENCY", "MEDICAL", "WEEKEND", "VACATION"], {
    message: "Invalid exeat type",
  }),
  departureDate: z.string().min(1, { message: "Departure date is required" }),
  departureTime: z.string().optional(),
  expectedReturnDate: z.string().min(1, { message: "Expected return date is required" }),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
});

// ─── Roll Call Schemas ──────────────────────────────────────────────

export const conductRollCallSchema = z.object({
  hostelId: z.string().min(1, { message: "Hostel ID is required" }),
  type: z.enum(["MORNING", "EVENING"], { message: "Type must be MORNING or EVENING" }),
  records: z.array(
    z.object({
      studentId: z.string().min(1, { message: "Student ID is required" }),
      status: z.enum(["PRESENT", "ABSENT", "EXEAT", "SICK_BAY"], {
        message: "Invalid roll call status",
      }),
      notes: z.string().optional(),
    }),
  ).min(1, { message: "At least one record is required" }),
});

// ─── Incident Schemas ──────────────────────────────────────────────

export const reportIncidentSchema = z.object({
  hostelId: z.string().min(1, { message: "Hostel ID is required" }),
  dormitoryId: z.string().optional(),
  studentIds: z.array(z.string().min(1)).min(1, { message: "At least one student is required" }),
  date: z.string().min(1, { message: "Date is required" }),
  time: z.string().optional(),
  category: z.enum([
    "CURFEW_VIOLATION", "PROPERTY_DAMAGE", "BULLYING", "FIGHTING",
    "UNAUTHORIZED_ABSENCE", "SUBSTANCE_ABUSE", "THEFT", "NOISE_DISTURBANCE",
    "HEALTH_EMERGENCY", "SAFETY_HAZARD", "OTHER",
  ], { message: "Invalid incident category" }),
  severity: z.enum(["MINOR", "MODERATE", "MAJOR", "CRITICAL"], { message: "Invalid severity" }),
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().min(1, { message: "Description is required" }),
});

export const updateIncidentSchema = z.object({
  status: z.enum(["REPORTED", "INVESTIGATING", "ACTION_TAKEN", "RESOLVED", "ESCALATED", "DISMISSED"]).optional(),
  actionTaken: z.string().optional(),
  resolution: z.string().optional(),
  severity: z.enum(["MINOR", "MODERATE", "MAJOR", "CRITICAL"]).optional(),
});

// ─── Sick Bay Schemas ──────────────────────────────────────────────

export const admitToSickBaySchema = z.object({
  studentId: z.string().min(1, { message: "Student ID is required" }),
  hostelId: z.string().min(1, { message: "Hostel ID is required" }),
  symptoms: z.string().min(1, { message: "Symptoms are required" }),
  initialDiagnosis: z.string().optional(),
  temperature: z.number().min(30).max(45).optional(),
  severity: z.enum(["MILD", "MODERATE", "SEVERE", "EMERGENCY"], { message: "Invalid severity" }),
});

export const addMedicationSchema = z.object({
  sickBayAdmissionId: z.string().min(1, { message: "Admission ID is required" }),
  medicationName: z.string().min(1, { message: "Medication name is required" }),
  dosage: z.string().min(1, { message: "Dosage is required" }),
  notes: z.string().optional(),
});

// ─── Visitor Schemas ───────────────────────────────────────────────

export const checkInVisitorSchema = z.object({
  studentId: z.string().min(1, { message: "Student ID is required" }),
  hostelId: z.string().min(1, { message: "Hostel ID is required" }),
  visitorName: z.string().min(1, { message: "Visitor name is required" }),
  relationship: z.string().min(1, { message: "Relationship is required" }),
  visitorPhone: z.string().min(1, { message: "Phone number is required" }),
  visitorIdNumber: z.string().optional(),
  purpose: z.string().min(1, { message: "Purpose of visit is required" }),
  notes: z.string().optional(),
});

// ─── Transfer Schemas ──────────────────────────────────────────────

export const requestTransferSchema = z.object({
  studentId: z.string().min(1, { message: "Student ID is required" }),
  fromBedId: z.string().min(1, { message: "Current bed is required" }),
  toBedId: z.string().min(1, { message: "Destination bed is required" }),
  reason: z.enum([
    "STUDENT_REQUEST", "DISCIPLINARY", "MEDICAL", "MAINTENANCE",
    "CONFLICT_RESOLUTION", "REBALANCING", "OTHER",
  ], { message: "Invalid transfer reason" }),
  reasonDetails: z.string().optional(),
  effectiveDate: z.string().optional(),
});

// ─── Inspection Schemas ────────────────────────────────────────────

export const createInspectionSchema = z.object({
  hostelId: z.string().min(1, { message: "Hostel ID is required" }),
  dormitoryId: z.string().optional(),
  inspectionDate: z.string().min(1, { message: "Inspection date is required" }),
  type: z.enum(["ROUTINE", "SURPRISE", "FOLLOW_UP", "END_OF_TERM"], { message: "Invalid inspection type" }),
  overallRating: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"]),
  cleanlinessRating: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"]),
  facilityRating: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"]),
  safetyRating: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"]),
  remarks: z.string().optional(),
  issues: z.string().optional(),
  followUpRequired: z.boolean().optional(),
});

// ─── Maintenance Schemas ───────────────────────────────────────────

export const createMaintenanceSchema = z.object({
  hostelId: z.string().min(1, { message: "Hostel ID is required" }),
  dormitoryId: z.string().optional(),
  bedId: z.string().optional(),
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().min(1, { message: "Description is required" }),
  category: z.enum([
    "PLUMBING", "ELECTRICAL", "FURNITURE", "STRUCTURAL",
    "CLEANING", "PEST_CONTROL", "SECURITY", "OTHER",
  ], { message: "Invalid maintenance category" }),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"], { message: "Invalid priority" }),
});

// ─── Type Exports ───────────────────────────────────────────────────

export type CreateHostelInput = z.infer<typeof createHostelSchema>;
export type UpdateHostelInput = z.infer<typeof updateHostelSchema>;
export type CreateDormitoryInput = z.infer<typeof createDormitorySchema>;
export type UpdateDormitoryInput = z.infer<typeof updateDormitorySchema>;
export type CreateBedsInput = z.infer<typeof createBedsSchema>;
export type AllocateBedInput = z.infer<typeof allocateBedSchema>;
export type RequestExeatInput = z.infer<typeof requestExeatSchema>;
export type ConductRollCallInput = z.infer<typeof conductRollCallSchema>;
export type ReportIncidentInput = z.infer<typeof reportIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type AdmitToSickBayInput = z.infer<typeof admitToSickBaySchema>;
export type AddMedicationInput = z.infer<typeof addMedicationSchema>;
export type CheckInVisitorInput = z.infer<typeof checkInVisitorSchema>;
export type RequestTransferInput = z.infer<typeof requestTransferSchema>;
export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;
export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
