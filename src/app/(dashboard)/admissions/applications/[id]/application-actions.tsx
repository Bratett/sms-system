"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  decideApplicationAction,
  verifyPlacementAction,
} from "@/modules/admissions/actions/admission.action";
import {
  scheduleInterviewAction,
  recordInterviewAction,
  waiveInterviewAction,
} from "@/modules/admissions/actions/interview.action";
import {
  acceptOfferAction,
  declineOfferAction,
} from "@/modules/admissions/actions/offer.action";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// ─── Shared types ─────────────────────────────────────────────────

export interface InterviewRow {
  id: string;
  scheduledAt: Date;
  location: string | null;
  academicScore: number | null;
  behavioralScore: number | null;
  parentScore: number | null;
  totalScore: number | null;
  outcome: string | null;
  notes: string | null;
  recordedAt: Date | null;
}

export interface ConditionRow {
  id: string;
  type: string;
  description: string;
  deadline: Date;
  met: boolean;
  metAt: Date | null;
}

export interface DecisionRow {
  id: string;
  decision: string;
  decidedAt: Date;
  reason: string | null;
  autoDecision: boolean;
  decidedBy: string;
  conditions: ConditionRow[];
}

export interface OfferRow {
  id: string;
  issuedAt: Date;
  expiryDate: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  declineReason: string | null;
}

export interface TransitionRow {
  id: string;
  fromState: string;
  toState: string;
  event: string;
  actorId: string;
  reason: string | null;
  occurredAt: Date;
}

// ─── Placement Verify ─────────────────────────────────────────────

export function PlacementVerifyCard({
  applicationId,
  alreadyVerified,
}: {
  applicationId: string;
  alreadyVerified: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (alreadyVerified) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        ✓ Placement verified
      </div>
    );
  }

  function handleVerify() {
    startTransition(async () => {
      const res = await verifyPlacementAction(applicationId, {});
      if ("error" in res) {
        toast.error(res.error);
      } else {
        const data = res.data;
        if (data.autoAdmitted) {
          toast.success("Placement verified — auto-admitted based on BECE score.");
        } else {
          toast.success("Placement verified.");
        }
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <h3 className="text-lg font-semibold mb-2 text-amber-900">Verify Placement</h3>
      <p className="text-sm text-amber-800 mb-4">
        Confirm the CSSPS enrollment code and BECE index are valid. Verified placement
        students with BECE aggregate ≤ 10 are auto-admitted if capacity permits.
      </p>
      <button
        onClick={handleVerify}
        disabled={isPending}
        className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {isPending ? "Verifying…" : "Verify placement"}
      </button>
    </div>
  );
}

// ─── Interview Panel ──────────────────────────────────────────────

export function InterviewPanel({
  applicationId,
  interview,
  canSchedule,
  canRecord,
}: {
  applicationId: string;
  interview: InterviewRow | null;
  canSchedule: boolean;
  canRecord: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");
  const [academic, setAcademic] = useState<string>("");
  const [behavioral, setBehavioral] = useState<string>("");
  const [parent, setParent] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("PASSED");
  const [notes, setNotes] = useState("");
  const [waiveReason, setWaiveReason] = useState("");

  function handleSchedule() {
    startTransition(async () => {
      const res = await scheduleInterviewAction(applicationId, {
        scheduledAt,
        location,
        panelMemberIds: [],
      });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success("Interview scheduled.");
        router.refresh();
      }
    });
  }

  function handleRecord() {
    if (!interview) return;
    startTransition(async () => {
      const res = await recordInterviewAction(interview.id, {
        academicScore: Number(academic),
        behavioralScore: Number(behavioral),
        parentScore: Number(parent),
        outcome: outcome as "PASSED" | "CONDITIONAL" | "FAILED" | "NO_SHOW" | "WAIVED",
        notes,
      });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success("Interview recorded.");
        router.refresh();
      }
    });
  }

  function handleWaive() {
    startTransition(async () => {
      const res = await waiveInterviewAction(applicationId, { reason: waiveReason });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success("Interview waived.");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">Interview</h3>

      {interview && (
        <div className="rounded-md bg-muted/40 p-4 text-sm space-y-1">
          <div>
            <span className="text-muted-foreground">Scheduled: </span>
            {formatDate(interview.scheduledAt)}
          </div>
          {interview.location && (
            <div>
              <span className="text-muted-foreground">Location: </span>
              {interview.location}
            </div>
          )}
          {interview.totalScore != null && (
            <div>
              <span className="text-muted-foreground">Total score: </span>
              <span className="font-medium">{Number(interview.totalScore).toFixed(2)}</span>
              {interview.outcome && <span className="ml-2">({interview.outcome})</span>}
            </div>
          )}
          {interview.notes && (
            <div className="mt-2 whitespace-pre-wrap text-muted-foreground">
              {interview.notes}
            </div>
          )}
        </div>
      )}

      {canSchedule && !interview && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Scheduled date/time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Location (optional)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClass}
              placeholder="e.g. Admin Block, Room 2"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSchedule}
              disabled={isPending || !scheduledAt}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Schedule interview
            </button>
            <input
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              className={`${inputClass} max-w-xs`}
              placeholder="Waive reason (if applicable)"
            />
            <button
              onClick={handleWaive}
              disabled={isPending || !waiveReason}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Waive
            </button>
          </div>
        </div>
      )}

      {canRecord && interview && interview.totalScore == null && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Record interview scores (0–10 each). Weighted total: academic × 0.4 +
            behavioral × 0.35 + parent × 0.25.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Academic</label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={academic}
                onChange={(e) => setAcademic(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Behavioral</label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={behavioral}
                onChange={(e) => setBehavioral(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Parent</label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={parent}
                onChange={(e) => setParent(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Outcome</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className={inputClass}
            >
              <option value="PASSED">Passed</option>
              <option value="CONDITIONAL">Conditional</option>
              <option value="FAILED">Failed</option>
              <option value="NO_SHOW">No-show</option>
              <option value="WAIVED">Waived</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${inputClass} min-h-[80px]`}
            />
          </div>
          <button
            onClick={handleRecord}
            disabled={isPending || !academic || !behavioral || !parent}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Record interview
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Decision Panel ───────────────────────────────────────────────

type LocalCondition = { type: string; description: string; deadline: string };

export function DecisionPanel({
  applicationId,
  visible,
}: {
  applicationId: string;
  visible: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [conditions, setConditions] = useState<LocalCondition[]>([]);

  if (!visible) return null;

  function addCondition() {
    setConditions((c) => [...c, { type: "", description: "", deadline: "" }]);
  }

  function updateCondition(i: number, patch: Partial<LocalCondition>) {
    setConditions((c) => c.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function removeCondition(i: number) {
    setConditions((c) => c.filter((_, idx) => idx !== i));
  }

  function handleDecide(
    decision: "ACCEPTED" | "CONDITIONAL_ACCEPT" | "WAITLISTED" | "REJECTED",
  ) {
    startTransition(async () => {
      const res = await decideApplicationAction(applicationId, {
        decision,
        reason,
        conditions: decision === "CONDITIONAL_ACCEPT" ? conditions : undefined,
      });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success(`Decision recorded: ${decision}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">Record decision</h3>
      <div>
        <label className="block text-sm font-medium mb-1.5">Reason / notes</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className={`${inputClass} min-h-[80px]`}
          placeholder="Required for rejection; optional otherwise"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">Conditions</label>
          <button
            onClick={addCondition}
            className="text-xs text-primary hover:underline"
          >
            + Add condition
          </button>
        </div>
        {conditions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Only used with CONDITIONAL_ACCEPT (e.g. placement test, missing docs).
          </p>
        ) : (
          conditions.map((c, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <input
                className={`${inputClass} col-span-3`}
                placeholder="Type"
                value={c.type}
                onChange={(e) => updateCondition(i, { type: e.target.value })}
              />
              <input
                className={`${inputClass} col-span-5`}
                placeholder="Description"
                value={c.description}
                onChange={(e) => updateCondition(i, { description: e.target.value })}
              />
              <input
                type="date"
                className={`${inputClass} col-span-3`}
                value={c.deadline}
                onChange={(e) => updateCondition(i, { deadline: e.target.value })}
              />
              <button
                className="col-span-1 text-xs text-destructive"
                onClick={() => removeCondition(i)}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={() => handleDecide("ACCEPTED")}
          disabled={isPending}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Accept
        </button>
        <button
          onClick={() => handleDecide("CONDITIONAL_ACCEPT")}
          disabled={isPending || conditions.length === 0}
          className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Conditional accept
        </button>
        <button
          onClick={() => handleDecide("WAITLISTED")}
          disabled={isPending}
          className="rounded-md bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Waitlist
        </button>
        <button
          onClick={() => handleDecide("REJECTED")}
          disabled={isPending || !reason.trim()}
          className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// ─── Offer Card ───────────────────────────────────────────────────

export function OfferCard({
  applicationId,
  offer,
}: {
  applicationId: string;
  offer: OfferRow | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [declineReason, setDeclineReason] = useState("");

  if (!offer) return null;

  const status = offer.acceptedAt
    ? "ACCEPTED"
    : offer.declinedAt
      ? "DECLINED"
      : offer.expiryDate < new Date()
        ? "EXPIRED"
        : "OPEN";

  function handleAccept() {
    startTransition(async () => {
      const res = await acceptOfferAction(applicationId);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Offer accepted.");
        router.refresh();
      }
    });
  }

  function handleDecline() {
    startTransition(async () => {
      const res = await declineOfferAction(applicationId, declineReason);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Offer declined.");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-3">
      <h3 className="text-lg font-semibold">Offer</h3>
      <div className="text-sm space-y-1">
        <div>
          <span className="text-muted-foreground">Issued: </span>
          {formatDate(offer.issuedAt)}
        </div>
        <div>
          <span className="text-muted-foreground">Expires: </span>
          {formatDate(offer.expiryDate)}
        </div>
        <div>
          <span className="text-muted-foreground">Status: </span>
          <span className="font-medium">{status}</span>
        </div>
      </div>
      {status === "OPEN" && (
        <div className="flex gap-2 items-start pt-2">
          <button
            onClick={handleAccept}
            disabled={isPending}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Record acceptance
          </button>
          <input
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className={`${inputClass} flex-1`}
            placeholder="Decline reason"
          />
          <button
            onClick={handleDecline}
            disabled={isPending || !declineReason}
            className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Conditions Tracker ───────────────────────────────────────────

export function ConditionsTracker({ conditions }: { conditions: ConditionRow[] }) {
  if (conditions.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-semibold mb-4">Conditions</h3>
      <ul className="space-y-2">
        {conditions.map((c) => {
          const overdue = !c.met && c.deadline < new Date();
          return (
            <li key={c.id} className="flex items-start gap-3 text-sm">
              <span
                className={`mt-0.5 inline-block h-2 w-2 rounded-full ${
                  c.met
                    ? "bg-emerald-500"
                    : overdue
                      ? "bg-red-500"
                      : "bg-amber-500"
                }`}
                aria-hidden
              />
              <div className="flex-1">
                <div className="font-medium">{c.type}</div>
                <div className="text-muted-foreground">{c.description}</div>
                <div className="text-xs text-muted-foreground">
                  Deadline: {formatDate(c.deadline)}
                  {c.met && c.metAt && ` — met on ${formatDate(c.metAt)}`}
                  {overdue && !c.met && " — overdue"}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Workflow Timeline ────────────────────────────────────────────

export function WorkflowTimeline({
  transitions,
  decisions,
}: {
  transitions: TransitionRow[];
  decisions: DecisionRow[];
}) {
  if (transitions.length === 0 && decisions.length === 0) return null;
  const merged: { when: Date; label: string; detail: string }[] = [
    ...transitions.map((t) => ({
      when: t.occurredAt,
      label: t.event,
      detail: `${t.fromState} → ${t.toState}${t.reason ? ` — ${t.reason}` : ""}`,
    })),
    ...decisions.map((d) => ({
      when: d.decidedAt,
      label: `Decision: ${d.decision}${d.autoDecision ? " (auto)" : ""}`,
      detail: d.reason ?? "",
    })),
  ].sort((a, b) => b.when.getTime() - a.when.getTime());

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-semibold mb-4">Workflow timeline</h3>
      <ol className="space-y-3">
        {merged.map((e, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-center gap-2">
              <StatusBadge status={e.label} />
              <span className="text-xs text-muted-foreground">
                {formatDate(e.when)}
              </span>
            </div>
            {e.detail && (
              <div className="mt-1 text-muted-foreground pl-1">{e.detail}</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
