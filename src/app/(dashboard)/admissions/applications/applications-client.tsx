"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getApplicationsAction,
  deleteApplicationAction,
} from "@/modules/admissions/actions/admission.action";
import type { AdmissionStats } from "@/modules/admissions/types";
import { formatDate } from "@/lib/utils";

interface ApplicationRow {
  id: string;
  applicationNumber: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  gender: string;
  previousSchool: string | null;
  jhsAggregate: number | null;
  programmePreference1Name: string | null;
  guardianPhone: string;
  status: string;
  submittedAt: Date;
  boardingStatus: string;
}

interface ApplicationsClientProps {
  initialApplications: ApplicationRow[];
  initialTotal: number;
  stats: AdmissionStats;
}

const STATUSES = [
  { label: "All Statuses", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Shortlisted", value: "SHORTLISTED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Enrolled", value: "ENROLLED" },
];

export function ApplicationsClient({
  initialApplications,
  initialTotal,
  stats,
}: ApplicationsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [applications, setApplications] = useState(initialApplications);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const totalPages = Math.ceil(total / pageSize);

  function fetchApplications(newPage: number, newSearch?: string, newStatus?: string) {
    startTransition(async () => {
      const result = await getApplicationsAction({
        page: newPage,
        pageSize,
        search: newSearch ?? search,
        status: newStatus ?? statusFilter,
      });
      if (result.data) {
        setApplications(result.data.applications as unknown as ApplicationRow[]);
        setTotal(result.data.total);
        setPage(newPage);
      }
    });
  }

  function handleSearch(value: string) {
    setSearch(value);
    fetchApplications(1, value, statusFilter);
  }

  function handleStatusFilter(value: string) {
    setStatusFilter(value);
    fetchApplications(1, search, value);
  }

  function handleDelete(id: string, appNumber: string) {
    if (!confirm(`Are you sure you want to delete application "${appNumber}"?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteApplicationAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Application deleted successfully.");
        router.refresh();
      }
    });
  }

  const statCards = [
    { label: "Total", value: stats.total, color: "bg-gray-100 text-gray-800" },
    { label: "Submitted", value: stats.submitted, color: "bg-blue-100 text-blue-800" },
    { label: "Under Review", value: stats.underReview, color: "bg-yellow-100 text-yellow-800" },
    { label: "Accepted", value: stats.accepted, color: "bg-green-100 text-green-800" },
    { label: "Rejected", value: stats.rejected, color: "bg-red-100 text-red-800" },
    { label: "Enrolled", value: stats.enrolled, color: "bg-purple-100 text-purple-800" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admission Applications"
        description="Manage student admission applications and enrollment."
        actions={
          <Link
            href="/admissions/applications/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New Application
          </Link>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-border bg-card p-4 text-center"
          >
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or application number..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">App No.</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Gender</th>
                <th className="px-4 py-3 text-left font-medium">Previous School</th>
                <th className="px-4 py-3 text-left font-medium">JHS Agg.</th>
                <th className="px-4 py-3 text-left font-medium">Programme</th>
                <th className="px-4 py-3 text-left font-medium">Guardian Phone</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Submitted</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    No applications found.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr
                    key={app.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{app.applicationNumber}</td>
                    <td className="px-4 py-3 font-medium">
                      {app.firstName} {app.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{app.gender}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {app.previousSchool || "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {app.jhsAggregate ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {app.programmePreference1Name || "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{app.guardianPhone}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(app.submittedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() =>
                            router.push(`/admissions/applications/${app.id}`)
                          }
                        >
                          View
                        </button>
                        {(app.status === "SUBMITTED" || app.status === "UNDER_REVIEW") && (
                          <button
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                            onClick={() =>
                              router.push(`/admissions/applications/${app.id}`)
                            }
                          >
                            Review
                          </button>
                        )}
                        {app.status === "ACCEPTED" && (
                          <button
                            className="text-xs text-green-600 hover:text-green-800 font-medium"
                            onClick={() =>
                              router.push(`/admissions/applications/${app.id}`)
                            }
                          >
                            Enroll
                          </button>
                        )}
                        {app.status === "DRAFT" && (
                          <button
                            className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            onClick={() => handleDelete(app.id, app.applicationNumber)}
                            disabled={isPending}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
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
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, total)} of {total} applications
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchApplications(page - 1)}
              disabled={page <= 1 || isPending}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => fetchApplications(page + 1)}
              disabled={page >= totalPages || isPending}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
