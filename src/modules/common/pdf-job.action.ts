"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";

export async function listPdfJobsAction(opts?: {
  status?: "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED" | "CANCELLED";
  kind?: "ID_CARD_BATCH" | "REPORT_CARD_BATCH" | "TRANSCRIPT_BATCH";
  limit?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const jobs = await db.pdfJob.findMany({
    where: {
      schoolId: ctx.schoolId,
      ...(opts?.status && { status: opts.status }),
      ...(opts?.kind && { kind: opts.kind }),
    },
    orderBy: { requestedAt: "desc" },
    take: opts?.limit ?? 20,
  });
  return { data: jobs };
}

export async function getPdfJobAction(jobId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const job = await db.pdfJob.findFirst({
    where: { id: jobId, schoolId: ctx.schoolId },
  });
  if (!job) return { error: "Job not found" };
  return { data: job };
}

export async function cancelPdfJobAction(jobId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const job = await db.pdfJob.findFirst({
    where: { id: jobId, schoolId: ctx.schoolId },
  });
  if (!job) return { error: "Job not found" };
  if (job.status === "RUNNING") return { error: "Cannot cancel a running job" };
  if (job.status !== "QUEUED") return { error: `Job is already ${job.status}` };

  const updated = await db.pdfJob.update({
    where: { id: jobId },
    data: { status: "CANCELLED", completedAt: new Date() },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "PdfJob",
    entityId: jobId,
    module: "common",
    description: "Cancelled PDF batch job",
    newData: { status: "CANCELLED" },
  });

  return { data: updated };
}
