import { createWorker, QUEUE_NAMES, type PdfBatchJobData } from "@/lib/queue";
import { logger } from "@/lib/logger";

const log = logger.child({ worker: "pdf-batch" });

export function startPdfBatchWorker() {
  const worker = createWorker<PdfBatchJobData>(
    QUEUE_NAMES.PDF_BATCH,
    async (job) => {
      log.info("pdf-batch job received (stub)", { jobId: job.id, pdfJobId: job.data.pdfJobId });
    },
    { concurrency: 2 },
  );

  worker.on("completed", (job) => log.info("pdf-batch job done", { jobId: job.id }));
  worker.on("failed", (job, err) => log.error("pdf-batch job failed", { jobId: job?.id, error: err }));
  return worker;
}
