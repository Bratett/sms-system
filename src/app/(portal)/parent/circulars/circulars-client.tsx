"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { acknowledgeCircularAction } from "@/modules/communication/actions/circular-acknowledgement.action";

type CircularRow = {
  id: string;
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  publishedAt: Date | string;
  requiresAcknowledgement: boolean;
  isAcknowledged: boolean;
};

function StatusBadge({ status }: { status: "pending" | "acknowledged" | "routine" }) {
  const map = {
    pending: { label: "Pending", className: "bg-gray-100 text-gray-700" },
    acknowledged: { label: "Acknowledged", className: "bg-green-100 text-green-800" },
    routine: { label: "Read", className: "bg-gray-50 text-gray-500" },
  };
  const entry = map[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${entry.className}`}>
      {entry.label}
    </span>
  );
}

function PriorityChip({ priority }: { priority: CircularRow["priority"] }) {
  if (priority !== "high" && priority !== "urgent") return null;
  const colors =
    priority === "urgent"
      ? "bg-red-100 text-red-800"
      : "bg-amber-100 text-amber-800";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors}`}>
      {priority.toUpperCase()}
    </span>
  );
}

export function CircularsClient({
  pending,
  history,
}: {
  pending: CircularRow[];
  history: CircularRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "history">(
    pending.length > 0 ? "pending" : "history",
  );
  const [opened, setOpened] = useState<CircularRow | null>(null);
  const [working, start] = useTransition();

  const acknowledge = (id: string) => {
    start(async () => {
      const res = await acknowledgeCircularAction({ announcementId: id });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Acknowledged.");
      setOpened(null);
      router.refresh();
    });
  };

  const rows = tab === "pending" ? pending : history;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Circulars"
        description="Important messages from the school."
      />

      <div className="border-b border-gray-200 flex gap-4 text-sm">
        <button
          onClick={() => setTab("pending")}
          className={`pb-2 ${tab === "pending" ? "border-b-2 border-teal-600 font-semibold" : "text-gray-500"}`}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`pb-2 ${tab === "history" ? "border-b-2 border-teal-600 font-semibold" : "text-gray-500"}`}
        >
          History ({history.length})
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          {tab === "pending"
            ? "You're all caught up. No circulars need your acknowledgement."
            : "No circulars yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const badgeStatus: "pending" | "acknowledged" | "routine" =
              r.requiresAcknowledgement
                ? r.isAcknowledged
                  ? "acknowledged"
                  : "pending"
                : "routine";
            return (
              <div
                key={r.id}
                className="rounded-xl border border-gray-200 bg-white p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setOpened(r)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{r.title}</p>
                      <PriorityChip priority={r.priority} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(r.publishedAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {r.content}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusBadge status={badgeStatus} />
                    {tab === "pending" && r.requiresAcknowledgement && !r.isAcknowledged && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          acknowledge(r.id);
                        }}
                        disabled={working}
                        className="text-xs rounded-lg bg-teal-600 text-white px-3 py-1 disabled:opacity-50"
                      >
                        I acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {opened && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpened(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white p-6 space-y-3 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{opened.title}</h2>
              <PriorityChip priority={opened.priority} />
            </div>
            <p className="text-xs text-gray-500">
              {new Date(opened.publishedAt).toLocaleString()}
            </p>
            <div className="text-sm whitespace-pre-wrap">{opened.content}</div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setOpened(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Close
              </button>
              {opened.requiresAcknowledgement && !opened.isAcknowledged && (
                <button
                  onClick={() => acknowledge(opened.id)}
                  disabled={working}
                  className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  I acknowledge
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
