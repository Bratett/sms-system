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

// ─── Type Exports ───────────────────────────────────────────────────

export type CreateHostelInput = z.infer<typeof createHostelSchema>;
export type UpdateHostelInput = z.infer<typeof updateHostelSchema>;
export type CreateDormitoryInput = z.infer<typeof createDormitorySchema>;
export type UpdateDormitoryInput = z.infer<typeof updateDormitorySchema>;
export type CreateBedsInput = z.infer<typeof createBedsSchema>;
export type AllocateBedInput = z.infer<typeof allocateBedSchema>;
export type RequestExeatInput = z.infer<typeof requestExeatSchema>;
export type ConductRollCallInput = z.infer<typeof conductRollCallSchema>;
