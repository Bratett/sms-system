"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  getAiDashboardAction,
  computeRiskProfilesAction,
} from "@/modules/ai/actions/analytics.action";

interface DashboardData {
  totalStudents: number;
  profilesComputed: number;
  riskDistribution: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  avgRiskScore: number;
  trendDistribution: {
    improving: number;
    stable: number;
    declining: number;
  };
  needsAttention: number;
}

export function AnalyticsClient() {
  const [isPending, startTransition] = useTransition();

  const [academicYearId, setAcademicYearId] = useState("");
  const [termId, setTermId] = useState("");
  const [classArmId, setClassArmId] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  function handleLoadDashboard() {
    if (!academicYearId || !termId) {
      toast.error("Please enter both Academic Year ID and Term ID.");
      return;
    }

    startTransition(async () => {
      const result = await getAiDashboardAction({
        academicYearId,
        termId,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if ("data" in result) {
        setDashboard(result.data);
      }
    });
  }

  async function handleComputeProfiles() {
    if (!academicYearId || !termId) {
      toast.error("Please enter both Academic Year ID and Term ID.");
      return;
    }

    setIsComputing(true);
    try {
      const payload: { academicYearId: string; termId: string; classArmId?: string } = {
        academicYearId,
        termId,
      };
      if (classArmId.trim()) {
        payload.classArmId = classArmId.trim();
      }

      const result = await computeRiskProfilesAction(payload);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if ("data" in result) {
        toast.success(
          `Risk profiles computed: ${result.data.summary.total} students assessed (${result.data.summary.critical} critical, ${result.data.summary.high} high, ${result.data.summary.moderate} moderate, ${result.data.summary.low} low).`
        );
        // Refresh dashboard data
        handleLoadDashboard();
      }
    } finally {
      setIsComputing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-muted-foreground">
              Academic Year ID
            </label>
            <input
              type="text"
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              placeholder="e.g. clx..."
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-muted-foreground">
              Term ID
            </label>
            <input
              type="text"
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              placeholder="e.g. clx..."
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleLoadDashboard}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load Dashboard"}
          </button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboard && (
        <>
          {/* Stat Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="mt-1 text-2xl font-bold">{dashboard.totalStudents}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Profiles Computed</p>
              <p className="mt-1 text-2xl font-bold">{dashboard.profilesComputed}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Avg Risk Score</p>
              <p className="mt-1 text-2xl font-bold">
                {dashboard.avgRiskScore.toFixed(1)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Needs Attention</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {dashboard.needsAttention}
              </p>
            </div>
          </div>

          {/* Risk Distribution */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Risk Distribution</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:bg-red-950/30 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Critical
                </p>
                <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-400">
                  {dashboard.riskDistribution.critical}
                </p>
              </div>
              <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 dark:bg-orange-950/30 dark:border-orange-800">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                  High
                </p>
                <p className="mt-1 text-2xl font-bold text-orange-700 dark:text-orange-400">
                  {dashboard.riskDistribution.high}
                </p>
              </div>
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:bg-yellow-950/30 dark:border-yellow-800">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Moderate
                </p>
                <p className="mt-1 text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {dashboard.riskDistribution.moderate}
                </p>
              </div>
              <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:bg-green-950/30 dark:border-green-800">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Low
                </p>
                <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-400">
                  {dashboard.riskDistribution.low}
                </p>
              </div>
            </div>
          </div>

          {/* Trend Distribution */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Trend Distribution</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:bg-green-950/30 dark:border-green-800">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Improving
                </p>
                <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-400">
                  {dashboard.trendDistribution.improving}
                </p>
              </div>
              <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 dark:bg-blue-950/30 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Stable
                </p>
                <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {dashboard.trendDistribution.stable}
                </p>
              </div>
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:bg-red-950/30 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Declining
                </p>
                <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-400">
                  {dashboard.trendDistribution.declining}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Actions Section */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h3 className="text-lg font-semibold">Actions</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-muted-foreground">
              Class Arm ID (optional)
            </label>
            <input
              type="text"
              value={classArmId}
              onChange={(e) => setClassArmId(e.target.value)}
              placeholder="Filter by class arm..."
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleComputeProfiles}
            disabled={isComputing || isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isComputing ? "Computing..." : "Compute Risk Profiles"}
          </button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/analytics/risk-profiles"
          className="rounded-lg border border-border bg-card p-6 hover:bg-muted/30 transition-colors"
        >
          <h3 className="text-lg font-semibold">Student Risk Profiles</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            View and filter individual student risk assessments by level.
          </p>
        </Link>
        <div className="rounded-lg border border-border bg-card p-6 opacity-60">
          <h3 className="text-lg font-semibold">Attendance Anomalies</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Detect unusual attendance patterns and flag anomalies.
          </p>
        </div>
      </div>
    </div>
  );
}
