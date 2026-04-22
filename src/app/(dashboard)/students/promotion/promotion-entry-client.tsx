"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  createPromotionRunAction,
  listPromotionRunsAction,
  getEligibleSourceArmsAction,
} from "@/modules/student/actions/promotion.action";

// ─── Types ──────────────────────────────────────────────────────────
// Derive from action return types so the client stays in sync with server shapes.
type RunsResult = Awaited<ReturnType<typeof listPromotionRunsAction>>;
type ArmsResult = Awaited<ReturnType<typeof getEligibleSourceArmsAction>>;

type RunsOk = Extract<RunsResult, { data: unknown }>;
type ArmsOk = Extract<ArmsResult, { data: unknown }>;
type Run = RunsOk extends { data: Array<infer Item> } ? Item : never;
type Arm = ArmsOk extends { data: Array<infer Item> } ? Item : never;

// ─── Component ──────────────────────────────────────────────────────

export function PromotionEntryClient({
  runs,
  arms,
  error,
}: {
  runs: Run[];
  arms: Arm[];
  error: string | null;
}) {
  const router = useRouter();
  const [selectedArm, setSelectedArm] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const drafts = runs.filter((r) => r.status === "DRAFT");
  const committed = runs.filter((r) => r.status === "COMMITTED" || r.status === "REVERTED");

  const handleCreate = () => {
    if (!selectedArm) return;
    setActionError(null);
    startTransition(async () => {
      const res = await createPromotionRunAction({ sourceClassArmId: selectedArm });
      if ("error" in res) {
        setActionError(res.error);
      } else {
        router.push(`/students/promotion/${res.data.id}?step=1`);
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotion Runs"
        description="Manage end-of-year promotion, retention, graduation, and withdrawal cohorts."
        actions={
          <Link
            href="/students/promotion/batch"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Batch Create
          </Link>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Start a new run */}
      <div className="rounded-xl border border-border p-4">
        <h2 className="text-base font-medium">Start a new run</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick an active class arm in the current academic year to begin.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={selectedArm}
            onChange={(e) => setSelectedArm(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[320px]"
          >
            <option value="">Pick a source class arm</option>
            {arms.map((a) => (
              <option key={a.id} value={a.id}>
                {a.class.name} — {a.name} ({a._count.enrollments} students)
              </option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={!selectedArm || pending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "Creating..." : "Create Draft"}
          </button>
        </div>
        {actionError && <p className="mt-2 text-sm text-destructive">{actionError}</p>}
        {arms.length === 0 && !error && (
          <p className="mt-2 text-sm text-muted-foreground">
            No eligible source arms. Every active arm either already has a draft or the current
            academic year has no active arms.
          </p>
        )}
      </div>

      {/* Active Drafts */}
      <section>
        <h2 className="mb-2 text-base font-medium">Active Drafts ({drafts.length})</h2>
        <div className="grid gap-2">
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active drafts.</p>
          ) : (
            drafts.map((r) => (
              <Link
                key={r.id}
                href={`/students/promotion/${r.id}?step=1`}
                className="rounded-xl border border-border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {r.sourceClassArm.class.name} — {r.sourceClassArm.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {r._count.items} students
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {r.sourceAcademicYear.name} → {r.targetAcademicYear.name}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Committed / Reverted */}
      <section>
        <h2 className="mb-2 text-base font-medium">Committed / Reverted Runs</h2>
        <div className="grid gap-2">
          {committed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No committed runs yet.</p>
          ) : (
            committed.map((r) => (
              <Link
                key={r.id}
                href={`/students/promotion/${r.id}`}
                className="rounded-xl border border-border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {r.sourceClassArm.class.name} — {r.sourceClassArm.name}
                  </span>
                  <span className="text-sm text-muted-foreground">{r.status}</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {r.sourceAcademicYear.name} → {r.targetAcademicYear.name}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
