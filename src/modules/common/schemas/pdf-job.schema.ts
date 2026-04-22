import { z } from "zod";

export const createIdCardBatchJobSchema = z.object({
  classArmId: z.string().cuid(),
});

export const createReportCardBatchJobSchema = z.object({
  classArmId: z.string().cuid(),
  termId: z.string().cuid(),
});

export const createTranscriptBatchJobSchema = z.object({
  studentIds: z.array(z.string().cuid()).min(1).max(500),
});
