"use client";

import type { PromotionRun } from "./wizard-client";

export function Step4Commit({
  run: _run,
  onBack: _onBack,
}: {
  run: PromotionRun;
  onBack: () => void;
}) {
  return (
    <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
      Step 4 pending
    </div>
  );
}
