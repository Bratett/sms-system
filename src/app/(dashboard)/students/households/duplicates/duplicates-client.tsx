"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  previewMergeAction,
  performMergeAction,
} from "@/modules/student/actions/guardian-merge.action";

type MatchReason = "phone" | "email" | "name-fuzzy";
type Cluster = {
  cluster: Array<{
    guardian: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      email: string | null;
    };
    reasons: MatchReason[];
  }>;
  confidence: "high" | "medium";
};

type PreviewState =
  | { state: "idle" }
  | { state: "loading" }
  | {
      state: "ready";
      survivorId: string;
      duplicateId: string;
      fieldFills: Record<string, { from: unknown; to: unknown }>;
      linksToTransfer: number;
      linksAlreadyShared: number;
      conflicts: string[];
    };

export function DuplicatesClient({ clusters }: { clusters: Cluster[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<PreviewState>({ state: "idle" });

  const openPreview = (survivorId: string, duplicateId: string) => {
    setPreview({ state: "loading" });
    start(async () => {
      const res = await previewMergeAction({ survivorId, duplicateId });
      if ("error" in res) {
        toast.error(res.error);
        setPreview({ state: "idle" });
        return;
      }
      setPreview({
        state: "ready",
        survivorId,
        duplicateId,
        fieldFills: res.data.fieldFills,
        linksToTransfer: res.data.linksToTransfer,
        linksAlreadyShared: res.data.linksAlreadyShared,
        conflicts: res.conflicts,
      });
    });
  };

  const confirmMerge = () => {
    if (preview.state !== "ready") return;
    start(async () => {
      const res = await performMergeAction({
        survivorId: preview.survivorId,
        duplicateId: preview.duplicateId,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Merged — ${res.data.absorbedLinks} link(s) transferred`);
      setPreview({ state: "idle" });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Link href="/students/households" className="text-sm text-muted-foreground hover:underline">
          ← Households
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Duplicate guardians</h1>
      <p className="text-sm text-muted-foreground">
        Review clusters of potentially duplicate guardian records and merge when appropriate.
      </p>

      {clusters.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          No potential duplicates detected.
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map((c, idx) => (
            <div key={idx} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Cluster {idx + 1}</h3>
                <span
                  className={`text-xs rounded-full px-2 py-0.5 ${
                    c.confidence === "high"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {c.confidence} confidence
                </span>
              </div>
              <ul className="space-y-2">
                {c.cluster.map((m, mIdx) => (
                  <li key={m.guardian.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">
                        {m.guardian.firstName} {m.guardian.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.guardian.phone}
                        {m.guardian.email ? ` • ${m.guardian.email}` : ""}
                        {m.reasons.length > 0 ? ` • matches: ${m.reasons.join(", ")}` : ""}
                      </p>
                    </div>
                    {mIdx > 0 && (
                      <button
                        onClick={() => openPreview(c.cluster[0]!.guardian.id, m.guardian.id)}
                        disabled={pending}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        Merge into #1
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {preview.state === "loading" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl bg-card p-6">Loading preview…</div>
        </div>
      )}

      {preview.state === "ready" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold">Merge preview</h2>
            {preview.conflicts.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                <p className="font-medium mb-1">Blocking conflicts:</p>
                <ul className="list-disc list-inside">
                  {preview.conflicts.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-sm space-y-1">
              <p>
                Links to transfer: <strong>{preview.linksToTransfer}</strong>
              </p>
              <p>
                Links already shared (will be deleted): <strong>{preview.linksAlreadyShared}</strong>
              </p>
            </div>
            {Object.keys(preview.fieldFills).length > 0 && (
              <div className="text-sm">
                <p className="font-medium">Fields that will be filled on survivor:</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {Object.entries(preview.fieldFills).map(([field, fill]) => (
                    <li key={field}>
                      <code>{field}</code>: {String(fill.from)} {"\u2192"} {String(fill.to)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPreview({ state: "idle" })}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmMerge}
                disabled={pending || preview.conflicts.length > 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                Confirm merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
