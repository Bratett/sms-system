import { PDFDocument } from "pdf-lib";
import { createWorker, QUEUE_NAMES, type PdfBatchJobData } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { uploadFile, generateFileKey } from "@/lib/storage/r2";
import { renderStudentIdCardAction } from "@/modules/student/actions/id-card.action";
import { renderReportCardPdfAction } from "@/modules/academics/actions/report-card.action";
import { renderTranscriptPdfAction } from "@/modules/academics/actions/transcript.action";

const log = logger.child({ worker: "pdf-batch" });

async function stitchPdfs(urls: string[]): Promise<Buffer> {
  const stitched = await PDFDocument.create();
  for (const url of urls) {
    const resp = await fetch(url);
    const bytes = await resp.arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    const pages = await stitched.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => stitched.addPage(p));
  }
  return Buffer.from(await stitched.save());
}

export function startPdfBatchWorker() {
  const worker = createWorker<PdfBatchJobData>(
    QUEUE_NAMES.PDF_BATCH,
    async (job) => {
      const pdfJob = await db.pdfJob.findUnique({ where: { id: job.data.pdfJobId } });
      if (!pdfJob) throw new Error(`PdfJob ${job.data.pdfJobId} not found`);
      if (pdfJob.status === "CANCELLED") return;

      await db.pdfJob.update({
        where: { id: pdfJob.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      try {
        const params = pdfJob.params as Record<string, unknown>;
        const urls: string[] = [];

        if (pdfJob.kind === "ID_CARD_BATCH") {
          const enrollments = await db.enrollment.findMany({
            where: { classArmId: params.classArmId as string, status: "ACTIVE" },
            select: { studentId: true },
          });
          for (const e of enrollments) {
            const res = await renderStudentIdCardAction(e.studentId);
            if ("data" in res) urls.push(res.data.url);
            await db.pdfJob.update({
              where: { id: pdfJob.id },
              data: { completedItems: { increment: 1 } },
            });
          }
        } else if (pdfJob.kind === "REPORT_CARD_BATCH") {
          const enrollments = await db.enrollment.findMany({
            where: { classArmId: params.classArmId as string, status: "ACTIVE" },
            select: { studentId: true },
          });
          for (const e of enrollments) {
            const res = await renderReportCardPdfAction({
              studentId: e.studentId,
              termId: params.termId as string,
            });
            if ("data" in res) urls.push(res.data.url);
            await db.pdfJob.update({
              where: { id: pdfJob.id },
              data: { completedItems: { increment: 1 } },
            });
          }
        } else if (pdfJob.kind === "TRANSCRIPT_BATCH") {
          const studentIds = params.studentIds as string[];
          for (const sid of studentIds) {
            const latest = await db.transcript.findFirst({
              where: { studentId: sid, schoolId: pdfJob.schoolId },
              orderBy: { generatedAt: "desc" },
            });
            if (!latest) continue;
            const res = await renderTranscriptPdfAction(latest.id);
            if ("data" in res) urls.push(res.data.url);
            await db.pdfJob.update({
              where: { id: pdfJob.id },
              data: { completedItems: { increment: 1 } },
            });
          }
        }

        const stitched = await stitchPdfs(urls);
        const initialKey = generateFileKey(
          "pdf-jobs",
          pdfJob.id,
          `${pdfJob.kind.toLowerCase()}-${Date.now()}.pdf`
        );
        const uploaded = await uploadFile(initialKey, stitched, "application/pdf");

        await db.pdfJob.update({
          where: { id: pdfJob.id },
          data: { status: "COMPLETE", completedAt: new Date(), resultFileKey: uploaded.key },
        });
        log.info("pdf-batch complete", { pdfJobId: pdfJob.id, key: uploaded.key });
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
