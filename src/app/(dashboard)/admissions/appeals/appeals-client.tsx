"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { resolveAppealAction } from "@/modules/admissions/actions/appeal.action";

interface AppealRow {
  id: string;
  applicationId: string;
  applicationNumber: string;
  applicantName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  reason: string;
  status: string;
  submittedAt: Date;
  resolvedAt: Date | null;
  resolution: string | null;
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AppealsClient({ appeals }: { appeals: AppealRow[] }) {
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "UPHELD" | "DENIED">(
    "PENDING",
  );

  const filtered = filter === "ALL" ? appeals : appeals.filter((a) => a.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["PENDING", "UPHELD", "DENIED", "ALL"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-md border px-3 py-1 text-sm ${
              filter === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-accent"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No appeals in this filter.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => (
            <AppealCard key={a.id} appeal={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AppealCard({ appeal }: { appeal: AppealRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resolution, setResolution] = useState("");
  const [expanded, setExpanded] = useState(appeal.status === "PENDING");

  function handleResolve(upheld: boolean) {
    if (!resolution.trim()) {
      toast.error("Enter a resolution note first.");
      return;
    }
    startTransition(async () => {
      const res = await resolveAppealAction(appeal.id, { upheld, resolution });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success(`Appeal ${upheld ? "upheld" : "denied"}.`);
        router.refresh();
      }
    });
  }

  return (
    <li className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-accent/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="font-medium">{appeal.applicantName}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {appeal.applicationNumber}
            </span>
            <StatusBadge status={appeal.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted {formatDate(appeal.submittedAt)}
            {appeal.guardianName && ` • ${appeal.guardianName}`}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Appeal reason
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap">{appeal.reason}</p>
          </div>

          {appeal.resolvedAt && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Resolution
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">
                {appeal.resolution ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Resolved {formatDate(appeal.resolvedAt)}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Link
              href={`/admissions/applications/${appeal.applicationId}`}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              View application
            </Link>
          </div>

          {appeal.status === "PENDING" && (
            <div className="space-y-2 border-t border-border pt-3">
              <label className="block text-sm font-medium">Resolution note</label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={3}
                className={`${inputClass} min-h-[80px]`}
                placeholder="Explain the decision..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleResolve(true)}
                  disabled={isPending || !resolution.trim()}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Uphold (re-open decision)
                </button>
                <button
                  onClick={() => handleResolve(false)}
                  disabled={isPending || !resolution.trim()}
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
