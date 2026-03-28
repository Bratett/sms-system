"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getSubmittedMarksAction,
  getMarkDetailsAction,
  approveMarksAction,
  rejectMarksAction,
} from "@/modules/academics/actions/mark.action";

// ─── Types ──────────────────────────────────────────────────────────

interface MarkGroup {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  classArmId: string;
  classArmName: string;
  assessmentTypeId: string;
  assessmentTypeName: string;
  assessmentCategory: string;
  maxScore: number;
  termId: string;
  termName: string;
  status: string;
  enteredBy: string;
  enteredByName: string;
  marksCount: number;
  totalScore: number;
  averageScore: number;
  submittedAt: Date | null;
}

interface MarkDetail {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  score: number;
  maxScore: number;
  status: string;
  enteredAt: Date;
}

interface Term {
  id: string;
  name: string;
  termNumber: number;
  academicYearId: string;
  academicYearName: string;
  isCurrent: boolean;
}

// ─── Component ──────────────────────────────────────────────────────

export function ApprovalClient({
  initialMarkGroups,
  terms,
}: {
  initialMarkGroups: MarkGroup[];
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("SUBMITTED");
  const currentTerm = terms.find((t) => t.isCurrent);
  const [termFilter, setTermFilter] = useState<string>("");
  const [markGroups, setMarkGroups] = useState<MarkGroup[]>(initialMarkGroups);

  // Expanded row details
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<MarkDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<MarkGroup | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Refresh data when filters change
  useEffect(() => {
    startTransition(async () => {
      const filters: Record<string, string> = {};
      if (statusFilter) filters.status = statusFilter;
      if (termFilter) filters.termId = termFilter;

      const result = await getSubmittedMarksAction(filters);
      if (result.data) {
        setMarkGroups(result.data);
      }
    });
  }, [statusFilter, termFilter]);

  // ─── Expand/Collapse Row ──────────────────────────────────────────

  function getGroupKey(g: MarkGroup) {
    return `${g.subjectId}|${g.classArmId}|${g.assessmentTypeId}|${g.termId}`;
  }

  function handleToggleExpand(group: MarkGroup) {
    const key = getGroupKey(group);
    if (expandedKey === key) {
      setExpandedKey(null);
      setExpandedDetails([]);
      return;
    }

    setExpandedKey(key);
    setLoadingDetails(true);

    startTransition(async () => {
      const result = await getMarkDetailsAction(
        group.subjectId,
        group.classArmId,
        group.assessmentTypeId,
        group.termId,
      );
      if (result.data) {
        setExpandedDetails(result.data);
      }
      setLoadingDetails(false);
    });
  }

  // ─── Approve ──────────────────────────────────────────────────────

  function handleApprove(group: MarkGroup) {
    if (!confirm(`Approve ${group.marksCount} marks for ${group.subjectName} - ${group.classArmName}?`)) {
      return;
    }

    startTransition(async () => {
      const result = await approveMarksAction(
        group.subjectId,
        group.classArmId,
        group.assessmentTypeId,
        group.termId,
      );

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.data?.count} mark(s) approved successfully.`);
        router.refresh();
      }
    });
  }

  // ─── Reject ───────────────────────────────────────────────────────

  function openRejectModal(group: MarkGroup) {
    setRejectTarget(group);
    setRejectReason("");
    setRejectError(null);
  }

  function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setRejectError("A reason is required when rejecting marks.");
      return;
    }

    startTransition(async () => {
      const result = await rejectMarksAction(
        rejectTarget.subjectId,
        rejectTarget.classArmId,
        rejectTarget.assessmentTypeId,
        rejectTarget.termId,
        rejectReason.trim(),
      );

      if (result.error) {
        setRejectError(result.error);
      } else {
        toast.success(`${result.data?.count} mark(s) rejected and returned to draft.`);
        setRejectTarget(null);
        router.refresh();
      }
    });
  }

  // ─── Status badge styling ─────────────────────────────────────────

  const STATUS_OPTIONS = [
    { value: "", label: "All Statuses" },
    { value: "SUBMITTED", label: "Submitted" },
    { value: "APPROVED", label: "Approved" },
    { value: "DRAFT", label: "Draft (Rejected)" },
  ];

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Term:</label>
          <select
            value={termFilter}
            onChange={(e) => setTermFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.academicYearName}) {t.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mark Groups Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-4 py-3"></th>
                <th className="px-4 py-3 text-left font-medium">Subject</th>
                <th className="px-4 py-3 text-left font-medium">Class Arm</th>
                <th className="px-4 py-3 text-left font-medium">Assessment</th>
                <th className="px-4 py-3 text-left font-medium">Entered By</th>
                <th className="px-4 py-3 text-center font-medium">Marks</th>
                <th className="px-4 py-3 text-center font-medium">Avg Score</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {markGroups.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    {statusFilter === "SUBMITTED"
                      ? "No marks pending approval."
                      : "No mark sets found for the selected filters."}
                  </td>
                </tr>
              ) : (
                markGroups.map((group) => {
                  const key = getGroupKey(group);
                  const isExpanded = expandedKey === key;

                  return (
                    <>
                      <tr
                        key={key}
                        className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => handleToggleExpand(group)}
                      >
                        <td className="px-4 py-3 text-center">
                          <span className="text-muted-foreground">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{group.subjectName}</div>
                          {group.subjectCode && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {group.subjectCode}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {group.classArmName}
                        </td>
                        <td className="px-4 py-3">
                          <div>{group.assessmentTypeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {group.assessmentCategory.replace(/_/g, " ")}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {group.enteredByName}
                        </td>
                        <td className="px-4 py-3 text-center font-medium">
                          {group.marksCount}
                        </td>
                        <td className="px-4 py-3 text-center font-medium">
                          {group.averageScore.toFixed(1)}/{group.maxScore}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={group.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {group.status === "SUBMITTED" && (
                            <div
                              className="flex items-center justify-end gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                onClick={() => handleApprove(group)}
                                disabled={isPending}
                              >
                                Approve
                              </button>
                              <button
                                className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                onClick={() => openRejectModal(group)}
                                disabled={isPending}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Expanded: Individual Student Marks */}
                      {isExpanded && (
                        <tr key={`${key}-details`}>
                          <td colSpan={9} className="bg-muted/20 px-4 py-3">
                            <div className="ml-8">
                              <h4 className="text-sm font-semibold text-foreground mb-3">
                                Individual Student Marks
                              </h4>
                              {loadingDetails ? (
                                <p className="text-xs text-muted-foreground py-2">
                                  Loading marks...
                                </p>
                              ) : expandedDetails.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2">
                                  No individual marks found.
                                </p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="px-3 py-2 text-left font-medium">#</th>
                                      <th className="px-3 py-2 text-left font-medium">Student ID</th>
                                      <th className="px-3 py-2 text-left font-medium">Student Name</th>
                                      <th className="px-3 py-2 text-center font-medium">Score</th>
                                      <th className="px-3 py-2 text-center font-medium">Max</th>
                                      <th className="px-3 py-2 text-center font-medium">%</th>
                                      <th className="px-3 py-2 text-center font-medium">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedDetails.map((detail, idx) => (
                                      <tr
                                        key={detail.id}
                                        className="border-b border-border/50 last:border-0"
                                      >
                                        <td className="px-3 py-2 text-muted-foreground">
                                          {idx + 1}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-muted-foreground">
                                          {detail.studentNumber}
                                        </td>
                                        <td className="px-3 py-2 font-medium">
                                          {detail.studentName}
                                        </td>
                                        <td className="px-3 py-2 text-center font-medium">
                                          {detail.score}
                                        </td>
                                        <td className="px-3 py-2 text-center text-muted-foreground">
                                          {detail.maxScore}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          {((detail.score / detail.maxScore) * 100).toFixed(1)}%
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <StatusBadge status={detail.status} />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Reject Marks</h2>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
              <div className="text-sm text-muted-foreground">
                Rejecting {rejectTarget.marksCount} mark(s) for{" "}
                <strong>{rejectTarget.subjectName}</strong> -{" "}
                <strong>{rejectTarget.classArmName}</strong> ({rejectTarget.assessmentTypeName}).
                <br />
                Marks will be returned to DRAFT status for correction.
              </div>

              {rejectError && (
                <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                  {rejectError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Please explain why these marks are being rejected..."
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? "Rejecting..." : "Reject Marks"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
