"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getVisitorsAction,
  checkOutVisitorAction,
} from "@/modules/boarding/actions/visitor.action";

// ─── Types ──────────────────────────────────────────────────────────

interface VisitorRow {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  hostelId: string;
  hostelName: string;
  visitorName: string;
  relationship: string;
  visitorPhone: string;
  visitorIdNumber: string | null;
  purpose: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  checkedInBy: string;
  checkedOutBy: string | null;
  status: string;
  notes: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface VisitorStats {
  activeVisitors: number;
  todayTotal: number;
  weekTotal: number;
  byRelationship: Record<string, number>;
}

// ─── Status Badge Colors ────────────────────────────────────────────

function getVisitorStatusBadge(status: string) {
  const map: Record<string, string> = {
    CHECKED_IN: "bg-green-100 text-green-700",
    CHECKED_OUT: "bg-gray-100 text-gray-500",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

// ─── Component ──────────────────────────────────────────────────────

export function VisitorsClient({
  visitors: initialVisitors,
  pagination: initialPagination,
  stats,
}: {
  visitors: VisitorRow[];
  pagination: Pagination;
  stats: VisitorStats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [visitors, setVisitors] = useState<VisitorRow[]>(initialVisitors);
  const [pagination, setPagination] = useState(initialPagination);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterHostel, setFilterHostel] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Fetch ──────────────────────────────────────────────────────

  function fetchVisitors(page: number) {
    startTransition(async () => {
      const result = await getVisitorsAction({
        status: filterStatus || undefined,
        hostelId: filterHostel || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: searchQuery || undefined,
        page,
        pageSize: pagination.pageSize,
      });
      if (result.data) {
        setVisitors(result.data as VisitorRow[]);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      }
    });
  }

  // ─── Actions ────────────────────────────────────────────────────

  function handleCheckOut(id: string) {
    startTransition(async () => {
      const result = await checkOutVisitorAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Visitor checked out successfully.");
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

  // Collect unique hostels from data for the dropdown
  const hostelOptions = Array.from(
    new Map(visitors.map((v) => [v.hostelId, v.hostelName])).entries(),
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-600">Active Visitors</p>
          <p className="text-xl font-bold text-blue-700">{stats.activeVisitors}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-xs text-green-600">Today&apos;s Visits</p>
          <p className="text-xl font-bold text-green-700">{stats.todayTotal}</p>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
          <p className="text-xs text-purple-600">This Week</p>
          <p className="text-xl font-bold text-purple-700">{stats.weekTotal}</p>
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
          <option value="CHECKED_IN">Checked In</option>
          <option value="CHECKED_OUT">Checked Out</option>
        </select>
        <select
          value={filterHostel}
          onChange={(e) => setFilterHostel(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        >
          <option value="">All Hostels</option>
          {hostelOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          placeholder="To"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs w-48"
          placeholder="Search visitor or student..."
        />
        <button
          onClick={() => fetchVisitors(1)}
          disabled={isPending}
          className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          Apply
        </button>
      </div>

      {/* Visitors Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Visitor Name</th>
                <th className="px-4 py-3 text-left font-medium">Relationship</th>
                <th className="px-4 py-3 text-left font-medium">Phone</th>
                <th className="px-4 py-3 text-left font-medium">Student</th>
                <th className="px-4 py-3 text-left font-medium">Hostel</th>
                <th className="px-4 py-3 text-left font-medium">Purpose</th>
                <th className="px-4 py-3 text-left font-medium">Check In</th>
                <th className="px-4 py-3 text-left font-medium">Check Out</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visitors.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    No visitor records found.
                  </td>
                </tr>
              ) : (
                visitors.map((v) => (
                  <tr
                    key={v.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 ${
                      v.status === "CHECKED_IN" ? "bg-green-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">{v.visitorName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.relationship}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.visitorPhone}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{v.studentName}</p>
                        <p className="text-xs text-muted-foreground">{v.studentNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{v.hostelName}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">
                      {v.purpose}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(v.checkInAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {v.checkOutAt ? formatDateTime(v.checkOutAt) : "---"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getVisitorStatusBadge(
                          v.status,
                        )}`}
                      >
                        {v.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {v.status === "CHECKED_IN" && (
                        <button
                          onClick={() => handleCheckOut(v.id)}
                          disabled={isPending}
                          className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                        >
                          Check Out
                        </button>
                      )}
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
            onClick={() => fetchVisitors(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchVisitors(pagination.page + 1)}
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
