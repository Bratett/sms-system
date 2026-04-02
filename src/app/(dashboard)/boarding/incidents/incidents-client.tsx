"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  getIncidentsAction,
  updateIncidentAction,
} from "@/modules/boarding/actions/incident.action";

// ─── Types ──────────────────────────────────────────────────────────

interface IncidentRow {
  id: string;
  incidentNumber: string;
  hostelId: string;
  hostelName: string;
  dormitoryId: string | null;
  dormitoryName: string | null;
  studentIds: string[];
  studentNames: string[];
  reportedBy: string;
  reporterName: string;
  date: Date;
  time: string | null;
  category: string;
  severity: string;
  title: string;
  description: string;
  actionTaken: string | null;
  status: string;
  resolution: string | null;
  parentNotified: boolean;
  createdAt: Date;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface IncidentStats {
  total: number;
  byStatus: {
    reported: number;
    investigating: number;
    actionTaken: number;
    resolved: number;
    escalated: number;
    dismissed: number;
  };
  byCategory: Record<string, number>;
  bySeverity: {
    minor: number;
    moderate: number;
    major: number;
    critical: number;
  };
}

// ─── Badge Helpers ──────────────────────────────────────────────────

function getSeverityBadge(severity: string) {
  const map: Record<string, string> = {
    MINOR: "bg-gray-100 text-gray-700",
    MODERATE: "bg-yellow-100 text-yellow-700",
    MAJOR: "bg-orange-100 text-orange-700",
    CRITICAL: "bg-red-100 text-red-700",
  };
  return map[severity] ?? "bg-gray-100 text-gray-700";
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    REPORTED: "bg-yellow-100 text-yellow-700",
    INVESTIGATING: "bg-blue-100 text-blue-700",
    ACTION_TAKEN: "bg-purple-100 text-purple-700",
    RESOLVED: "bg-green-100 text-green-700",
    ESCALATED: "bg-red-100 text-red-700",
    DISMISSED: "bg-gray-100 text-gray-500",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

function getCategoryBadge(category: string) {
  const map: Record<string, string> = {
    CURFEW_VIOLATION: "bg-orange-100 text-orange-700",
    PROPERTY_DAMAGE: "bg-red-100 text-red-700",
    BULLYING: "bg-red-100 text-red-700",
    FIGHTING: "bg-red-100 text-red-700",
    UNAUTHORIZED_ABSENCE: "bg-yellow-100 text-yellow-700",
    SUBSTANCE_ABUSE: "bg-red-100 text-red-700",
    THEFT: "bg-red-100 text-red-700",
    NOISE_DISTURBANCE: "bg-blue-100 text-blue-700",
    HEALTH_EMERGENCY: "bg-purple-100 text-purple-700",
    SAFETY_HAZARD: "bg-orange-100 text-orange-700",
    OTHER: "bg-gray-100 text-gray-700",
  };
  return map[category] ?? "bg-gray-100 text-gray-700";
}

function formatCategory(category: string) {
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Component ──────────────────────────────────────────────────────

export function IncidentsClient({
  incidents: initialIncidents,
  pagination: initialPagination,
  stats,
}: {
  incidents: IncidentRow[];
  pagination: Pagination;
  stats: IncidentStats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [incidents, setIncidents] = useState<IncidentRow[]>(initialIncidents);
  const [pagination, setPagination] = useState(initialPagination);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Fetch ──────────────────────────────────────────────────────

  function fetchIncidents(page: number) {
    startTransition(async () => {
      const result = await getIncidentsAction({
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        severity: filterSeverity || undefined,
        search: searchQuery || undefined,
        page,
        pageSize: pagination.pageSize,
      });
      if (result.data) {
        setIncidents(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      }
    });
  }

  // ─── Actions ────────────────────────────────────────────────────

  function handleUpdateStatus(id: string, status: string) {
    startTransition(async () => {
      const result = await updateIncidentAction(id, { status });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Incident status updated to ${status.replace(/_/g, " ").toLowerCase()}.`);
        router.refresh();
      }
    });
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-yellow-600">Reported</p>
          <p className="text-xl font-bold">{stats.byStatus.reported}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-blue-600">Investigating</p>
          <p className="text-xl font-bold">{stats.byStatus.investigating}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-green-600">Resolved</p>
          <p className="text-xl font-bold">{stats.byStatus.resolved}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 border-red-200">
          <p className="text-xs text-red-600">Escalated</p>
          <p className="text-xl font-bold text-red-600">{stats.byStatus.escalated}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-gray-500">Dismissed</p>
          <p className="text-xl font-bold">{stats.byStatus.dismissed}</p>
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
          <option value="REPORTED">Reported</option>
          <option value="INVESTIGATING">Investigating</option>
          <option value="ACTION_TAKEN">Action Taken</option>
          <option value="RESOLVED">Resolved</option>
          <option value="ESCALATED">Escalated</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        >
          <option value="">All Categories</option>
          <option value="CURFEW_VIOLATION">Curfew Violation</option>
          <option value="PROPERTY_DAMAGE">Property Damage</option>
          <option value="BULLYING">Bullying</option>
          <option value="FIGHTING">Fighting</option>
          <option value="UNAUTHORIZED_ABSENCE">Unauthorized Absence</option>
          <option value="SUBSTANCE_ABUSE">Substance Abuse</option>
          <option value="THEFT">Theft</option>
          <option value="NOISE_DISTURBANCE">Noise Disturbance</option>
          <option value="HEALTH_EMERGENCY">Health Emergency</option>
          <option value="SAFETY_HAZARD">Safety Hazard</option>
          <option value="OTHER">Other</option>
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        >
          <option value="">All Severities</option>
          <option value="MINOR">Minor</option>
          <option value="MODERATE">Moderate</option>
          <option value="MAJOR">Major</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs w-48"
          placeholder="Search incidents..."
        />
        <button
          onClick={() => fetchIncidents(1)}
          disabled={isPending}
          className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          Apply
        </button>
      </div>

      {/* Incidents Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Incident #</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-center font-medium">Category</th>
                <th className="px-4 py-3 text-center font-medium">Severity</th>
                <th className="px-4 py-3 text-left font-medium">Hostel</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No incidents found.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/boarding/incidents/${inc.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {inc.incidentNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(inc.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{inc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {inc.studentNames.slice(0, 2).join(", ")}
                          {inc.studentNames.length > 2 && ` +${inc.studentNames.length - 2} more`}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCategoryBadge(
                          inc.category,
                        )}`}
                      >
                        {formatCategory(inc.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSeverityBadge(
                          inc.severity,
                        )}`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inc.hostelName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(
                          inc.status,
                        )}`}
                      >
                        {inc.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {inc.status === "REPORTED" && (
                        <button
                          onClick={() => handleUpdateStatus(inc.id, "INVESTIGATING")}
                          disabled={isPending}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-2"
                        >
                          Investigate
                        </button>
                      )}
                      {(inc.status === "INVESTIGATING" || inc.status === "ACTION_TAKEN") && (
                        <button
                          onClick={() => handleUpdateStatus(inc.id, "RESOLVED")}
                          disabled={isPending}
                          className="text-xs text-green-600 hover:text-green-800 font-medium mr-2"
                        >
                          Resolve
                        </button>
                      )}
                      <Link
                        href={`/boarding/incidents/${inc.id}`}
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
            onClick={() => fetchIncidents(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchIncidents(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
