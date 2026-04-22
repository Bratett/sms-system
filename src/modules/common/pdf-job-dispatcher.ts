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

  // If adding to the queue fails, the DB row is already written — without this
  // compensating update the job would be stuck at QUEUED forever (no worker
  // would ever pick it up). Mark it FAILED so operators see the error and can
  // retry or clean up, then rethrow so the caller sees the failure too.
  try {
    const queue = getQueue<PdfBatchJobData>(QUEUE_NAMES.PDF_BATCH);
    await queue.add("render", { pdfJobId: job.id });
  } catch (err) {
    await db.pdfJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: `Failed to enqueue: ${String(err)}`,
      },
    });
    throw err;
  }

  return job.id;
}
