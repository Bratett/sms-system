"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { revertPromotionRunAction } from "@/modules/student/actions/promotion.action";
import type { PromotionRun } from "./wizard-client";

const REVERT_GRACE_DAYS = 14;

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addDays(value: Date | string, days: number) {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  d.setDate(d.getDate() + days);
  return d;
}

function outcomeLabel(outcome: string) {
  switch (outcome) {
    case "PROMOTE":
      return "Promote";
    case "RETAIN":
      return "Retain";
    case "GRADUATE":
      return "Graduate";
    case "WITHDRAW":
      return "Withdraw";
    default:
      return outcome;
  }
}

export function RunDetailClient({ run }: { run: PromotionRun }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());

  const committedAt = run.committedAt ? new Date(run.committedAt) : null;
  const revertedAt = run.revertedAt ? new Date(run.revertedAt) : null;
  const deadline = committedAt ? addDays(committedAt, REVERT_GRACE_DAYS) : null;
  const withinGrace =
    run.status === "COMMITTED" && committedAt !== null && deadline !== null && deadline.getTime() > now;

  const handleRevert = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError("Please provide a reason (at least 5 characters).");
      return;
    }
    const ok = window.confirm(
      "Revert this run? New enrollments will be deleted and previous state restored. Boarding bed allocations will NOT be restored automatically.",
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const res = await revertPromotionRunAction({ runId: run.id, reason: trimmed });
      if ("error" in res) {
        setError(res.error ?? "Failed to revert run");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Promotion Run · ${run.status}`}
        description={`${run.sourceClassArm.class.name} — ${run.sourceClassArm.name} · ${run.sourceAcademicYear.name} → ${run.targetAcademicYear.name}`}
      />

      {/* Summary */}
      <div className="rounded-xl border border-border p-6">
        <h2 className="text-base font-medium">Summary</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Source Class Arm</dt>
            <dd className="font-medium">
              {run.sourceClassArm.class.name} — {run.sourceClassArm.name}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Academic Year Transition</dt>
            <dd className="font-medium">
              {run.sourceAcademicYear.name} → {run.targetAcademicYear.name}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Committed At</dt>
            <dd className="font-medium">{formatDate(committedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{run.status}</dd>
          </div>
          {run.status === "REVERTED" && (
            <>
              <div>
                <dt className="text-muted-foreground">Reverted At</dt>
                <dd className="font-medium">{formatDate(revertedAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Revert Reason</dt>
                <dd className="font-medium whitespace-pre-wrap">{run.revertReason ?? "—"}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {/* Items */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">Destination</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {run.items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No items.
                </td>
              </tr>
            ) : (
              run.items.map((item) => {
                const showDest = item.outcome === "PROMOTE" || item.outcome === "RETAIN";
                const destLabel =
                  showDest && item.destinationClassArm
                    ? `${item.destinationClassArm.class.name} — ${item.destinationClassArm.name}`
                    : "—";
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium">
                      {item.student.lastName}, {item.student.firstName}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.student.studentId}
                      </span>
                    </td>
                    <td className="px-3 py-2">{outcomeLabel(item.outcome)}</td>
                    <td className="px-3 py-2">{destLabel}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Revert */}
      {withinGrace && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="text-base font-medium text-destructive">Revert Run</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You can revert this run until {formatDate(deadline)}. Reverting deletes new enrollments
            and restores the previous state. Boarding bed allocations will NOT be restored
            automatically.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Reason <span className="text-muted-foreground">(min 5 characters)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                rows={3}
                placeholder="Why is this run being reverted?"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
            </div>
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div>
              <button
                onClick={handleRevert}
                disabled={pending || reason.trim().length < 5}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {pending ? "Reverting..." : "Revert Run"}
              </button>
            </div>
          </div>
        </div>
      )}

      {run.status === "COMMITTED" && !withinGrace && (
        <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
          Revert window has expired ({REVERT_GRACE_DAYS} days after commit).
        </div>
      )}
    </div>
  );
}
