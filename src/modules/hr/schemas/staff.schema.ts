import { z } from "zod";

export const createStaffSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  otherNames: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE"], { message: "Gender is required" }),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  region: z.string().optional(),
  ghanaCardNumber: z.string().optional(),
  ssnitNumber: z.string().optional(),
  tinNumber: z.string().optional(),
  staffType: z.enum(["TEACHING", "NON_TEACHING"], { message: "Staff type is required" }),
  specialization: z.string().optional(),
  qualifications: z
    .array(
      z.object({
        degree: z.string().min(1, "Degree is required"),
        institution: z.string().min(1, "Institution is required"),
        year: z.string().optional(),
      }),
    )
    .optional(),
  dateOfFirstAppointment: z.string().optional(),
  dateOfPostingToSchool: z.string().optional(),
  // Employment
  position: z.string().min(1, "Position is required"),
  rank: z.string().optional(),
  departmentId: z.string().optional(),
  appointmentType: z.enum(["PERMANENT", "CONTRACT", "NATIONAL_SERVICE", "VOLUNTEER"], {
    message: "Appointment type is required",
  }),
  salaryGrade: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  // Optional user account
  createUserAccount: z.boolean().optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  otherNames: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  region: z.string().optional(),
  ghanaCardNumber: z.string().optional(),
  ssnitNumber: z.string().optional(),
  tinNumber: z.string().optional(),
  staffType: z.enum(["TEACHING", "NON_TEACHING"]).optional(),
  specialization: z.string().optional(),
  qualifications: z
    .array(
      z.object({
        degree: z.string(),
        institution: z.string(),
        year: z.string().optional(),
      }),
    )
    .optional(),
  dateOfFirstAppointment: z.string().optional(),
  dateOfPostingToSchool: z.string().optional(),
});

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const terminateStaffSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
  endDate: z.string().min(1, "End date is required"),
  type: z.enum(["TERMINATED", "RETIRED", "TRANSFERRED"], {
    message: "Termination type is required",
  }),
});

export type TerminateStaffInput = z.infer<typeof terminateStaffSchema>;
