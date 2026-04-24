"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { resolveReportAction } from "@/modules/messaging/actions/message-moderation.action";

type Report = {
  id: string;
  status: "PENDING" | "DISMISSED" | "ACTIONED";
  reason: string;
  reportedAt: Date | string;
  message: { id: string; body: string; authorName: string };
  thread: { id: string; studentName: string };
};

export function ReportsClient({ reports }: { reports: Report[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const resolve = (reportId: string, action: "DISMISS" | "ACTION") => {
    if (action === "ACTION") {
      const ok = window.confirm(
        "Take action on this report? The author may be notified.",
      );
      if (!ok) return;
    }
    const rawNote = window.prompt(`Note (optional) for ${action.toLowerCase()}:`);
    if (rawNote === null) return; // user cancelled
    const note = rawNote.trim() === "" ? undefined : rawNote;
    setActiveReportId(reportId);
    start(async () => {
      try {
        const res = await resolveReportAction({ reportId, action, note });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Report ${action === "DISMISS" ? "dismissed" : "actioned"}.`);
        router.refresh();
      } finally {
        setActiveReportId(null);
      }
    });
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Link href="/students/messaging" className="text-sm text-muted-foreground hover:underline">
          ← Messaging admin
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Report queue</h1>

      {reports.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No pending reports.
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{r.thread.studentName}</span> — reported{" "}
                    {new Date(r.reportedAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Reason: {r.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolve(r.id, "DISMISS")}
                    disabled={activeReportId === r.id}
                    className="text-xs rounded-lg border border-border px-3 py-1 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => resolve(r.id, "ACTION")}
                    disabled={activeReportId === r.id}
                    className="text-xs rounded-lg bg-red-600 text-white px-3 py-1 disabled:opacity-50"
                  >
                    Action
                  </button>
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">By {r.message.authorName}</p>
                <p className="whitespace-pre-wrap">{r.message.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
