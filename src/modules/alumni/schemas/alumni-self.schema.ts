import { z } from "zod";

export const updateMyAlumniProfileSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().min(6).max(32).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  currentEmployer: z.string().max(200).optional().nullable(),
  currentPosition: z.string().max(200).optional().nullable(),
  industry: z.string().max(200).optional().nullable(),
  highestEducation: z.string().max(200).optional().nullable(),
  linkedinUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
  bio: z.string().max(2000).optional().nullable(),
  isPublic: z.boolean().optional(),
});

export type UpdateMyAlumniProfileInput = z.infer<typeof updateMyAlumniProfileSchema>;
