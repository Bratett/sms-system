import { z } from "zod";

// ─── Room Schemas ─────────────────────────────────────────────────

export const createRoomSchema = z.object({
  name: z.string().min(1, "Room name is required"),
  building: z.string().optional(),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").optional(),
  type: z.enum(["CLASSROOM", "LABORATORY", "HALL", "FIELD", "OTHER"], {
    message: "Invalid room type",
  }),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const updateRoomSchema = z.object({
  name: z.string().min(1, "Room name is required").optional(),
  building: z.string().optional().nullable(),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").optional().nullable(),
  type: z
    .enum(["CLASSROOM", "LABORATORY", "HALL", "FIELD", "OTHER"], {
      message: "Invalid room type",
    })
    .optional(),
  isActive: z.boolean().optional(),
});
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;

// ─── Period Schemas ───────────────────────────────────────────────

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createPeriodSchema = z.object({
  name: z.string().min(1, "Period name is required"),
  startTime: z.string().regex(timeRegex, "Start time must be in HH:MM format"),
  endTime: z.string().regex(timeRegex, "End time must be in HH:MM format"),
  order: z.coerce.number().int().min(1, "Order must be at least 1"),
  type: z.enum(["LESSON", "BREAK", "ASSEMBLY", "FREE"], {
    message: "Invalid period type",
  }),
});
export type CreatePeriodInput = z.infer<typeof createPeriodSchema>;

export const updatePeriodSchema = z.object({
  name: z.string().min(1, "Period name is required").optional(),
  startTime: z.string().regex(timeRegex, "Start time must be in HH:MM format").optional(),
  endTime: z.string().regex(timeRegex, "End time must be in HH:MM format").optional(),
  order: z.coerce.number().int().min(1, "Order must be at least 1").optional(),
  type: z
    .enum(["LESSON", "BREAK", "ASSEMBLY", "FREE"], {
      message: "Invalid period type",
    })
    .optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePeriodInput = z.infer<typeof updatePeriodSchema>;

// ─── Timetable Slot Schemas ──────────────────────────────────────

export const createTimetableSlotSchema = z.object({
  academicYearId: z.string().min(1, "Academic year is required"),
  termId: z.string().min(1, "Term is required"),
  classArmId: z.string().min(1, "Class arm is required"),
  subjectId: z.string().min(1, "Subject is required"),
  teacherId: z.string().min(1, "Teacher is required"),
  periodId: z.string().min(1, "Period is required"),
  roomId: z.string().optional(),
  dayOfWeek: z.coerce.number().int().min(1, "Day must be 1 (Monday) to 5 (Friday)").max(5, "Day must be 1 (Monday) to 5 (Friday)"),
});
export type CreateTimetableSlotInput = z.infer<typeof createTimetableSlotSchema>;

export const updateTimetableSlotSchema = z.object({
  subjectId: z.string().min(1, "Subject is required").optional(),
  teacherId: z.string().min(1, "Teacher is required").optional(),
  periodId: z.string().min(1, "Period is required").optional(),
  roomId: z.string().optional().nullable(),
  dayOfWeek: z.coerce
    .number()
    .int()
    .min(1, "Day must be 1 (Monday) to 5 (Friday)")
    .max(5, "Day must be 1 (Monday) to 5 (Friday)")
    .optional(),
});
export type UpdateTimetableSlotInput = z.infer<typeof updateTimetableSlotSchema>;

// ─── Exam Schedule Schemas ───────────────────────────────────────

export const createExamScheduleSchema = z.object({
  academicYearId: z.string().min(1, "Academic year is required"),
  termId: z.string().min(1, "Term is required"),
  subjectId: z.string().min(1, "Subject is required"),
  classId: z.string().min(1, "Class is required"),
  date: z.coerce.date({ message: "Valid date is required" }),
  startTime: z.string().regex(timeRegex, "Start time must be in HH:MM format"),
  endTime: z.string().regex(timeRegex, "End time must be in HH:MM format"),
  roomId: z.string().optional(),
  invigilatorId: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateExamScheduleInput = z.infer<typeof createExamScheduleSchema>;

export const updateExamScheduleSchema = z.object({
  subjectId: z.string().min(1, "Subject is required").optional(),
  classId: z.string().min(1, "Class is required").optional(),
  date: z.coerce.date({ message: "Valid date is required" }).optional(),
  startTime: z.string().regex(timeRegex, "Start time must be in HH:MM format").optional(),
  endTime: z.string().regex(timeRegex, "End time must be in HH:MM format").optional(),
  roomId: z.string().optional().nullable(),
  invigilatorId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type UpdateExamScheduleInput = z.infer<typeof updateExamScheduleSchema>;
