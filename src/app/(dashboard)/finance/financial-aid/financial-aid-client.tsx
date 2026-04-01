"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createFinancialAidApplicationAction,
  reviewFinancialAidAction,
  markUnderReviewAction,
} from "@/modules/finance/actions/financial-aid.action";

import type { Monetary } from "@/lib/monetary";
interface Application {
  id: string;
  studentId: string;
  studentName: string;
  studentIdNumber: string;
  className: string;
  aidType: string;
  requestedAmount: Monetary;
  approvedAmount: Monetary | null;
  reason: string;
  status: string;
  termName: string;
  academicYearName: string;
  submittedByName: string;
  reviewedByName: string | null;
  householdIncome: Monetary | null;
  numberOfDependents: number | null;
  reviewNotes: string | null;
  createdAt: Date | string;
}

interface Pagination { page: number; pageSize: number; total: number; totalPages: number; }
interface AcademicYear { id: string; name: string; isCurrent: boolean; }
interface Term { id: string; name: string; academicYearId: string; isCurrent: boolean; }

type StatusFilter = "ALL" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
type AidType = "NEEDS_BASED" | "MERIT_BASED" | "HARDSHIP" | "ORPHAN_SUPPORT" | "COMMUNITY_SPONSORED";

const AID_TYPE_STYLES: Record<string, { label: string; className: string }> = {
  NEEDS_BASED: { label: "Needs-Based", className: "bg-blue-100 text-blue-700" },
  MERIT_BASED: { label: "Merit-Based", className: "bg-green-100 text-green-700" },
  HARDSHIP: { label: "Hardship", className: "bg-red-100 text-red-700" },
  ORPHAN_SUPPORT: { label: "Orphan Support", className: "bg-purple-100 text-purple-700" },
  COMMUNITY_SPONSORED: { label: "Community", className: "bg-orange-100 text-orange-700" },
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: "Submitted", className: "bg-gray-100 text-gray-700" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700" },
  DISBURSED: { label: "Disbursed", className: "bg-blue-100 text-blue-700" },
};

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinancialAidClient({
  applications,
  pagination,
  academicYears,
  terms,
}: {
  applications: Application[];
  pagination: Pagination;
  academicYears: AcademicYear[];
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const [formData, setFormData] = useState({
    studentId: "", academicYearId: academicYears.find((ay) => ay.isCurrent)?.id ?? "",
    termId: terms.find((t) => t.isCurrent)?.id ?? "", aidType: "NEEDS_BASED" as AidType,
    requestedAmount: 0, reason: "", householdIncome: "", numberOfDependents: "",
  });

  const [reviewData, setReviewData] = useState({ approvedAmount: 0, reviewNotes: "" });

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return applications;
    return applications.filter((a) => a.status === statusFilter);
  }, [applications, statusFilter]);

  const pendingCount = applications.filter((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW").length;
  const totalRequested = applications.reduce((sum, a) => sum + Number(a.requestedAmount), 0);
  const totalApproved = applications.filter((a) => a.status === "APPROVED" || a.status === "DISBURSED").reduce((sum, a) => sum + Number(a.approvedAmount ?? 0), 0);

  function handleSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createFinancialAidApplicationAction({
        studentId: formData.studentId, academicYearId: formData.academicYearId,
        termId: formData.termId, aidType: formData.aidType,
        requestedAmount: formData.requestedAmount, reason: formData.reason,
        supportingDocs: [],
        householdIncome: formData.householdIncome ? parseFloat(formData.householdIncome) : undefined,
        numberOfDependents: formData.numberOfDependents ? parseInt(formData.numberOfDependents) : undefined,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Financial aid application submitted");
      setShowCreateModal(false);
      router.refresh();
    });
  }

  function handleOpenReview(app: Application) {
    setSelectedApp(app);
    setReviewData({ approvedAmount: Number(app.requestedAmount), reviewNotes: "" });
    if (app.status === "SUBMITTED") {
      startTransition(async () => {
        await markUnderReviewAction(app.id);
        router.refresh();
      });
    }
    setShowReviewModal(true);
  }

  function handleApprove() {
    if (!selectedApp) return;
    startTransition(async () => {
      const result = await reviewFinancialAidAction({
        applicationId: selectedApp.id, status: "APPROVED",
        approvedAmount: reviewData.approvedAmount, reviewNotes: reviewData.reviewNotes || undefined,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Application approved");
      setShowReviewModal(false);
      router.refresh();
    });
  }

  function handleReject() {
    if (!selectedApp) return;
    if (!reviewData.reviewNotes.trim()) { toast.error("Please provide a reason for rejection"); return; }
    startTransition(async () => {
      const result = await reviewFinancialAidAction({
        applicationId: selectedApp.id, status: "REJECTED",
        reviewNotes: reviewData.reviewNotes,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Application rejected");
      setShowReviewModal(false);
      router.refresh();
    });
  }

  const filters: StatusFilter[] = ["ALL", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"];

  return (
    <div className="space-y-6">
      <PageHeader title="Financial Aid" description="Review and manage financial aid applications for students"
        actions={<button onClick={() => setShowCreateModal(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">New Application</button>}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Applications</p>
          <p className="text-2xl font-bold">{applications.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Requested</p>
          <p className="text-2xl font-bold">{formatCurrency(totalRequested)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Approved</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalApproved)}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {filters.map((filter) => (
          <button key={filter} onClick={() => setStatusFilter(filter)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === filter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {filter === "ALL" ? "All" : filter.replace("_", " ")}
            {filter === "SUBMITTED" && pendingCount > 0 && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-xs text-white">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No applications found" description="No financial aid applications match the current filter." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Aid Type</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Approved</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Term</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((app) => (
                  <tr key={app.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{app.studentName}</div>
                      <div className="text-xs text-muted-foreground">{app.studentIdNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{app.className}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${AID_TYPE_STYLES[app.aidType]?.className ?? ""}`}>
                        {AID_TYPE_STYLES[app.aidType]?.label ?? app.aidType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(app.requestedAmount)}</td>
                    <td className="px-4 py-3 text-sm text-green-600">
                      {app.approvedAmount !== null ? formatCurrency(app.approvedAmount) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[app.status]?.className ?? ""}`}>
                        {STATUS_STYLES[app.status]?.label ?? app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{app.termName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(app.createdAt).toLocaleDateString("en-GH")}
                    </td>
                    <td className="px-4 py-3">
                      {(app.status === "SUBMITTED" || app.status === "UNDER_REVIEW") && (
                        <button onClick={() => handleOpenReview(app)} className="text-xs text-primary hover:underline font-medium">
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Application Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Financial Aid Application</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student ID *</label>
                <input type="text" value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Enter student database ID" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Academic Year *</label>
                  <select value={formData.academicYearId} onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select Year</option>
                    {academicYears.map((ay) => (<option key={ay.id} value={ay.id}>{ay.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Term *</label>
                  <select value={formData.termId} onChange={(e) => setFormData({ ...formData, termId: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select Term</option>
                    {terms.filter((t) => !formData.academicYearId || t.academicYearId === formData.academicYearId).map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Aid Type *</label>
                <select value={formData.aidType} onChange={(e) => setFormData({ ...formData, aidType: e.target.value as AidType })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="NEEDS_BASED">Needs-Based</option>
                  <option value="MERIT_BASED">Merit-Based</option>
                  <option value="HARDSHIP">Hardship</option>
                  <option value="ORPHAN_SUPPORT">Orphan Support</option>
                  <option value="COMMUNITY_SPONSORED">Community Sponsored</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Requested Amount (GHS) *</label>
                <input type="number" value={formData.requestedAmount} onChange={(e) => setFormData({ ...formData, requestedAmount: parseFloat(e.target.value) || 0 })} required min="0.01" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason *</label>
                <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} required rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Describe the student's financial situation and need for aid..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Household Income (GHS)</label>
                  <input type="number" value={formData.householdIncome} onChange={(e) => setFormData({ ...formData, householdIncome: e.target.value })} min="0" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Dependents</label>
                  <input type="number" value={formData.numberOfDependents} onChange={(e) => setFormData({ ...formData, numberOfDependents: e.target.value })} min="0" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Review Application</h2>
              <button onClick={() => setShowReviewModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>

            {/* Application Details */}
            <div className="space-y-3 mb-6 rounded-lg border border-border p-4 bg-muted/30">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Student:</span> <span className="font-medium">{selectedApp.studentName}</span></div>
                <div><span className="text-muted-foreground">ID:</span> {selectedApp.studentIdNumber}</div>
                <div><span className="text-muted-foreground">Class:</span> {selectedApp.className}</div>
                <div><span className="text-muted-foreground">Term:</span> {selectedApp.termName}</div>
                <div><span className="text-muted-foreground">Type:</span> <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${AID_TYPE_STYLES[selectedApp.aidType]?.className ?? ""}`}>{AID_TYPE_STYLES[selectedApp.aidType]?.label ?? selectedApp.aidType}</span></div>
                <div><span className="text-muted-foreground">Requested:</span> <span className="font-medium">{formatCurrency(selectedApp.requestedAmount)}</span></div>
                {selectedApp.householdIncome !== null && (
                  <div><span className="text-muted-foreground">Household Income:</span> {formatCurrency(selectedApp.householdIncome)}</div>
                )}
                {selectedApp.numberOfDependents !== null && (
                  <div><span className="text-muted-foreground">Dependents:</span> {selectedApp.numberOfDependents}</div>
                )}
              </div>
              <div className="text-sm"><span className="text-muted-foreground">Reason:</span> <p className="mt-1">{selectedApp.reason}</p></div>
            </div>

            {/* Review Actions */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Approved Amount (GHS)</label>
                <input type="number" value={reviewData.approvedAmount} onChange={(e) => setReviewData({ ...reviewData, approvedAmount: parseFloat(e.target.value) || 0 })} min="0" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Review Notes</label>
                <textarea value={reviewData.reviewNotes} onChange={(e) => setReviewData({ ...reviewData, reviewNotes: e.target.value })} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Add notes about this decision..." />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowReviewModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button onClick={handleReject} disabled={isPending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  {isPending ? "..." : "Reject"}
                </button>
                <button onClick={handleApprove} disabled={isPending} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  {isPending ? "..." : "Approve"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
