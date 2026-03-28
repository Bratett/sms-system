import { z } from "zod";

export const createLeaveTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  defaultDays: z.number().int().min(0, "Default days must be 0 or more"),
  requiresApproval: z.boolean().optional(),
  applicableGender: z.string().optional(),
});

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;

export const updateLeaveTypeSchema = z.object({
  name: z.string().min(1).optional(),
  defaultDays: z.number().int().min(0).optional(),
  requiresApproval: z.boolean().optional(),
  applicableGender: z.string().optional(),
});

export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;

export const requestLeaveSchema = z.object({
  staffId: z.string().min(1, "Staff member is required"),
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().optional(),
});

export type RequestLeaveInput = z.infer<typeof requestLeaveSchema>;
