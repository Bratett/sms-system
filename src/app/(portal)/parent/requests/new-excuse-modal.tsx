"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getParentChildrenAction } from "@/modules/portal/actions/parent.action";
import { submitExcuseRequestAction } from "@/modules/parent-requests/actions/excuse.action";
import { getParentRequestAttachmentUploadUrlAction } from "@/modules/parent-requests/actions/attachment.action";
import {
  PortalAttachmentUpload,
  type PortalAttachmentMeta,
} from "@/components/portal/attachment-upload";

type Child = { id: string; firstName: string; lastName: string };

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function iso14DaysAgo(): string {
  return new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function NewExcuseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState("");
  const [fromDate, setFromDate] = useState(isoToday());
  const [toDate, setToDate] = useState(isoToday());
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<PortalAttachmentMeta | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const res = await getParentChildrenAction();
      setLoading(false);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setChildren(res.data as Child[]);
      if (res.data.length > 0) setStudentId(res.data[0].id);
    })();
  }, []);

  const submit = () => {
    if (!studentId || !reason.trim()) return;
    start(async () => {
      const res = await submitExcuseRequestAction({
        studentId,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        reason: reason.trim(),
        ...(attachment ?? {}),
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Excuse request submitted.");
      onCreated();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold">Excuse an absence</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading children…</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-gray-500">No linked children.</p>
        ) : (
          <>
            <label className="block text-sm">
              <span className="font-medium">Child</span>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="font-medium">From</span>
                <input
                  type="date"
                  value={fromDate}
                  min={iso14DaysAgo()}
                  max={isoToday()}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">To</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={isoToday()}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="font-medium">Reason</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. Kofi had a fever on Monday."
              />
            </label>

            <PortalAttachmentUpload
              requestUploadUrl={(input) =>
                getParentRequestAttachmentUploadUrlAction({ kind: "excuse", ...input })
              }
              value={attachment}
              onChange={setAttachment}
              disabled={pending}
            />
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || !studentId || !reason.trim()}
            className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
