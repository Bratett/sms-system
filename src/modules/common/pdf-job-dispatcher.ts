"use server";

import { db } from "@/lib/db";
import { getQueue, QUEUE_NAMES, type PdfBatchJobData } from "@/lib/queue";

export async function enqueuePdfJob(input: {
  schoolId: string;
  kind: "ID_CARD_BATCH" | "REPORT_CARD_BATCH" | "TRANSCRIPT_BATCH";
  params: Record<string, unknown>;
  totalItems: number;
  requestedBy: string;
}): Promise<string> {
  const job = await db.pdfJob.create({
    data: {
      schoolId: input.schoolId,
      kind: input.kind,
      params: input.params as never,
      totalItems: input.totalItems,
      requestedBy: input.requestedBy,
      status: "QUEUED",
    },
  });
  const queue = getQueue<PdfBatchJobData>(QUEUE_NAMES.PDF_BATCH);
  await queue.add("render", { pdfJobId: job.id });
  return job.id;
}
