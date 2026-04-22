"use client";

import type { PromotionRun } from "./wizard-client";

export function RunDetailClient({ run: _run }: { run: PromotionRun }) {
  return (
    <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
      Run detail pending
    </div>
  );
}
