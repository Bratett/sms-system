"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { getRiskProfilesAction } from "@/modules/ai/actions/analytics.action";

interface RiskProfile {
  id: string;
  studentId: string;
  riskLevel: string;
  riskScore: number;
  factors: string[];
  recommendations: string[];
  student: { id: string; firstName: string; lastName: string; studentId: string } | null;
  [key: string]: unknown;
}

const RISK_LEVEL_OPTIONS = ["ALL", "CRITICAL", "HIGH", "MODERATE", "LOW"] as const;

const RISK_BADGE_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
  MODERATE: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400",
  LOW: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400",
};

export function RiskProfilesClient() {
  const [isPending, startTransition] = useTransition();

  const [academicYearId, setAcademicYearId] = useState("");
  const [termId, setTermId] = useState("");
  const [classArmId, setClassArmId] = useState("");
  const [riskLevel, setRiskLevel] = useState<string>("ALL");

  const [profiles, setProfiles] = useState<RiskProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleSearch(targetPage = 1) {
    if (!academicYearId || !termId) {
      toast.error("Please enter both Academic Year ID and Term ID.");
      return;
    }

    startTransition(async () => {
      const filters: Record<string, unknown> = {
        academicYearId,
        termId,
        page: targetPage,
        pageSize,
      };
      if (classArmId.trim()) {
        filters.classArmId = classArmId.trim();
      }
      if (riskLevel !== "ALL") {
        filters.riskLevel = riskLevel;
      }

      const result = await getRiskProfilesAction(filters as never);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setProfiles((result.data ?? []) as RiskProfile[]);
      setTotal(result.total ?? 0);
      setPage(result.page ?? targetPage);
    });
  }

  const totalPages = Math.ceil(total / pageSize);

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
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-muted-foreground">
              Class Arm ID
            </label>
            <input
              type="text"
              value={classArmId}
              onChange={(e) => setClassArmId(e.target.value)}
              placeholder="Optional"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-muted-foreground">
              Risk Level
            </label>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {RISK_LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => handleSearch(1)}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Student Name</th>
                <th className="px-4 py-3 text-left font-medium">Student ID</th>
                <th className="px-4 py-3 text-center font-medium">Risk Level</th>
                <th className="px-4 py-3 text-center font-medium">Risk Score</th>
                <th className="px-4 py-3 text-center font-medium">Trend</th>
                <th className="px-4 py-3 text-center font-medium">Factors</th>
                <th className="px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {isPending
                      ? "Loading risk profiles..."
                      : "No risk profiles found. Enter filters and click Search."}
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
                  <>
                    <tr
                      key={profile.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">
                        {profile.student ? `${profile.student.firstName} ${profile.student.lastName}` : "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {profile.student?.studentId ?? profile.studentId}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            RISK_BADGE_STYLES[profile.riskLevel] ?? ""
                          }`}
                        >
                          {profile.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {profile.riskScore.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-medium ${
                            String(profile.trend ?? "") === "improving"
                              ? "text-green-600"
                              : String(profile.trend ?? "") === "declining"
                              ? "text-red-600"
                              : "text-blue-600"
                          }`}
                        >
                          {String(profile.trend ?? "stable")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {profile.factors?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            setExpandedId(
                              expandedId === profile.id ? null : profile.id
                            )
                          }
                          className="text-xs text-primary hover:underline"
                        >
                          {expandedId === profile.id ? "Collapse" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === profile.id && (
                      <tr
                        key={`${profile.id}-details`}
                        className="border-b border-border bg-muted/20"
                      >
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <h4 className="text-sm font-semibold mb-2">
                                Risk Factors
                              </h4>
                              {profile.factors && profile.factors.length > 0 ? (
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                  {profile.factors.map((factor, i) => (
                                    <li key={i}>{factor}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No factors recorded.
                                </p>
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold mb-2">
                                Recommendations
                              </h4>
                              {profile.recommendations &&
                              profile.recommendations.length > 0 ? (
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                  {profile.recommendations.map((rec, i) => (
                                    <li key={i}>{rec}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No recommendations available.
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing page {page} of {totalPages} ({total} total profiles)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleSearch(page - 1)}
              disabled={page <= 1 || isPending}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handleSearch(page + 1)}
              disabled={page >= totalPages || isPending}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
