import { createWorker, QUEUE_NAMES, type PdfBatchJobData } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { uploadFile, generateFileKey } from "@/lib/storage/r2";
import { stitchPdfsFromUrls } from "@/lib/pdf/stitch";
import { renderStudentIdCardAction } from "@/modules/student/actions/id-card.action";
import { renderReportCardPdfAction } from "@/modules/academics/actions/report-card.action";
import { renderTranscriptPdfAction } from "@/modules/academics/actions/transcript.action";

const log = logger.child({ worker: "pdf-batch" });

export function startPdfBatchWorker() {
  const worker = createWorker<PdfBatchJobData>(
    QUEUE_NAMES.PDF_BATCH,
    async (job) => {
      const pdfJob = await db.pdfJob.findUnique({ where: { id: job.data.pdfJobId } });
      if (!pdfJob) throw new Error(`PdfJob ${job.data.pdfJobId} not found`);
      if (pdfJob.status === "CANCELLED") return;

      // Atomic QUEUED -> RUNNING transition: if a concurrent cancel slipped
      // between the findUnique above and here, this updateMany's count will be
      // 0 and we exit without doing work.
      const claim = await db.pdfJob.updateMany({
        where: { id: pdfJob.id, status: "QUEUED" },
        data: { status: "RUNNING", startedAt: new Date() },
      });
      if (claim.count === 0) {
        log.info("pdf-batch skip: job no longer QUEUED", { pdfJobId: pdfJob.id });
        return;
      }

      try {
        const params = pdfJob.params as Record<string, unknown>;
        const urls: string[] = [];
        const errors: Array<{ id: string; error: string }> = [];

        if (pdfJob.kind === "ID_CARD_BATCH") {
          const enrollments = await db.enrollment.findMany({
            where: {
              classArmId: params.classArmId as string,
              schoolId: pdfJob.schoolId,
              status: "ACTIVE",
            },
            select: { studentId: true },
          });
          for (const e of enrollments) {
            const res = await renderStudentIdCardAction(e.studentId);
            if ("data" in res) {
              urls.push(res.data.url);
              await db.pdfJob.update({
                where: { id: pdfJob.id },
                data: { completedItems: { increment: 1 } },
              });
            } else {
              errors.push({ id: e.studentId, error: res.error });
              log.warn("pdf-batch per-item failure", { pdfJobId: pdfJob.id, studentId: e.studentId, error: res.error });
            }
          }
        } else if (pdfJob.kind === "REPORT_CARD_BATCH") {
          const enrollments = await db.enrollment.findMany({
            where: {
              classArmId: params.classArmId as string,
              schoolId: pdfJob.schoolId,
              status: "ACTIVE",
            },
            select: { studentId: true },
          });
          for (const e of enrollments) {
            const res = await renderReportCardPdfAction({
              studentId: e.studentId,
              termId: params.termId as string,
            });
            if ("data" in res) {
              urls.push(res.data.url);
              await db.pdfJob.update({
                where: { id: pdfJob.id },
                data: { completedItems: { increment: 1 } },
              });
            } else {
              errors.push({ id: e.studentId, error: res.error });
              log.warn("pdf-batch per-item failure", { pdfJobId: pdfJob.id, studentId: e.studentId, error: res.error });
            }
          }
        } else if (pdfJob.kind === "TRANSCRIPT_BATCH") {
          const studentIds = params.studentIds as string[];
          for (const sid of studentIds) {
            const latest = await db.transcript.findFirst({
              where: { studentId: sid, schoolId: pdfJob.schoolId },
              orderBy: { generatedAt: "desc" },
            });
            if (!latest) {
              errors.push({ id: sid, error: "No transcript found for student" });
              log.warn("pdf-batch per-item failure", { pdfJobId: pdfJob.id, studentId: sid, error: "No transcript" });
              continue;
            }
            const res = await renderTranscriptPdfAction(latest.id);
            if ("data" in res) {
              urls.push(res.data.url);
              await db.pdfJob.update({
                where: { id: pdfJob.id },
                data: { completedItems: { increment: 1 } },
              });
            } else {
              errors.push({ id: sid, error: res.error });
              log.warn("pdf-batch per-item failure", { pdfJobId: pdfJob.id, studentId: sid, error: res.error });
            }
          }
        }

        // If every per-item render failed, don't produce an empty stitched PDF
        // and call the job COMPLETE — that masks a total failure as success.
        // Mark the job FAILED with the error summary so operators can see what
        // happened and retry.
        if (urls.length === 0 && errors.length > 0) {
          await db.pdfJob.update({
            where: { id: pdfJob.id },
            data: {
              status: "FAILED",
              completedAt: new Date(),
              error: JSON.stringify({
                message: "All items failed to render",
                failedItems: errors,
              }),
            },
          });
          log.error("pdf-batch failed: all items errored", {
            pdfJobId: pdfJob.id,
            failedCount: errors.length,
          });
          return;
        }

        const stitched = await stitchPdfsFromUrls(urls);
        const initialKey = generateFileKey(
          "pdf-jobs",
          pdfJob.id,
          `${pdfJob.kind.toLowerCase()}-${Date.now()}.pdf`
        );
        const uploaded = await uploadFile(initialKey, stitched, "application/pdf");

        await db.pdfJob.update({
          where: { id: pdfJob.id },
          data: {
            status: "COMPLETE",
            completedAt: new Date(),
            resultFileKey: uploaded.key,
            error: errors.length > 0 ? JSON.stringify({ failedItems: errors }) : null,
          },
        });
        log.info("pdf-batch complete", {
          pdfJobId: pdfJob.id,
          key: uploaded.key,
          failedCount: errors.length,
        });
      } catch (err) {
        await db.pdfJob.update({
          where: { id: pdfJob.id },
          data: { status: "FAILED", completedAt: new Date(), error: String(err) },
        });
        log.error("pdf-batch failed", { pdfJobId: pdfJob.id, error: err });
        throw err;
      }
    },
    { concurrency: 2 },
  );

  worker.on("completed", (job) => log.info("pdf-batch job done", { jobId: job.id }));
  worker.on("failed", (job, err) => log.error("pdf-batch job failed", { jobId: job?.id, error: err }));
  return worker;
}
