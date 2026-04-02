"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getInspectionsAction } from "@/modules/boarding/actions/inspection.action";

// ─── Types ──────────────────────────────────────────────────────────

interface InspectionRow {
  id: string;
  hostelId: string;
  hostelName: string;
  dormitoryId: string | null;
  dormitoryName: string | null;
  inspectedBy: string;
  inspectorName: string;
  inspectionDate: Date;
  type: string;
  overallRating: string;
  cleanlinessRating: string;
  facilityRating: string;
  safetyRating: string;
  remarks: string | null;
  issues: string | null;
  followUpRequired: boolean;
  createdAt: Date;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ─── Badge Helpers ──────────────────────────────────────────────────

function getRatingBadge(rating: string) {
  const map: Record<string, string> = {
    EXCELLENT: "bg-green-100 text-green-700",
    GOOD: "bg-blue-100 text-blue-700",
    FAIR: "bg-yellow-100 text-yellow-700",
    POOR: "bg-orange-100 text-orange-700",
    CRITICAL: "bg-red-100 text-red-700",
  };
  return map[rating] ?? "bg-gray-100 text-gray-700";
}

function getTypeBadge(type: string) {
  const map: Record<string, string> = {
    ROUTINE: "bg-gray-100 text-gray-700",
    SURPRISE: "bg-yellow-100 text-yellow-700",
    FOLLOW_UP: "bg-blue-100 text-blue-700",
    END_OF_TERM: "bg-purple-100 text-purple-700",
  };
  return map[type] ?? "bg-gray-100 text-gray-700";
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Component ──────────────────────────────────────────────────────

export function InspectionsClient({
  inspections: initialInspections,
  pagination: initialPagination,
}: {
  inspections: InspectionRow[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [inspections, setInspections] = useState<InspectionRow[]>(initialInspections);
  const [pagination, setPagination] = useState(initialPagination);
  const [filterHostel, setFilterHostel] = useState("");
  const [filterType, setFilterType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ─── Fetch ──────────────────────────────────────────────────────

  function fetchInspections(page: number) {
    startTransition(async () => {
      const result = await getInspectionsAction({
        hostelId: filterHostel || undefined,
        type: filterType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: pagination.pageSize,
      });
      if (result.data) {
        setInspections(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        }
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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={filterHostel}
          onChange={(e) => setFilterHostel(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs w-44"
          placeholder="Hostel ID..."
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        >
          <option value="">All Types</option>
          <option value="ROUTINE">Routine</option>
          <option value="SURPRISE">Surprise</option>
          <option value="FOLLOW_UP">Follow Up</option>
          <option value="END_OF_TERM">End of Term</option>
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
        <button
          onClick={() => fetchInspections(1)}
          disabled={isPending}
          className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          Apply
        </button>
      </div>

      {/* Inspections Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Hostel</th>
                <th className="px-4 py-3 text-left font-medium">Dormitory</th>
                <th className="px-4 py-3 text-center font-medium">Type</th>
                <th className="px-4 py-3 text-center font-medium">Overall</th>
                <th className="px-4 py-3 text-center font-medium">Cleanliness</th>
                <th className="px-4 py-3 text-center font-medium">Facility</th>
                <th className="px-4 py-3 text-center font-medium">Safety</th>
                <th className="px-4 py-3 text-center font-medium">Follow-up</th>
                <th className="px-4 py-3 text-left font-medium">Inspector</th>
              </tr>
            </thead>
            <tbody>
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    No inspections found.
                  </td>
                </tr>
              ) : (
                inspections.map((ins) => (
                  <tr key={ins.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(ins.inspectionDate)}
                    </td>
                    <td className="px-4 py-3">{ins.hostelName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ins.dormitoryName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTypeBadge(ins.type)}`}
                      >
                        {formatLabel(ins.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRatingBadge(ins.overallRating)}`}
                      >
                        {formatLabel(ins.overallRating)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRatingBadge(ins.cleanlinessRating)}`}
                      >
                        {formatLabel(ins.cleanlinessRating)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRatingBadge(ins.facilityRating)}`}
                      >
                        {formatLabel(ins.facilityRating)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRatingBadge(ins.safetyRating)}`}
                      >
                        {formatLabel(ins.safetyRating)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {ins.followUpRequired ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                          Yes
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ins.inspectorName}
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
            onClick={() => fetchInspections(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchInspections(pagination.page + 1)}
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
