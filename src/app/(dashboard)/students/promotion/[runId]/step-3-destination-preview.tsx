"use client";

import { useMemo } from "react";
import type { PromotionRun } from "./wizard-client";

type Outcome = "PROMOTE" | "RETAIN" | "GRADUATE" | "WITHDRAW";

type ArmRow = {
  armId: string;
  label: string;
  incoming: number;
  existing: number;
  capacity: number;
};

export function Step3DestinationPreview({
  run,
  onNext,
  onBack,
}: {
  run: PromotionRun;
  onNext: () => void;
  onBack: () => void;
}) {
  const outcomeCounts = useMemo(() => {
    const counts: Record<Outcome, number> = {
      PROMOTE: 0,
      RETAIN: 0,
      GRADUATE: 0,
      WITHDRAW: 0,
    };
    for (const item of run.items) {
      counts[item.outcome as Outcome] += 1;
    }
    return counts;
  }, [run.items]);

  const armRows = useMemo<ArmRow[]>(() => {
    const byArm = new Map<string, ArmRow>();
    for (const item of run.items) {
      const arm = item.destinationClassArm;
      if (!arm) continue;
      if (!byArm.has(arm.id)) {
        const cap = run.capacityByArm[arm.id];
        byArm.set(arm.id, {
          armId: arm.id,
          label: `${arm.class.name} — ${arm.name}`,
          incoming: cap?.incoming ?? 0,
          existing: cap?.existing ?? 0,
          capacity: cap?.capacity ?? 0,
        });
      }
    }
    return Array.from(byArm.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [run.items, run.capacityByArm]);

  const overCapacityRows = armRows.filter(
    (r) => r.existing + r.incoming > r.capacity,
  );
  const hasOverCapacity = overCapacityRows.length > 0;

  const cards: Array<{ label: string; value: number; tone: string }> = [
    { label: "Promote", value: outcomeCounts.PROMOTE, tone: "text-foreground" },
    { label: "Retain", value: outcomeCounts.RETAIN, tone: "text-foreground" },
    { label: "Graduate", value: outcomeCounts.GRADUATE, tone: "text-foreground" },
    { label: "Withdraw", value: outcomeCounts.WITHDRAW, tone: "text-foreground" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-6">
        <h2 className="text-base font-medium">Destination Preview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review outcomes and destination-arm capacity before committing.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-lg border border-border bg-background p-4"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {c.label}
              </div>
              <div className={`mt-1 text-2xl font-semibold ${c.tone}`}>
                {c.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {hasOverCapacity && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Resolve over-capacity arms on Step 2 before advancing. Capacity is a
          soft limit — reassign students to a different arm to proceed.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Arm</th>
              <th className="px-3 py-2">Incoming</th>
              <th className="px-3 py-2">Existing</th>
              <th className="px-3 py-2">Capacity</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {armRows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  No destination arms assigned. Return to Step 2 to assign
                  destinations for promoted/retained students.
                </td>
              </tr>
            )}
            {armRows.map((row) => {
              const total = row.existing + row.incoming;
              const over = total > row.capacity;
              return (
                <tr
                  key={row.armId}
                  className={over ? "bg-destructive/10" : undefined}
                >
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2">{row.incoming}</td>
                  <td className="px-3 py-2">{row.existing}</td>
                  <td className="px-3 py-2">{row.capacity}</td>
                  <td className="px-3 py-2">
                    {over ? (
                      <span className="font-medium text-destructive">
                        Over by {total - row.capacity}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {row.capacity - total} free
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={hasOverCapacity}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Next: Commit
        </button>
      </div>
    </div>
  );
}
