"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getOccupancyTrendsAction,
  getExeatAnalyticsAction,
  getRollCallAnalyticsAction,
  getIncidentAnalyticsAction,
  getSickBayAnalyticsAction,
} from "@/modules/boarding/actions/analytics.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Overview {
  totalHostels: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  activeExeats: number;
  overdueExeats: number;
  currentSickBay: number;
  activeVisitors: number;
  pendingTransfers: number;
  openMaintenance: number;
  activeIncidents: number;
}

interface OccupancyHostel {
  hostelId: string;
  hostelName: string;
  gender: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
}

interface OccupancyData {
  overall: {
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyRate: number;
  };
  byHostel: OccupancyHostel[];
}

interface ExeatData {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byMonth: Record<string, number>;
  approvalRate: number;
  avgApprovalTimeHours: number;
  avgStayDurationDays: number;
  overdueCount: number;
  topReasons: { reason: string; count: number }[];
}

interface RollCallData {
  totalRollCalls: number;
  overallAttendanceRate: number;
  dailyRates: { date: string; type: string; present: number; absent: number; exeat: number; sickBay: number; total: number }[];
  chronicAbsentees: { studentId: string; studentName: string; absenceCount: number }[];
}

interface IncidentData {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byMonth: Record<string, number>;
  byHostel: { hostelName: string; count: number }[];
  avgResolutionDays: number;
}

interface SickBayData {
  total: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byMonth: Record<string, number>;
  avgStayHours: number;
  referralRate: number;
  commonSymptoms: { symptom: string; count: number }[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function getOccupancyColor(rate: number) {
  if (rate >= 90) return "bg-red-500";
  if (rate >= 75) return "bg-orange-500";
  if (rate >= 50) return "bg-yellow-500";
  return "bg-green-500";
}

function getSeverityBarColor(severity: string) {
  const map: Record<string, string> = {
    MINOR: "bg-gray-400",
    MODERATE: "bg-yellow-500",
    MAJOR: "bg-orange-500",
    CRITICAL: "bg-red-600",
    MILD: "bg-gray-400",
    SEVERE: "bg-red-600",
  };
  return map[severity] ?? "bg-blue-500";
}

function HorizontalBars({
  data,
  colorFn,
}: {
  data: Record<string, number>;
  colorFn?: (key: string) => string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-32 text-xs text-muted-foreground truncate" title={formatLabel(key)}>
            {formatLabel(key)}
          </span>
          <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
            <div
              className={`h-full rounded ${colorFn ? colorFn(key) : "bg-primary"}`}
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
          <span className="w-10 text-xs font-medium text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────

export function AnalyticsClient({ overview }: { overview: Overview }) {
  const [isPending, startTransition] = useTransition();

  // Section data states
  const [occupancy, setOccupancy] = useState<OccupancyData | null>(null);
  const [exeat, setExeat] = useState<ExeatData | null>(null);
  const [rollCall, setRollCall] = useState<RollCallData | null>(null);
  const [incidents, setIncidents] = useState<IncidentData | null>(null);
  const [sickBay, setSickBay] = useState<SickBayData | null>(null);

  // Loading states per section
  const [loadingOccupancy, setLoadingOccupancy] = useState(false);
  const [loadingExeat, setLoadingExeat] = useState(false);
  const [loadingRollCall, setLoadingRollCall] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [loadingSickBay, setLoadingSickBay] = useState(false);

  // ─── Loaders ────────────────────────────────────────────────────

  function loadOccupancy() {
    setLoadingOccupancy(true);
    startTransition(async () => {
      const result = await getOccupancyTrendsAction();
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setOccupancy(result.data);
      }
      setLoadingOccupancy(false);
    });
  }

  function loadExeat() {
    setLoadingExeat(true);
    startTransition(async () => {
      const result = await getExeatAnalyticsAction();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setExeat(result.data);
      }
      setLoadingExeat(false);
    });
  }

  function loadRollCall() {
    setLoadingRollCall(true);
    startTransition(async () => {
      const result = await getRollCallAnalyticsAction();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setRollCall(result.data);
      }
      setLoadingRollCall(false);
    });
  }

  function loadIncidents() {
    setLoadingIncidents(true);
    startTransition(async () => {
      const result = await getIncidentAnalyticsAction();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setIncidents(result.data);
      }
      setLoadingIncidents(false);
    });
  }

  function loadSickBay() {
    setLoadingSickBay(true);
    startTransition(async () => {
      const result = await getSickBayAnalyticsAction();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setSickBay(result.data);
      }
      setLoadingSickBay(false);
    });
  }

  return (
    <div className="space-y-6">
      {/* ─── KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-blue-600">Occupancy Rate</p>
          <p className="text-xl font-bold">{overview.occupancyRate}%</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-green-600">Active Exeats</p>
          <p className="text-xl font-bold">{overview.activeExeats}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 border-red-200">
          <p className="text-xs text-red-600">Overdue Exeats</p>
          <p className="text-xl font-bold text-red-600">{overview.overdueExeats}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-purple-600">Sick Bay</p>
          <p className="text-xl font-bold">{overview.currentSickBay}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-teal-600">Active Visitors</p>
          <p className="text-xl font-bold">{overview.activeVisitors}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-yellow-600">Pending Transfers</p>
          <p className="text-xl font-bold">{overview.pendingTransfers}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-orange-600">Open Maintenance</p>
          <p className="text-xl font-bold">{overview.openMaintenance}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 border-red-200">
          <p className="text-xs text-red-600">Active Incidents</p>
          <p className="text-xl font-bold text-red-600">{overview.activeIncidents}</p>
        </div>
      </div>

      {/* ─── Occupancy Analysis ─────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Occupancy Analysis</h2>
            <p className="text-xs text-muted-foreground">Hostel-by-hostel bed occupancy breakdown</p>
          </div>
          {!occupancy && (
            <button
              onClick={loadOccupancy}
              disabled={loadingOccupancy || isPending}
              className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              Load Data
            </button>
          )}
        </div>
        <div className="p-4">
          {loadingOccupancy ? (
            <Spinner />
          ) : occupancy ? (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <span>
                  Total Beds: <strong>{occupancy.overall.totalBeds}</strong>
                </span>
                <span>
                  Occupied: <strong>{occupancy.overall.occupiedBeds}</strong>
                </span>
                <span>
                  Available: <strong>{occupancy.overall.availableBeds}</strong>
                </span>
                <span>
                  Overall: <strong>{occupancy.overall.occupancyRate}%</strong>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Hostel</th>
                      <th className="px-4 py-2 text-center font-medium">Gender</th>
                      <th className="px-4 py-2 text-center font-medium">Total Beds</th>
                      <th className="px-4 py-2 text-center font-medium">Occupied</th>
                      <th className="px-4 py-2 text-center font-medium">Available</th>
                      <th className="px-4 py-2 text-left font-medium">Occupancy Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occupancy.byHostel.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                          No hostel data available.
                        </td>
                      </tr>
                    ) : (
                      occupancy.byHostel.map((h) => (
                        <tr key={h.hostelId} className="border-b border-border last:border-0">
                          <td className="px-4 py-2 font-medium">{h.hostelName}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${h.gender === "MALE" ? "bg-blue-100 text-blue-700" : h.gender === "FEMALE" ? "bg-pink-100 text-pink-700" : "bg-gray-100 text-gray-700"}`}>
                              {h.gender}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">{h.totalBeds}</td>
                          <td className="px-4 py-2 text-center">{h.occupiedBeds}</td>
                          <td className="px-4 py-2 text-center">{h.availableBeds}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-3 bg-muted rounded overflow-hidden">
                                <div
                                  className={`h-full rounded ${getOccupancyColor(h.occupancyRate)}`}
                                  style={{ width: `${Math.min(h.occupancyRate, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium w-12 text-right">{h.occupancyRate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Click &quot;Load Data&quot; to view occupancy analysis.
            </p>
          )}
        </div>
      </div>

      {/* ─── Exeat Insights ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Exeat Insights</h2>
            <p className="text-xs text-muted-foreground">Exeat request trends, approval rates, and patterns</p>
          </div>
          {!exeat && (
            <button
              onClick={loadExeat}
              disabled={loadingExeat || isPending}
              className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              Load Data
            </button>
          )}
        </div>
        <div className="p-4">
          {loadingExeat ? (
            <Spinner />
          ) : exeat ? (
            <div className="space-y-5">
              {/* Summary */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Total Exeats</p>
                  <p className="text-lg font-bold">{exeat.total}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Approval Rate</p>
                  <p className="text-lg font-bold text-green-600">{exeat.approvalRate}%</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Avg Approval Time</p>
                  <p className="text-lg font-bold">{exeat.avgApprovalTimeHours}h</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Avg Stay Duration</p>
                  <p className="text-lg font-bold">{exeat.avgStayDurationDays}d</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-red-600">Overdue</p>
                  <p className="text-lg font-bold text-red-600">{exeat.overdueCount}</p>
                </div>
              </div>

              {/* By Type */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">By Type</h3>
                <HorizontalBars data={exeat.byType} />
              </div>

              {/* Top 5 Reasons */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top 5 Reasons</h3>
                <div className="space-y-1">
                  {exeat.topReasons.slice(0, 5).map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded px-3 py-1.5 text-sm bg-muted/30">
                      <span className="capitalize">{r.reason}</span>
                      <span className="text-xs font-medium text-muted-foreground">{r.count}</span>
                    </div>
                  ))}
                  {exeat.topReasons.length === 0 && (
                    <p className="text-sm text-muted-foreground">No reason data available.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Click &quot;Load Data&quot; to view exeat insights.
            </p>
          )}
        </div>
      </div>

      {/* ─── Attendance Patterns ────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Attendance Patterns</h2>
            <p className="text-xs text-muted-foreground">Roll call analytics and chronic absentees (last 30 days)</p>
          </div>
          {!rollCall && (
            <button
              onClick={loadRollCall}
              disabled={loadingRollCall || isPending}
              className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              Load Data
            </button>
          )}
        </div>
        <div className="p-4">
          {loadingRollCall ? (
            <Spinner />
          ) : rollCall ? (
            <div className="space-y-5">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Total Roll Calls</p>
                  <p className="text-lg font-bold">{rollCall.totalRollCalls}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Overall Attendance Rate</p>
                  <p className="text-lg font-bold text-green-600">{rollCall.overallAttendanceRate}%</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Chronic Absentees</p>
                  <p className="text-lg font-bold text-red-600">{rollCall.chronicAbsentees.length}</p>
                </div>
              </div>

              {/* Chronic Absentees Table */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Chronic Absentees (&gt;3 absences)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-2 text-left font-medium">Student</th>
                        <th className="px-4 py-2 text-center font-medium">Absence Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rollCall.chronicAbsentees.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                            No chronic absentees found.
                          </td>
                        </tr>
                      ) : (
                        rollCall.chronicAbsentees.map((s) => (
                          <tr key={s.studentId} className="border-b border-border last:border-0">
                            <td className="px-4 py-2">{s.studentName}</td>
                            <td className="px-4 py-2 text-center">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  s.absenceCount > 5
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {s.absenceCount}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Click &quot;Load Data&quot; to view attendance patterns.
            </p>
          )}
        </div>
      </div>

      {/* ─── Incident Overview ──────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Incident Overview</h2>
            <p className="text-xs text-muted-foreground">Incident statistics and breakdown (last 90 days)</p>
          </div>
          {!incidents && (
            <button
              onClick={loadIncidents}
              disabled={loadingIncidents || isPending}
              className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              Load Data
            </button>
          )}
        </div>
        <div className="p-4">
          {loadingIncidents ? (
            <Spinner />
          ) : incidents ? (
            <div className="space-y-5">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Total Incidents</p>
                  <p className="text-lg font-bold">{incidents.total}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Avg Resolution</p>
                  <p className="text-lg font-bold">{incidents.avgResolutionDays} days</p>
                </div>
              </div>

              {/* By Severity */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">By Severity</h3>
                <HorizontalBars data={incidents.bySeverity} colorFn={getSeverityBarColor} />
              </div>

              {/* By Category */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">By Category</h3>
                <div className="space-y-1">
                  {Object.entries(incidents.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between rounded px-3 py-1.5 text-sm bg-muted/30">
                        <span>{formatLabel(category)}</span>
                        <span className="text-xs font-medium text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  {Object.keys(incidents.byCategory).length === 0 && (
                    <p className="text-sm text-muted-foreground">No category data available.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Click &quot;Load Data&quot; to view incident overview.
            </p>
          )}
        </div>
      </div>

      {/* ─── Health (Sick Bay) ──────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Health (Sick Bay)</h2>
            <p className="text-xs text-muted-foreground">Sick bay admissions, symptoms, and severity (last 90 days)</p>
          </div>
          {!sickBay && (
            <button
              onClick={loadSickBay}
              disabled={loadingSickBay || isPending}
              className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              Load Data
            </button>
          )}
        </div>
        <div className="p-4">
          {loadingSickBay ? (
            <Spinner />
          ) : sickBay ? (
            <div className="space-y-5">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Total Admissions</p>
                  <p className="text-lg font-bold">{sickBay.total}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Avg Stay</p>
                  <p className="text-lg font-bold">{sickBay.avgStayHours}h</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Referral Rate</p>
                  <p className="text-lg font-bold">{sickBay.referralRate}%</p>
                </div>
              </div>

              {/* Common Symptoms */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Common Symptoms</h3>
                <div className="space-y-1">
                  {sickBay.commonSymptoms.map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded px-3 py-1.5 text-sm bg-muted/30">
                      <span className="capitalize">{s.symptom}</span>
                      <span className="text-xs font-medium text-muted-foreground">{s.count}</span>
                    </div>
                  ))}
                  {sickBay.commonSymptoms.length === 0 && (
                    <p className="text-sm text-muted-foreground">No symptom data available.</p>
                  )}
                </div>
              </div>

              {/* By Severity */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">By Severity</h3>
                <HorizontalBars data={sickBay.bySeverity} colorFn={getSeverityBarColor} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Click &quot;Load Data&quot; to view sick bay analytics.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
