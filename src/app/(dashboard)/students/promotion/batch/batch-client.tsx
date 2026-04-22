"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  createPromotionRunAction,
  getEligibleSourceArmsAction,
} from "@/modules/student/actions/promotion.action";

type ArmsResult = Awaited<ReturnType<typeof getEligibleSourceArmsAction>>;
type ArmsOk = Extract<ArmsResult, { data: unknown }>;
type Arm = ArmsOk extends { data: Array<infer Item> } ? Item : never;

type RunResult =
  | { armId: string; armLabel: string; runId: string }
  | { armId: string; armLabel: string; error: string };

export function BatchClient({
  arms,
  error,
}: {
  arms: Arm[];
  error: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [pending, startTransition] = useTransition();

  const allIds = useMemo(() => arms.map((a) => a.id), [arms]);
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

  const handleCreate = () => {
    if (selected.size === 0) return;
    const targets = arms.filter((a) => selected.has(a.id));
    setResults(null);
    startTransition(async () => {
      const collected: RunResult[] = [];
      for (const arm of targets) {
        const label = `${arm.class.name} — ${arm.name}`;
        const res = await createPromotionRunAction({ sourceClassArmId: arm.id });
        if ("error" in res) {
          collected.push({ armId: arm.id, armLabel: label, error: res.error ?? "Failed to create run" });
        } else {
          collected.push({ armId: arm.id, armLabel: label, runId: res.data.id });
        }
      }
      setResults(collected);
      setSelected(new Set());
    });
  };

  const successes = results?.filter((r): r is Extract<RunResult, { runId: string }> => "runId" in r) ?? [];
  const failures = results?.filter((r): r is Extract<RunResult, { error: string }> => "error" in r) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Create Promotion Drafts"
        description="Select eligible class arms and create promotion draft runs for each in one go."
        actions={
          <Link
            href="/students/promotion"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back
          </Link>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Eligible Source Arms</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Arms shown here are active in the current academic year and do not already have a
              draft run.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {selected.size} selected · {arms.length} total
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
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
                    disabled={arms.length === 0}
                    className="h-4 w-4 rounded border-border"
                  />
                </th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">Arm</th>
                <th className="px-3 py-2">Enrollments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {arms.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No eligible source arms.
                  </td>
                </tr>
              ) : (
                arms.map((arm) => {
                  const isSelected = selected.has(arm.id);
                  return (
                    <tr key={arm.id} className={isSelected ? "bg-accent/30" : undefined}>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(arm.id)}
                          aria-label={`Select ${arm.class.name} ${arm.name}`}
                          className="h-4 w-4 rounded border-border"
                        />
                      </td>
                      <td className="px-3 py-2 align-top font-medium">{arm.class.name}</td>
                      <td className="px-3 py-2 align-top">{arm.name}</td>
                      <td className="px-3 py-2 align-top text-muted-foreground">
                        {arm._count.enrollments}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={handleCreate}
            disabled={pending || selected.size === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending
              ? "Creating..."
              : `Create drafts for ${selected.size} arm${selected.size === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {results && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border p-4">
            <h2 className="text-base font-medium">Results</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {successes.length} created · {failures.length} failed
            </p>

            {successes.length > 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-medium">Created</h3>
                <ul className="mt-2 grid gap-2">
                  {successes.map((r) => (
                    <li key={r.armId}>
                      <Link
                        href={`/students/promotion/${r.runId}?step=1`}
                        className="block rounded-lg border border-border p-3 text-sm transition-colors hover:bg-accent"
                      >
                        <span className="font-medium">{r.armLabel}</span>
                        <span className="ml-2 text-muted-foreground">Open draft →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {failures.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-destructive">Failed</h3>
                <ul className="mt-2 grid gap-2">
                  {failures.map((r) => (
                    <li
                      key={r.armId}
                      className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
                    >
                      <div className="font-medium">{r.armLabel}</div>
                      <div className="mt-1 text-destructive">{r.error}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
