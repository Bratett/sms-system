import { z } from "zod";

export const createAcademicYearSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});
export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;

export const updateAcademicYearSchema = createAcademicYearSchema.partial();
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
