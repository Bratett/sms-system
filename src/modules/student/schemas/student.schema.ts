import { z } from "zod";

export const createStudentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  otherNames: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["MALE", "FEMALE"], { message: "Gender is required" }),
  nationality: z.string().optional(),
  hometown: z.string().optional(),
  region: z.string().optional(),
  religion: z.string().optional(),
  bloodGroup: z.string().optional(),
  medicalConditions: z.string().optional(),
  allergies: z.string().optional(),
  boardingStatus: z.enum(["DAY", "BOARDING"]).default("DAY"),
  classArmId: z.string().optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  otherNames: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  nationality: z.string().optional(),
  hometown: z.string().optional(),
  region: z.string().optional(),
  religion: z.string().optional(),
  bloodGroup: z.string().optional(),
  medicalConditions: z.string().optional(),
  allergies: z.string().optional(),
  boardingStatus: z.enum(["DAY", "BOARDING"]).optional(),
  status: z
    .enum(["ACTIVE", "SUSPENDED", "WITHDRAWN", "TRANSFERRED", "COMPLETED", "GRADUATED", "DECEASED"])
    .optional(),
  photoUrl: z.string().nullable().optional(),
});

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const studentFilterSchema = z.object({
  search: z.string().optional(),
  classArmId: z.string().optional(),
  programmeId: z.string().optional(),
  status: z.string().optional(),
  gender: z.string().optional(),
  boardingStatus: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
});

export type StudentFilterInput = z.infer<typeof studentFilterSchema>;
