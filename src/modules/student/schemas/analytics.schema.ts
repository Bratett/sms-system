import { z } from "zod";

export const getStudentAnalyticsSchema = z.object({
  academicYearId: z.string().cuid().optional(),
  programmeId: z.string().cuid().optional(),
});

export const exportAnalyticsMetricSchema = z.object({
  metric: z.enum([
    "kpis",
    "enrollmentTrend",
    "demographics.gender",
    "demographics.region",
    "demographics.religion",
    "retention",
    "freeShs",
    "atRisk",
  ]),
  academicYearId: z.string().cuid().optional(),
  programmeId: z.string().cuid().optional(),
});

export type GetStudentAnalyticsInput = z.infer<typeof getStudentAnalyticsSchema>;
export type ExportAnalyticsMetricInput = z.infer<typeof exportAnalyticsMetricSchema>;
