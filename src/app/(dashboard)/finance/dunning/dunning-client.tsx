"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  runDunningPolicyAction,
  deleteDunningPolicyAction,
  closeDunningCaseAction,
} from "@/modules/finance/actions/dunning.action";

interface Stage {
  id: string;
  order: number;
  name: string;
  daysOverdue: number;
  channels: string[];
  templateKey: string | null;
  escalateToRole: string | null;
  blockPortal: boolean;
}

interface Policy {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  isActive: boolean;
  stages: Stage[];
  _count?: { runs: number; cases: number };
}

interface Run {
  id: string;
  policyId: string;
  status: string;
  startedAt: string | Date;
  completedAt: string | Date | null;
  totalBills: number;
  casesCreated: number;
  eventsSent: number;
  errors: number;
  policy?: { name: string };
}

interface DunningCase {
  id: string;
  studentBillId: string;
  studentId: string;
  status: string;
  stagesCleared: number;
  openedAt: string | Date;
  lastActionAt: string | Date | null;
  policy?: { name: string };
  events: Array<{ id: string; channel: string; status: string; occurredAt: string | Date }>;
}

export function DunningClient({
  initialPolicies,
  initialRuns,
  initialCases,
}: {
  initialPolicies: Policy[];
  initialRuns: Run[];
  initialCases: DunningCase[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"policies" | "runs" | "cases">("policies");
  const [isPending, startTransition] = useTransition();

  const runPolicy = (policyId: string, dryRun: boolean) => {
    startTransition(async () => {
      const res = await runDunningPolicyAction({ policyId, triggerType: "MANUAL", dryRun });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const { totalBills, eventsSent, errors } = res.data;
      toast.success(
        `${dryRun ? "Dry run" : "Run"} complete: ${totalBills} bills, ${eventsSent} events${errors ? `, ${errors} errors` : ""}`,
      );
      router.refresh();
    });
  };

  const deletePolicy = (policyId: string, name: string) => {
    if (!confirm(`Delete dunning policy "${name}"?`)) return;
    startTransition(async () => {
      const res = await deleteDunningPolicyAction(policyId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Policy deleted");
      router.refresh();
    });
  };

  const closeCase = (caseId: string) => {
    const resolution = prompt("Resolution note (e.g. 'paid in cash', 'promise-to-pay agreed'):");
    if (!resolution) return;
    startTransition(async () => {
      const res = await closeDunningCaseAction(caseId, resolution);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Case closed");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dunning"
        description="Multi-stage arrears follow-up: policies, runs, and cases."
      />

      <div className="flex gap-2 border-b">
        {(["policies", "runs", "cases"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "policies" && (
        <section className="space-y-4">
          {initialPolicies.length === 0 ? (
            <EmptyState
              title="No dunning policies"
              description="Create a policy to start automating fee-reminder escalation."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {initialPolicies.map((policy) => (
                <article key={policy.id} className="rounded border bg-card p-4 shadow-sm">
                  <header className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{policy.name}</h3>
                      <p className="text-sm text-muted-foreground">{policy.description ?? "—"}</p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        policy.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {policy.isActive ? "active" : "inactive"}
                    </span>
                  </header>
                  <ol className="mt-3 space-y-1 text-sm">
                    {policy.stages.map((s) => (
                      <li key={s.id} className="flex items-center justify-between">
                        <span>
                          {s.order}. {s.name}{" "}
                          <span className="text-muted-foreground">
                            — day {s.daysOverdue}, {s.channels.join("+")}
                          </span>
                        </span>
                        {s.blockPortal && (
                          <span className="rounded bg-red-100 px-1.5 text-xs text-red-700">
                            portal-block
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                  <footer className="mt-4 flex flex-wrap gap-2">
                    <button
                      disabled={isPending}
                      onClick={() => runPolicy(policy.id, true)}
                      className="rounded border px-3 py-1 text-sm hover:bg-muted"
                    >
                      Dry run
                    </button>
                    <button
                      disabled={isPending || !policy.isActive}
                      onClick={() => runPolicy(policy.id, false)}
                      className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
                    >
                      Run now
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => deletePolicy(policy.id, policy.name)}
                      className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {policy._count?.runs ?? 0} runs · {policy._count?.cases ?? 0} cases
                    </span>
                  </footer>
                </article>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            New-policy editor UI is available at{" "}
            <code>/finance/dunning/new</code> (or use the API directly).
          </p>
        </section>
      )}

      {tab === "runs" && (
        <section className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Policy</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Bills</th>
                <th className="p-2 text-right">Events</th>
                <th className="p-2 text-right">Errors</th>
              </tr>
            </thead>
            <tbody>
              {initialRuns.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{new Date(r.startedAt).toLocaleString("en-GH")}</td>
                  <td className="p-2">{r.policy?.name ?? "—"}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2 text-right">{r.totalBills}</td>
                  <td className="p-2 text-right">{r.eventsSent}</td>
                  <td className="p-2 text-right">{r.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {initialRuns.length === 0 && (
            <EmptyState title="No runs yet" description="Trigger a policy run to populate this log." />
          )}
        </section>
      )}

      {tab === "cases" && (
        <section className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2">Opened</th>
                <th className="p-2">Policy</th>
                <th className="p-2">Student</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Stage</th>
                <th className="p-2">Last action</th>
                <th className="p-2">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {initialCases.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2">{new Date(c.openedAt).toLocaleDateString("en-GH")}</td>
                  <td className="p-2">{c.policy?.name ?? "—"}</td>
                  <td className="p-2 font-mono text-xs">{c.studentId}</td>
                  <td className="p-2">{c.status}</td>
                  <td className="p-2 text-right">{c.stagesCleared}</td>
                  <td className="p-2">
                    {c.lastActionAt
                      ? new Date(c.lastActionAt).toLocaleDateString("en-GH")
                      : "—"}
                  </td>
                  <td className="p-2">
                    <button
                      disabled={isPending || c.status === "CLOSED" || c.status === "RESOLVED"}
                      onClick={() => closeCase(c.id)}
                      className="rounded border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      Close
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {initialCases.length === 0 && (
            <EmptyState title="No open cases" description="Cases open automatically when a policy run fires a stage." />
          )}
        </section>
      )}
    </div>
  );
}
