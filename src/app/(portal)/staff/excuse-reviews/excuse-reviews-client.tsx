"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import {
  approveExcuseRequestAction,
  rejectExcuseRequestAction,
} from "@/modules/parent-requests/actions/excuse.action";
import { getParentRequestAttachmentUrlAction } from "@/modules/parent-requests/actions/attachment.action";

type Row = {
  id: string;
  fromDate: Date | string;
  toDate: Date | string;
  reason: string;
  attachmentKey: string | null;
  attachmentName: string | null;
  createdAt: Date | string;
  student: { id: string; firstName: string; lastName: string };
  submittedBy: { firstName: string | null; lastName: string | null } | null;
};

export function ExcuseReviewsClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const download = (id: string) =>
    start(async () => {
      const res = await getParentRequestAttachmentUrlAction({ kind: "excuse", requestId: id });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });

  const approve = (id: string) => {
    start(async () => {
      const res = await approveExcuseRequestAction({ requestId: id });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Excuse approved.");
      router.refresh();
    });
  };

  const reject = (id: string) => {
    const note = rejectNote.trim();
    if (!note) {
      toast.error("A note is required to reject.");
      return;
    }
    start(async () => {
      const res = await rejectExcuseRequestAction({ requestId: id, reviewNote: note });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Excuse rejected.");
      setRejectingId(null);
      setRejectNote("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Excuse reviews"
        description="Pending excuse requests for students in your class arm or boarding house."
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No pending excuse requests.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const submitter =
              [r.submittedBy?.firstName, r.submittedBy?.lastName].filter(Boolean).join(" ") ||
              "Parent";
            return (
              <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <div>
                  <p className="font-medium">
                    {r.student.firstName} {r.student.lastName} •{" "}
                    {new Date(r.fromDate).toLocaleDateString()}
                    {r.fromDate !== r.toDate
                      ? ` → ${new Date(r.toDate).toLocaleDateString()}`
                      : ""}
                  </p>
                  <p className="text-xs text-gray-500">submitted by {submitter}</p>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{r.reason}</p>
                  {r.attachmentKey && (
                    <button
                      onClick={() => download(r.id)}
                      className="mt-1 text-xs text-teal-600 hover:underline"
                    >
                      📎 {r.attachmentName ?? "attachment"}
                    </button>
                  )}
                </div>

                {rejectingId === r.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder="Reason for rejecting…"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectNote("");
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => reject(r.id)}
                        disabled={pending}
                        className="rounded-lg bg-red-600 text-white px-3 py-1 text-xs disabled:opacity-50"
                      >
                        Confirm reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setRejectingId(r.id)}
                      disabled={pending}
                      className="rounded-lg border border-red-600 text-red-700 px-3 py-1 text-sm"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => approve(r.id)}
                      disabled={pending}
                      className="rounded-lg bg-teal-600 text-white px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
