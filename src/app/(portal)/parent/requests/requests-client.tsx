"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { withdrawExcuseRequestAction } from "@/modules/parent-requests/actions/excuse.action";
import { withdrawMedicalDisclosureAction } from "@/modules/parent-requests/actions/medical-disclosure.action";
import { getParentRequestAttachmentUrlAction } from "@/modules/parent-requests/actions/attachment.action";
import { NewExcuseModal } from "./new-excuse-modal";
import { NewMedicalModal } from "./new-medical-modal";

type ExcuseRow = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  fromDate: Date | string;
  toDate: Date | string;
  reason: string;
  reviewNote: string | null;
  attachmentKey: string | null;
  attachmentName: string | null;
  student: { id: string; firstName: string; lastName: string };
  createdAt: Date | string;
};

type DisclosureRow = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  category: "ALLERGY" | "CONDITION" | "MEDICATION";
  title: string;
  description: string;
  isUrgent: boolean;
  reviewNote: string | null;
  attachmentKey: string | null;
  attachmentName: string | null;
  student: { id: string; firstName: string; lastName: string };
  createdAt: Date | string;
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-700",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    WITHDRAWN: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}

export function RequestsClient({
  excuses,
  disclosures,
}: {
  excuses: ExcuseRow[];
  disclosures: DisclosureRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"excuses" | "disclosures">("excuses");
  const [showNewExcuse, setShowNewExcuse] = useState(false);
  const [showNewMedical, setShowNewMedical] = useState(false);
  const [pending, start] = useTransition();

  const downloadAttachment = (kind: "excuse" | "medical", requestId: string) => {
    start(async () => {
      const res = await getParentRequestAttachmentUrlAction({ kind, requestId });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });
  };

  const withdrawExcuse = (id: string) => {
    start(async () => {
      const res = await withdrawExcuseRequestAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Request withdrawn.");
      router.refresh();
    });
  };

  const withdrawDisclosure = (id: string) => {
    start(async () => {
      const res = await withdrawMedicalDisclosureAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Disclosure withdrawn.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="My requests"
        description="Submissions you've made for your children."
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShowNewExcuse(true)}
          className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm"
        >
          + Excuse an absence
        </button>
        <button
          onClick={() => setShowNewMedical(true)}
          className="rounded-lg border border-teal-600 text-teal-700 px-4 py-2 text-sm"
        >
          + Disclose medical info
        </button>
      </div>

      <div className="border-b border-gray-200 flex gap-4 text-sm">
        <button
          onClick={() => setTab("excuses")}
          className={`pb-2 ${tab === "excuses" ? "border-b-2 border-teal-600 font-semibold" : "text-gray-500"}`}
        >
          Excuses ({excuses.length})
        </button>
        <button
          onClick={() => setTab("disclosures")}
          className={`pb-2 ${tab === "disclosures" ? "border-b-2 border-teal-600 font-semibold" : "text-gray-500"}`}
        >
          Medical disclosures ({disclosures.length})
        </button>
      </div>

      {tab === "excuses" ? (
        <div className="space-y-2">
          {excuses.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              No excuse requests yet.
            </p>
          ) : (
            excuses.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.student.firstName} {r.student.lastName} •{" "}
                      {new Date(r.fromDate).toLocaleDateString()}
                      {r.fromDate !== r.toDate
                        ? ` → ${new Date(r.toDate).toLocaleDateString()}`
                        : ""}
                    </p>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{r.reason}</p>
                    {r.attachmentKey && (
                      <button
                        onClick={() => downloadAttachment("excuse", r.id)}
                        className="mt-1 text-xs text-teal-600 hover:underline"
                      >
                        📎 {r.attachmentName ?? "attachment"}
                      </button>
                    )}
                    {r.reviewNote && (
                      <p className="text-xs text-gray-500 mt-2 italic">Note: {r.reviewNote}</p>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.status === "PENDING" && (
                  <button
                    onClick={() => withdrawExcuse(r.id)}
                    disabled={pending}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {disclosures.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              No medical disclosures yet.
            </p>
          ) : (
            disclosures.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.student.firstName} {r.student.lastName} • {r.category} • {r.title}
                      {r.isUrgent && (
                        <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                          URGENT
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{r.description}</p>
                    {r.attachmentKey && (
                      <button
                        onClick={() => downloadAttachment("medical", r.id)}
                        className="mt-1 text-xs text-teal-600 hover:underline"
                      >
                        📎 {r.attachmentName ?? "attachment"}
                      </button>
                    )}
                    {r.reviewNote && (
                      <p className="text-xs text-gray-500 mt-2 italic">Note: {r.reviewNote}</p>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.status === "PENDING" && (
                  <button
                    onClick={() => withdrawDisclosure(r.id)}
                    disabled={pending}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showNewExcuse && (
        <NewExcuseModal
          onClose={() => setShowNewExcuse(false)}
          onCreated={() => {
            setShowNewExcuse(false);
            router.refresh();
          }}
        />
      )}
      {showNewMedical && (
        <NewMedicalModal
          onClose={() => setShowNewMedical(false)}
          onCreated={() => {
            setShowNewMedical(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
