"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  releaseReportCardsAction,
  reReleaseReportCardsAction,
  getReleaseStatsAction,
  getReleaseDetailsAction,
  chaseReleaseAction,
  getReleaseQueueAction,
} from "@/modules/academics/release/actions/release.action";

type Row = {
  classArmId: string;
  classArmName: string;
  programmeName: string;
  studentsEnrolled: number;
  studentsWithResults: number;
  release: { id: string; releasedAt: Date | string; lastReminderSentAt: Date | string | null } | null;
  acknowledgedStudents: number;
  pendingStudents: number;
};

type DetailRow = {
  studentId: string;
  studentName: string;
  householdId: string;
  householdName: string;
  acknowledged: boolean;
  acknowledgedAt: Date | string | null;
  acknowledgedBy: string | null;
};

type Stats = {
  targetedStudents: number;
  acknowledgedStudents: number;
  pendingStudents: number;
  lastReminderSentAt: Date | string | null;
  canSendReminder: boolean;
  releasedAt: Date | string;
  releasedByUserId: string | null;
};

export function ReleaseClient({
  initialTermId,
  initialRows,
}: {
  initialTermId: string | null;
  initialRows: Row[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [openedRow, setOpenedRow] = useState<Row | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [showReReleaseModal, setShowReReleaseModal] = useState(false);
  const [resetAcks, setResetAcks] = useState(false);

  useEffect(() => {
    if (!openedRow?.release) {
      setStats(null);
      setDetails([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      getReleaseStatsAction(openedRow.release.id),
      getReleaseDetailsAction(openedRow.release.id),
    ]).then(([s, d]) => {
      if (cancelled) return;
      if ("data" in s) setStats(s.data as never);
      if ("data" in d) setDetails(d.data as never);
    });
    return () => { cancelled = true; };
  }, [openedRow?.release?.id]);

  const refreshQueue = () => {
    start(async () => {
      const res = await getReleaseQueueAction({ termId: initialTermId ?? undefined });
      if ("data" in res && !Array.isArray(res.data)) setRows(res.data.rows as never);
    });
  };

  const release = (row: Row) => {
    if (row.studentsWithResults < row.studentsEnrolled) {
      const missing = row.studentsEnrolled - row.studentsWithResults;
      const ok = window.confirm(
        `${missing} student${missing === 1 ? "" : "s"} will be excluded from this release; ` +
          `they'll be auto-included when their results are computed. Continue?`,
      );
      if (!ok) return;
    }
    if (!initialTermId) return;
    start(async () => {
      const res = await releaseReportCardsAction({
        termId: initialTermId,
        classArmId: row.classArmId,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Released ${row.classArmName}.`);
      refreshQueue();
      router.refresh();
    });
  };

  const chase = () => {
    if (!openedRow?.release) return;
    start(async () => {
      const res = await chaseReleaseAction(openedRow.release!.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Reminder sent.`);
      const fresh = await getReleaseStatsAction(openedRow.release!.id);
      if ("data" in fresh) setStats(fresh.data as never);
    });
  };

  const reRelease = () => {
    if (!openedRow?.release) return;
    start(async () => {
      const res = await reReleaseReportCardsAction({
        releaseId: openedRow.release!.id,
        resetAcknowledgements: resetAcks,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(resetAcks ? "Re-released; acknowledgements reset." : "Re-released.");
      setShowReReleaseModal(false);
      setResetAcks(false);
      const [fresh, d] = await Promise.all([
        getReleaseStatsAction(openedRow.release!.id),
        getReleaseDetailsAction(openedRow.release!.id),
      ]);
      if ("data" in fresh) setStats(fresh.data as never);
      if ("data" in d) setDetails(d.data as never);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Report card release</h1>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">Class arm</th>
              <th className="p-3 text-left">Programme</th>
              <th className="p-3 text-left">Students</th>
              <th className="p-3 text-left">Computed</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No class arms found for this term.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const computed = r.studentsWithResults === r.studentsEnrolled
                  ? `${r.studentsWithResults} ✓`
                  : `${r.studentsWithResults} / ${r.studentsEnrolled} ⚠`;
                const status = r.release ? "Released" : "Not released";
                return (
                  <tr key={r.classArmId} className="border-t border-border hover:bg-muted/40">
                    <td className="p-3 font-medium">{r.classArmName}</td>
                    <td className="p-3 text-muted-foreground">{r.programmeName}</td>
                    <td className="p-3">{r.studentsEnrolled}</td>
                    <td className="p-3">{computed}</td>
                    <td className="p-3">
                      <span className="text-xs">{status}</span>
                    </td>
                    <td className="p-3 text-right">
                      {r.release ? (
                        <button
                          onClick={() => setOpenedRow(r)}
                          className="text-xs text-primary hover:underline"
                        >
                          {r.acknowledgedStudents} / {r.studentsEnrolled} acknowledged
                        </button>
                      ) : (
                        <button
                          onClick={() => release(r)}
                          disabled={pending || r.studentsWithResults === 0}
                          className="text-xs rounded-lg bg-primary text-primary-foreground px-3 py-1 disabled:opacity-50"
                        >
                          Release
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {openedRow && openedRow.release && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpenedRow(null)}
        >
          <div
            className="w-full max-w-3xl rounded-xl bg-card p-6 space-y-4 max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">{openedRow.classArmName} — release tracker</h2>
              <button onClick={() => setOpenedRow(null)} className="text-muted-foreground">✕</button>
            </div>

            {!stats ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">
                    {stats.acknowledgedStudents} of {stats.targetedStudents} students acknowledged
                    ({stats.pendingStudents} pending)
                  </p>
                  <div className="w-full h-2 bg-muted rounded-full mt-1">
                    <div
                      className="h-2 bg-green-500 rounded-full"
                      style={{
                        width: `${stats.targetedStudents === 0 ? 0 : (stats.acknowledgedStudents / stats.targetedStudents) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stats.lastReminderSentAt
                      ? `Last reminder: ${new Date(stats.lastReminderSentAt).toLocaleString()}`
                      : "No reminders sent yet"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={chase}
                    disabled={!stats.canSendReminder || stats.pendingStudents === 0 || pending}
                    className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
                    title={
                      !stats.canSendReminder
                        ? "Within 24-hour cooldown"
                        : stats.pendingStudents === 0
                          ? "Everyone acknowledged"
                          : undefined
                    }
                  >
                    Send reminder to {stats.pendingStudents} pending
                  </button>
                  <button
                    onClick={() => setShowReReleaseModal(true)}
                    disabled={pending}
                    className="rounded-lg border border-border px-4 py-2 text-sm"
                  >
                    Re-release
                  </button>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Student</th>
                        <th className="p-2 text-left">Household</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.length === 0 ? (
                        <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No targeted students.</td></tr>
                      ) : (
                        details.map((d) => (
                          <tr key={`${d.studentId}|${d.householdId}`} className="border-t border-border">
                            <td className="p-2">{d.studentName}</td>
                            <td className="p-2">{d.householdName}</td>
                            <td className="p-2">
                              {d.acknowledged
                                ? <span className="text-green-700">Acknowledged by {d.acknowledgedBy ?? "(deleted user)"} on {d.acknowledgedAt ? new Date(d.acknowledgedAt).toLocaleDateString() : "—"}</span>
                                : <span className="text-muted-foreground">Pending</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      const csv = ["Student,Household,Status,AcknowledgedBy,AcknowledgedAt"]
                        .concat(details.map((d) =>
                          [
                            JSON.stringify(d.studentName),
                            JSON.stringify(d.householdName),
                            d.acknowledged ? "Acknowledged" : "Pending",
                            JSON.stringify(d.acknowledgedBy ?? ""),
                            d.acknowledgedAt ? new Date(d.acknowledgedAt).toISOString() : "",
                          ].join(",")
                        ))
                        .join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `report-card-acks-${openedRow.classArmName}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showReReleaseModal && openedRow?.release && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowReReleaseModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Re-release report cards</h3>
            <p className="text-sm text-muted-foreground">
              This re-fires the release notification to every targeted parent.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={resetAcks}
                onChange={(e) => setResetAcks(e.target.checked)}
              />
              Reset acknowledgements (parents must re-confirm)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowReReleaseModal(false); setResetAcks(false); }}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={reRelease}
                disabled={pending}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
              >
                Re-release with notification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
