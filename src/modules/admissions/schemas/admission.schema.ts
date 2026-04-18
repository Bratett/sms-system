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
      } else if (!/^(\d{10}|\d{12})$/.test(data.beceIndexNumber.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "BECE Index Number must be 10 digits (or 12 digits if the 2-digit year is included). No slashes or spaces.",
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

// ─── Decision (Phase 3) ───────────────────────────────────────────

export const admissionConditionSchema = z.object({
  type: z.string().min(1, "Condition type is required"),
  description: z.string().min(1, "Condition description is required"),
  deadline: z.string().min(1, "Deadline is required"), // ISO date string
});

export type AdmissionConditionInput = z.infer<typeof admissionConditionSchema>;

export const decideApplicationSchema = z
  .object({
    decision: z.enum(
      ["ACCEPTED", "CONDITIONAL_ACCEPT", "WAITLISTED", "REJECTED"],
      { message: "Decision is required" },
    ),
    reason: z.string().optional().or(z.literal("")),
    conditions: z.array(admissionConditionSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "CONDITIONAL_ACCEPT") {
      if (!data.conditions || data.conditions.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Conditional acceptance requires at least one condition.",
          path: ["conditions"],
        });
      }
    }
    if (data.decision === "REJECTED" && (!data.reason || data.reason.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A reason is required for rejection.",
        path: ["reason"],
      });
    }
  });

export type DecideApplicationInput = z.infer<typeof decideApplicationSchema>;

// ─── Interview (Phase 3) ──────────────────────────────────────────

export const scheduleInterviewSchema = z.object({
  scheduledAt: z.string().min(1, "Scheduled date/time is required"),
  location: z.string().optional().or(z.literal("")),
  panelMemberIds: z.array(z.string().min(1)).default([]),
});

export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;

const scoreField = z
  .number()
  .min(0, "Score must be between 0 and 10")
  .max(10, "Score must be between 0 and 10");

export const recordInterviewSchema = z.object({
  academicScore: scoreField,
  behavioralScore: scoreField,
  parentScore: scoreField,
  outcome: z.enum(["PASSED", "CONDITIONAL", "FAILED", "NO_SHOW", "WAIVED"]),
  notes: z.string().optional().or(z.literal("")),
});

export type RecordInterviewInput = z.infer<typeof recordInterviewSchema>;

export const waiveInterviewSchema = z.object({
  reason: z.string().min(1, "A waiver reason is required"),
});

export type WaiveInterviewInput = z.infer<typeof waiveInterviewSchema>;

// ─── Placement verification (Phase 3 staff action) ─────────────────

export const verifyPlacementSchema = z.object({
  programPlaced: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type VerifyPlacementInput = z.infer<typeof verifyPlacementSchema>;

// ─── Appeals (Phase 4) ────────────────────────────────────────────

export const submitAppealSchema = z.object({
  reason: z.string().min(10, "Appeal reason must be at least 10 characters"),
});

export type SubmitAppealInput = z.infer<typeof submitAppealSchema>;

export const resolveAppealSchema = z.object({
  upheld: z.boolean(),
  resolution: z.string().min(1, "Resolution note is required"),
});

export type ResolveAppealInput = z.infer<typeof resolveAppealSchema>;

export const applicationFilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  academicYearId: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
});

export type ApplicationFilterInput = z.infer<typeof applicationFilterSchema>;
