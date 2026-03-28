import { z } from "zod";

export const createTermSchema = z.object({
  academicYearId: z.string().min(1, "Academic year is required"),
  name: z.string().min(1, "Name is required"),
  termNumber: z.coerce.number().min(1).max(3),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});
export type CreateTermInput = z.infer<typeof createTermSchema>;

export const updateTermSchema = createTermSchema.partial().omit({ academicYearId: true });
export type UpdateTermInput = z.infer<typeof updateTermSchema>;
