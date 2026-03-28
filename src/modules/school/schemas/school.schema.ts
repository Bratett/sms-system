import { z } from "zod";

export const updateSchoolSchema = z.object({
  name: z.string().min(2, "School name must be at least 2 characters"),
  motto: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  region: z.string().optional().or(z.literal("")),
  district: z.string().optional().or(z.literal("")),
  town: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  type: z.enum(["DAY", "BOARDING", "DAY_BOARDING"]),
  category: z.enum(["PUBLIC", "PRIVATE"]),
  ghanaEducationServiceCode: z.string().optional().or(z.literal("")),
});

export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
