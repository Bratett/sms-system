"use client";

import type { PromotionRun } from "./wizard-client";

export function Step2OutcomesGrid({
  run: _run,
  onNext: _onNext,
  onBack: _onBack,
}: {
  run: PromotionRun;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
      Step 2 pending
    </div>
  );
}
