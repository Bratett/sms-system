"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  bulkUpdatePromotionRunItemsAction,
  updatePromotionRunItemAction,
} from "@/modules/student/actions/promotion.action";
import type { PromotionRun } from "./wizard-client";

type Outcome = "PROMOTE" | "RETAIN" | "GRADUATE" | "WITHDRAW";

type RunItem = PromotionRun["items"][number];

type ArmOption = {
  id: string;
  label: string;
};

function buildDestinationArmOptions(run: PromotionRun): ArmOption[] {
  const seen = new Map<string, ArmOption>();
  for (const item of run.items) {
    const arm = item.destinationClassArm;
    if (!arm) continue;
    if (seen.has(arm.id)) continue;
    seen.set(arm.id, {
      id: arm.id,
      label: `${arm.class.name} — ${arm.name}`,
    });
  }
  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function Step2OutcomesGrid({
  run,
  onNext,
  onBack,
}: {
  run: PromotionRun;
  onNext: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [bulkDestArmId, setBulkDestArmId] = useState<string>("");

  const armOptions = useMemo(() => buildDestinationArmOptions(run), [run]);
  const allIds = useMemo(() => run.items.map((i) => i.id), [run.items]);
  const allSelected = selected.size > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
  };

  const runMutation = (fn: () => Promise<{ error?: string } | Record<string, unknown>>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) {
        setError(res.error as string);
        return;
      }
      router.refresh();
    });
  };

  const handleOutcomeChange = (itemId: string, outcome: Outcome) => {
    runMutation(() => updatePromotionRunItemAction({ itemId, outcome }));
  };

  const handleDestinationChange = (itemId: string, destinationClassArmId: string) => {
    runMutation(() =>
      updatePromotionRunItemAction({
        itemId,
        destinationClassArmId: destinationClassArmId || null,
      }),
    );
  };

  const handleNotesBlur = (item: RunItem, value: string) => {
    const current = item.notes ?? "";
    if (value === current) return;
    runMutation(() => updatePromotionRunItemAction({ itemId: item.id, notes: value }));
  };

  const handleBulk = (outcome: Outcome) => {
    if (selected.size === 0) return;
    const needsDest = outcome === "PROMOTE" || outcome === "RETAIN";
    if (needsDest && !bulkDestArmId) return;
    const itemIds = Array.from(selected);
    runMutation(async () => {
      const res = await bulkUpdatePromotionRunItemsAction({
        runId: run.id,
        itemIds,
        outcome,
        destinationClassArmId: needsDest ? bulkDestArmId : undefined,
      });
      if (!("error" in res)) setSelected(new Set());
      return res;
    });
  };

  const items = run.items;
  const hasItems = items.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Outcomes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set an outcome for each student. Changes save automatically.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {selected.size} selected · {items.length} total
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bulk set:
          </span>
          {(["PROMOTE", "RETAIN", "GRADUATE", "WITHDRAW"] as const).map((o) => {
            const needsDest = o === "PROMOTE" || o === "RETAIN";
            const missingDest = needsDest && bulkDestArmId === "";
            const disabled = pending || selected.size === 0 || missingDest;
            return (
              <button
                key={o}
                onClick={() => handleBulk(o)}
                disabled={disabled}
                title={missingDest ? "Pick a destination arm first" : undefined}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {o}
              </button>
            );
          })}
          <span className="ml-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Destination:
          </span>
          <select
            value={bulkDestArmId}
            onChange={(e) => setBulkDestArmId(e.target.value)}
            disabled={pending}
            aria-label="Bulk destination arm"
            className="rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
          >
            <option value="">— Select arm —</option>
            {armOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="h-4 w-4 rounded border-border"
                />
              </th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Student ID</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">Destination Arm</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!hasItems && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No items seeded. Return to Step 1 to seed outcomes.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const isSelected = selected.has(item.id);
              const showDest = item.outcome === "PROMOTE" || item.outcome === "RETAIN";
              return (
                <tr key={item.id} className={isSelected ? "bg-accent/30" : undefined}>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(item.id)}
                      aria-label={`Select ${item.student.firstName} ${item.student.lastName}`}
                      className="h-4 w-4 rounded border-border"
                    />
                  </td>
                  <td className="px-3 py-2 align-top font-medium">
                    {item.student.lastName}, {item.student.firstName}
                  </td>
                  <td className="px-3 py-2 align-top text-muted-foreground">
                    {item.student.studentId}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      value={item.outcome}
                      onChange={(e) => handleOutcomeChange(item.id, e.target.value as Outcome)}
                      disabled={pending}
                      className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
                    >
                      <option value="PROMOTE">Promote</option>
                      <option value="RETAIN">Retain</option>
                      <option value="GRADUATE">Graduate</option>
                      <option value="WITHDRAW">Withdraw</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {showDest ? (
                      <select
                        value={item.destinationClassArmId ?? ""}
                        onChange={(e) => handleDestinationChange(item.id, e.target.value)}
                        disabled={pending}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
                      >
                        <option value="">— Select arm —</option>
                        {armOptions.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground">n/a</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <NotesInput
                      key={`${item.id}:${item.notes ?? ""}`}
                      defaultValue={item.notes ?? ""}
                      disabled={pending}
                      onBlurChange={(val) => handleNotesBlur(item, val)}
                    />
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
          disabled={pending}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function NotesInput({
  defaultValue,
  disabled,
  onBlurChange,
}: {
  defaultValue: string;
  disabled?: boolean;
  onBlurChange: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onBlurChange(value)}
      disabled={disabled}
      placeholder="Optional note"
      className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
    />
  );
}
