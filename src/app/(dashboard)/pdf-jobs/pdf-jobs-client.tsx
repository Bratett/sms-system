"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getPdfJobAction,
  cancelPdfJobAction,
} from "@/modules/common/pdf-job.action";

export type PdfJobRow = {
  id: string;
  kind: string;
  status: string;
  completedItems: number;
  totalItems: number;
  resultFileKey: string | null;
  error: string | null;
  requestedAt: Date | string;
};

export function PdfJobsClient({
  jobs: initial,
  error,
}: {
  jobs: PdfJobRow[];
  error: string | null;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<PdfJobRow[]>(initial);
  const [, start] = useTransition();

  useEffect(() => {
    setJobs(initial);
  }, [initial]);

  useEffect(() => {
    const active = jobs.some(
      (j) => j.status === "QUEUED" || j.status === "RUNNING",
    );
    if (!active) return;

    const interval = setInterval(async () => {
      const updated = await Promise.all(
        jobs.map(async (j) => {
          if (j.status !== "QUEUED" && j.status !== "RUNNING") return j;
          const res = await getPdfJobAction(j.id);
          return "data" in res ? (res.data as PdfJobRow) : j;
        }),
      );
      setJobs(updated);
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs]);

  const handleCancel = (id: string) =>
    start(async () => {
      const res = await cancelPdfJobAction(id);
      if ("error" in res) toast.error(res.error as string);
      else {
        toast.success("Job cancelled");
        router.refresh();
      }
    });

  const handleDownload = (fileKey: string) => {
    window.open(
      `/api/files/${encodeURIComponent(fileKey)}`,
      "_blank",
      "noreferrer",
    );
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">PDF Generations</h1>
      <p className="text-sm text-muted-foreground">
        Background PDF batch jobs queued for this school. Completed jobs offer a
        download link; queued jobs can be cancelled.
      </p>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No PDF generation jobs.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="p-2">Kind</th>
                <th className="p-2">Requested</th>
                <th className="p-2">Status</th>
                <th className="p-2">Progress</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="p-2">{j.kind.replace("_BATCH", "")}</td>
                  <td className="p-2">
                    {new Date(j.requestedAt).toLocaleString()}
                  </td>
                  <td className="p-2">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                      {j.status}
                    </span>
                  </td>
                  <td className="p-2">
                    {j.completedItems} / {j.totalItems}
                  </td>
                  <td className="p-2 text-right space-x-3 whitespace-nowrap">
                    {j.status === "COMPLETE" && j.resultFileKey ? (
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => handleDownload(j.resultFileKey!)}
                      >
                        Download
                      </button>
                    ) : null}
                    {j.status === "QUEUED" ? (
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => handleCancel(j.id)}
                      >
                        Cancel
                      </button>
                    ) : null}
                    {j.status === "FAILED" ? (
                      <span
                        className="text-xs text-red-700"
                        title={j.error ?? undefined}
                      >
                        Failed
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
