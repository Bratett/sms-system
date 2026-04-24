"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveMedicalDisclosureAction,
  rejectMedicalDisclosureAction,
} from "@/modules/parent-requests/actions/medical-disclosure.action";
import { getParentRequestAttachmentUrlAction } from "@/modules/parent-requests/actions/attachment.action";

type Row = {
  id: string;
  category: "ALLERGY" | "CONDITION" | "MEDICATION";
  title: string;
  description: string;
  isUrgent: boolean;
  attachmentKey: string | null;
  attachmentName: string | null;
  createdAt: Date | string;
  student: { id: string; firstName: string; lastName: string };
  submittedBy: { firstName: string | null; lastName: string | null } | null;
};

type SectionProps = {
  title: string;
  items: Row[];
  approvingId: string | null;
  rejectingId: string | null;
  syncValue: string;
  syncEnabled: boolean;
  rejectNote: string;
  pending: boolean;
  setSyncValue: (v: string) => void;
  setSyncEnabled: (v: boolean) => void;
  setRejectNote: (v: string) => void;
  setApprovingId: (v: string | null) => void;
  setRejectingId: (v: string | null) => void;
  download: (id: string) => void;
  openApprove: (row: Row) => void;
  confirmApprove: (row: Row) => void;
  reject: (id: string) => void;
};

function Section({
  title,
  items,
  approvingId,
  rejectingId,
  syncValue,
  syncEnabled,
  rejectNote,
  pending,
  setSyncValue,
  setSyncEnabled,
  setRejectNote,
  setApprovingId,
  setRejectingId,
  download,
  openApprove,
  confirmApprove,
  reject,
}: SectionProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700">{title} ({items.length})</h2>
      {items.length === 0 ? (
        <p className="text-xs text-gray-500 italic">Nothing here.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const submitter =
              [r.submittedBy?.firstName, r.submittedBy?.lastName].filter(Boolean).join(" ") ||
              "Parent";
            return (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div>
                  <p className="font-medium">
                    {r.student.firstName} {r.student.lastName} • {r.category} • {r.title}
                    {r.isUrgent && (
                      <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                        URGENT
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">submitted by {submitter}</p>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{r.description}</p>
                  {r.attachmentKey && (
                    <button
                      onClick={() => download(r.id)}
                      className="mt-1 text-xs text-primary hover:underline"
                    >
                      📎 {r.attachmentName ?? "attachment"}
                    </button>
                  )}
                </div>

                {approvingId === r.id ? (
                  <div className="space-y-2 border-t border-border pt-2">
                    {r.category !== "MEDICATION" && (
                      <>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={syncEnabled}
                            onChange={(e) => setSyncEnabled(e.target.checked)}
                          />
                          Also append to student&apos;s{" "}
                          {r.category === "ALLERGY" ? "allergies" : "medical conditions"}
                        </label>
                        <input
                          value={syncValue}
                          onChange={(e) => setSyncValue(e.target.value)}
                          disabled={!syncEnabled}
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
                        />
                      </>
                    )}
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setApprovingId(null);
                          setSyncValue("");
                        }}
                        className="rounded-lg border border-border px-3 py-1 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => confirmApprove(r)}
                        disabled={pending}
                        className="rounded-lg bg-primary text-primary-foreground px-3 py-1 text-xs"
                      >
                        Confirm approve
                      </button>
                    </div>
                  </div>
                ) : rejectingId === r.id ? (
                  <div className="space-y-2 border-t border-border pt-2">
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder="Reason for rejecting…"
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectNote("");
                        }}
                        className="rounded-lg border border-border px-3 py-1 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => reject(r.id)}
                        disabled={pending}
                        className="rounded-lg bg-red-600 text-white px-3 py-1 text-xs"
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
                      onClick={() => openApprove(r)}
                      disabled={pending}
                      className="rounded-lg bg-primary text-primary-foreground px-3 py-1 text-sm"
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

export function MedicalDisclosuresClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [syncValue, setSyncValue] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const urgent = rows.filter((r) => r.isUrgent);
  const routine = rows.filter((r) => !r.isUrgent);

  const download = (id: string) =>
    start(async () => {
      const res = await getParentRequestAttachmentUrlAction({ kind: "medical", requestId: id });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });

  const openApprove = (row: Row) => {
    setApprovingId(row.id);
    setSyncValue(row.title);
    setSyncEnabled(row.category !== "MEDICATION");
  };

  const confirmApprove = (row: Row) => {
    const syncToStudent =
      syncEnabled && syncValue.trim() && row.category !== "MEDICATION"
        ? row.category === "ALLERGY"
          ? { allergies: syncValue.trim() }
          : { conditions: syncValue.trim() }
        : undefined;

    start(async () => {
      const res = await approveMedicalDisclosureAction({
        disclosureId: row.id,
        syncToStudent,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Disclosure approved.");
      setApprovingId(null);
      setSyncValue("");
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
      const res = await rejectMedicalDisclosureAction({ disclosureId: id, reviewNote: note });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Disclosure rejected.");
      setRejectingId(null);
      setRejectNote("");
      router.refresh();
    });
  };

  const sectionProps = {
    approvingId,
    rejectingId,
    syncValue,
    syncEnabled,
    rejectNote,
    pending,
    setSyncValue,
    setSyncEnabled,
    setRejectNote,
    setApprovingId,
    setRejectingId,
    download,
    openApprove,
    confirmApprove,
    reject,
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Medical disclosures</h1>
      <Section title="Urgent" items={urgent} {...sectionProps} />
      <Section title="Routine" items={routine} {...sectionProps} />
    </div>
  );
}
