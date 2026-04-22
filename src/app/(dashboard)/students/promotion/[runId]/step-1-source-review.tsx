"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deletePromotionRunAction,
  seedPromotionRunItemsAction,
} from "@/modules/student/actions/promotion.action";
import type { PromotionRun } from "./wizard-client";

export function Step1SourceReview({
  run,
  onNext,
}: {
  run: PromotionRun;
  onNext: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const handleSeed = () => {
    setError(null);
    start(async () => {
      const res = await seedPromotionRunItemsAction(run.id);
      if ("error" in res) {
        setError(res.error);
      } else {
        router.refresh();
        onNext();
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Discard this draft?")) return;
    start(async () => {
      const res = await deletePromotionRunAction(run.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push("/students/promotion");
    });
  };

  const hasItems = run.items.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-6">
        <h2 className="text-base font-medium">Source Review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the source cohort before seeding promotion outcomes.
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Source Class Arm</dt>
            <dd className="font-medium">
              {run.sourceClassArm.class.name} — {run.sourceClassArm.name}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Source Academic Year</dt>
            <dd className="font-medium">{run.sourceAcademicYear.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Target Academic Year</dt>
            <dd className="font-medium">{run.targetAcademicYear.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Existing Items</dt>
            <dd className="font-medium">{run.items.length}</dd>
          </div>
        </dl>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">{error}</p>
          <p className="mt-1 text-xs text-destructive/80">
            Fix this in the academics module setup and return here.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSeed}
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending
            ? "Working..."
            : hasItems
              ? "Re-seed / continue"
              : "Seed outcomes"}
        </button>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          Discard Draft
        </button>
      </div>
    </div>
  );
}
