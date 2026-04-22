import { listPdfJobsAction } from "@/modules/common/pdf-job.action";
import { PdfJobsClient, type PdfJobRow } from "./pdf-jobs-client";

export default async function PdfJobsPage() {
  const res = await listPdfJobsAction();
  const jobs: PdfJobRow[] = "data" in res ? (res.data as PdfJobRow[]) : [];
  const error = "error" in res ? (res.error as string) : null;
  return <PdfJobsClient jobs={jobs} error={error} />;
}
