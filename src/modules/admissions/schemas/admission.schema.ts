import { z } from "zod";

export const createApplicationSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  otherNames: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["MALE", "FEMALE"], { message: "Gender is required" }),
  previousSchool: z.string().optional().or(z.literal("")),
  jhsIndexNumber: z.string().optional().or(z.literal("")),
  jhsAggregate: z
    .number()
    .min(6, "JHS aggregate must be at least 6")
    .max(54, "JHS aggregate must be at most 54")
    .optional()
    .nullable(),
  programmePreference1Id: z.string().optional().or(z.literal("")),
  programmePreference2Id: z.string().optional().or(z.literal("")),
  guardianName: z.string().min(1, "Guardian name is required"),
  guardianPhone: z.string().min(1, "Guardian phone is required"),
  guardianEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  guardianRelationship: z.string().optional().or(z.literal("")),
  guardianAddress: z.string().optional().or(z.literal("")),
  guardianOccupation: z.string().optional().or(z.literal("")),
  boardingStatus: z.enum(["DAY", "BOARDING"]).default("DAY"),
  notes: z.string().optional().or(z.literal("")),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

// Schema for public portal applications with conditional CSSPS placement validation
export const publicApplicationSchema = z
  .object({
    applicationType: z.enum(["STANDARD", "PLACEMENT"], {
      message: "Application type is required",
    }),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    otherNames: z.string().optional().or(z.literal("")),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.enum(["MALE", "FEMALE"], { message: "Gender is required" }),
    previousSchool: z.string().optional().or(z.literal("")),
    jhsIndexNumber: z.string().optional().or(z.literal("")),
    jhsAggregate: z
      .number()
      .min(6, "JHS aggregate must be at least 6")
      .max(54, "JHS aggregate must be at most 54")
      .optional()
      .nullable(),
    programmePreference1Id: z.string().optional().or(z.literal("")),
    programmePreference2Id: z.string().optional().or(z.literal("")),
    guardianName: z.string().min(1, "Guardian name is required"),
    guardianPhone: z.string().min(1, "Guardian phone is required"),
    guardianEmail: z.string().email("Invalid email").optional().or(z.literal("")),
    guardianRelationship: z.string().min(1, "Guardian relationship is required"),
    guardianAddress: z.string().min(1, "Guardian address is required"),
    guardianOccupation: z.string().optional().or(z.literal("")),
    boardingStatus: z.enum(["DAY", "BOARDING"]).default("DAY"),
    beceIndexNumber: z.string().optional().or(z.literal("")),
    enrollmentCode: z.string().optional().or(z.literal("")),
    placementSchoolCode: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.applicationType === "PLACEMENT") {
      if (!data.beceIndexNumber || data.beceIndexNumber.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "BECE Index Number is required for placement applications",
          path: ["beceIndexNumber"],
        });
      } else if (!/^\d{3}\/\d{4}\/\d{3}$/.test(data.beceIndexNumber.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "BECE Index Number must be in format ###/####/### (e.g., 012/0045/067)",
          path: ["beceIndexNumber"],
        });
      }

      if (!data.enrollmentCode || data.enrollmentCode.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enrollment Code is required for placement applications",
          path: ["enrollmentCode"],
        });
      } else if (!/^[A-Za-z0-9]{6,}$/.test(data.enrollmentCode.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enrollment Code must be at least 6 alphanumeric characters",
          path: ["enrollmentCode"],
        });
      }
    }
  });

export type PublicApplicationInput = z.infer<typeof publicApplicationSchema>;

// Schema for public application status checking
export const statusCheckSchema = z.object({
  applicationNumber: z.string().min(1, "Application number is required"),
  guardianPhone: z.string().min(1, "Guardian phone number is required"),
});

export type StatusCheckInput = z.infer<typeof statusCheckSchema>;

export const reviewApplicationSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED", "UNDER_REVIEW", "SHORTLISTED"], {
    message: "Decision status is required",
  }),
  notes: z.string().optional().or(z.literal("")),
});

export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>;

export const applicationFilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  academicYearId: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
});

export type ApplicationFilterInput = z.infer<typeof applicationFilterSchema>;
