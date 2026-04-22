"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { commitPromotionRunAction } from "@/modules/student/actions/promotion.action";
import type { PromotionRun } from "./wizard-client";

type Outcome = "PROMOTE" | "RETAIN" | "GRADUATE" | "WITHDRAW";

const CONFIRM_TEXT = "COMMIT";

export function Step4Commit({
  run,
  onBack,
}: {
  run: PromotionRun;
  onBack: () => void;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const counts = useMemo(() => {
    const acc: Record<Outcome, number> = {
      PROMOTE: 0,
      RETAIN: 0,
      GRADUATE: 0,
      WITHDRAW: 0,
    };
    for (const item of run.items) {
      acc[item.outcome as Outcome] += 1;
    }
    return acc;
  }, [run.items]);

  const total = run.items.length;
  const confirmed = confirm === CONFIRM_TEXT;

  const handleCommit = () => {
    setError(null);
    start(async () => {
      const res = await commitPromotionRunAction(run.id);
      if ("error" in res) {
        setError(res.error ?? "Failed to commit promotion run");
        return;
      }
      router.push(`/students/promotion/${run.id}`);
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-6">
        <h2 className="text-base font-medium">Commit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the summary and confirm to apply these outcomes.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-5">
          <div>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-medium">{total}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Promote</dt>
            <dd className="font-medium">{counts.PROMOTE}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Retain</dt>
            <dd className="font-medium">{counts.RETAIN}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Graduate</dt>
            <dd className="font-medium">{counts.GRADUATE}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Withdraw</dt>
            <dd className="font-medium">{counts.WITHDRAW}</dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-muted-foreground">
          This will apply {total} outcome{total === 1 ? "" : "s"} to enrollments
          and student records. The run can be reverted within 14 days.
        </p>

        <div className="mt-4">
          <label
            htmlFor="promotion-commit-confirm"
            className="block text-sm font-medium"
          >
            Type <span className="font-mono">{CONFIRM_TEXT}</span> to confirm
          </label>
          <input
            id="promotion-commit-confirm"
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={pending}
            autoComplete="off"
            placeholder={CONFIRM_TEXT}
            className="mt-1 w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50 sm:w-64"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          disabled={pending}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleCommit}
          disabled={!confirmed || pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Committing..." : "Commit Promotion Run"}
        </button>
      </div>
    </div>
  );
}
