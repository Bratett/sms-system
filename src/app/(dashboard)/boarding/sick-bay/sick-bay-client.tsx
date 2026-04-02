"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  getSickBayAdmissionsAction,
  dischargeSickBayAction,
  referSickBayAction,
} from "@/modules/boarding/actions/sick-bay.action";

// ─── Types ──────────────────────────────────────────────────────────

interface AdmissionRow {
  id: string;
  admissionNumber: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  hostelId: string;
  hostelName: string;
  admittedBy: string;
  admittedAt: Date;
  symptoms: string;
  initialDiagnosis: string | null;
  temperature: number | null;
  severity: string;
  status: string;
  treatmentNotes: string | null;
  dischargedBy: string | null;
  dischargedAt: Date | null;
  dischargeNotes: string | null;
  referredTo: string | null;
  parentNotified: boolean;
  medicationsCount: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface SickBayStats {
  currentlyAdmitted: number;
  underObservation: number;
  totalDischarged: number;
  totalReferred: number;
  bySeverity: {
    mild: number;
    moderate: number;
    severe: number;
    emergency: number;
  };
}

// ─── Badge Helpers ──────────────────────────────────────────────────

function getSeverityBadge(severity: string) {
  const map: Record<string, string> = {
    MILD: "bg-green-100 text-green-700",
    MODERATE: "bg-yellow-100 text-yellow-700",
    SEVERE: "bg-orange-100 text-orange-700",
    EMERGENCY: "bg-red-100 text-red-700",
  };
  return map[severity] ?? "bg-gray-100 text-gray-700";
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    ADMITTED: "bg-blue-100 text-blue-700",
    UNDER_OBSERVATION: "bg-yellow-100 text-yellow-700",
    DISCHARGED: "bg-green-100 text-green-700",
    REFERRED: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

// ─── Component ──────────────────────────────────────────────────────

export function SickBayClient({
  admissions: initialAdmissions,
  pagination: initialPagination,
  stats,
}: {
  admissions: AdmissionRow[];
  pagination: Pagination;
  stats: SickBayStats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [admissions, setAdmissions] = useState<AdmissionRow[]>(initialAdmissions);
  const [pagination, setPagination] = useState(initialPagination);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterHostel, setFilterHostel] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Refer modal
  const [referModal, setReferModal] = useState<{ id: string } | null>(null);
  const [referredTo, setReferredTo] = useState("");
  const [referNotes, setReferNotes] = useState("");

  // ─── Fetch ──────────────────────────────────────────────────────

  function fetchAdmissions(page: number) {
    startTransition(async () => {
      const result = await getSickBayAdmissionsAction({
        status: filterStatus || undefined,
        hostelId: filterHostel || undefined,
        search: searchQuery || undefined,
        page,
        pageSize: pagination.pageSize,
      });
      if (result.data) {
        setAdmissions(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      }
    });
  }

  // ─── Actions ────────────────────────────────────────────────────

  function handleDischarge(id: string) {
    const notes = prompt("Discharge notes (optional):");
    startTransition(async () => {
      const result = await dischargeSickBayAction(id, notes || undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Student discharged from sick bay.");
        router.refresh();
      }
    });
  }

  function handleRefer() {
    if (!referModal) return;
    if (!referredTo.trim()) {
      toast.error("Please enter the referral destination.");
      return;
    }

    startTransition(async () => {
      const result = await referSickBayAction(
        referModal.id,
        referredTo,
        referNotes || undefined,
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Student referred successfully.");
        setReferModal(null);
        setReferredTo("");
        setReferNotes("");
        router.refresh();
      }
    });
  }

  function formatDateTime(date: Date | string) {
    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-blue-600">Currently Admitted</p>
          <p className="text-xl font-bold">{stats.currentlyAdmitted}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-yellow-600">Under Observation</p>
          <p className="text-xl font-bold">{stats.underObservation}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-green-600">Discharged</p>
          <p className="text-xl font-bold">{stats.totalDischarged}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-red-600">Referred</p>
          <p className="text-xl font-bold">{stats.totalReferred}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="ADMITTED">Admitted</option>
          <option value="UNDER_OBSERVATION">Under Observation</option>
          <option value="DISCHARGED">Discharged</option>
          <option value="REFERRED">Referred</option>
        </select>
        <input
          type="text"
          value={filterHostel}
          onChange={(e) => setFilterHostel(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs w-36"
          placeholder="Hostel ID..."
        />
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        >
          <option value="">All Severities</option>
          <option value="MILD">Mild</option>
          <option value="MODERATE">Moderate</option>
          <option value="SEVERE">Severe</option>
          <option value="EMERGENCY">Emergency</option>
        </select>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs w-48"
          placeholder="Search student..."
        />
        <button
          onClick={() => fetchAdmissions(1)}
          disabled={isPending}
          className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          Apply
        </button>
      </div>

      {/* Admissions Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Admission #</th>
                <th className="px-4 py-3 text-left font-medium">Student</th>
                <th className="px-4 py-3 text-left font-medium">Hostel</th>
                <th className="px-4 py-3 text-left font-medium">Symptoms</th>
                <th className="px-4 py-3 text-center font-medium">Severity</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Admitted At</th>
                <th className="px-4 py-3 text-center font-medium">Meds</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admissions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    No sick bay admissions found.
                  </td>
                </tr>
              ) : (
                admissions.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/boarding/sick-bay/${a.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {a.admissionNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{a.studentName}</p>
                        <p className="text-xs text-muted-foreground">{a.studentNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.hostelName}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {a.symptoms}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSeverityBadge(a.severity)}`}
                      >
                        {a.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(a.status)}`}
                      >
                        {a.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(a.admittedAt)}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {a.medicationsCount}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {(a.status === "ADMITTED" || a.status === "UNDER_OBSERVATION") && (
                        <>
                          <button
                            onClick={() => handleDischarge(a.id)}
                            disabled={isPending}
                            className="text-xs text-green-600 hover:text-green-800 font-medium mr-2"
                          >
                            Discharge
                          </button>
                          <button
                            onClick={() => setReferModal({ id: a.id })}
                            disabled={isPending}
                            className="text-xs text-red-600 hover:text-red-800 font-medium mr-2"
                          >
                            Refer
                          </button>
                        </>
                      )}
                      <Link
                        href={`/boarding/sick-bay/${a.id}`}
                        className="text-xs text-primary hover:text-primary/80 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchAdmissions(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchAdmissions(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Next
          </button>
        </div>
      )}

      {/* ─── Refer Modal ───────────────────────────────────────────── */}
      {referModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Refer Student</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Refer this student to an external facility or specialist.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Referred To</label>
                <input
                  type="text"
                  value={referredTo}
                  onChange={(e) => setReferredTo(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Hospital, clinic, or specialist name..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <textarea
                  value={referNotes}
                  onChange={(e) => setReferNotes(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Referral notes..."
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setReferModal(null);
                  setReferredTo("");
                  setReferNotes("");
                }}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleRefer}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Referring..." : "Refer Student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
