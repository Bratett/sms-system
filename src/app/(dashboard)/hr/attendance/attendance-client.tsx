"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getStaffAttendanceAction,
  getDailyAttendanceOverviewAction,
  bulkRecordStaffAttendanceAction,
} from "@/modules/hr/actions/staff-attendance.action";
import { ChevronLeft, ChevronRight, Save, Loader2 } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
  "HALF_DAY",
  "ON_LEAVE",
  "HOLIDAY",
] as const;

type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

interface StaffMember {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  departmentName: string | null;
  position: string | null;
}

interface AttendanceRecord {
  id: string;
  staffId: string;
  status: string;
  remarks: string | null;
}

interface Overview {
  date: string;
  totalActive: number;
  recorded: number;
  notRecorded: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  halfDay: number;
  onLeave: number;
  holiday: number;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface AttendanceEntry {
  status: AttendanceStatus | "";
  remarks: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
  HALF_DAY: "Half Day",
  ON_LEAVE: "On Leave",
  HOLIDAY: "Holiday",
};

const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800",
  late: "bg-yellow-100 text-yellow-800",
  onLeave: "bg-blue-100 text-blue-800",
  notRecorded: "bg-gray-100 text-gray-800",
};

// ─── Component ──────────────────────────────────────────────────────

export function AttendanceClient({
  initialStaff,
  initialRecords,
  initialOverview,
  initialDate,
  departments,
}: {
  initialStaff: StaffMember[];
  initialRecords: AttendanceRecord[];
  initialOverview: Overview;
  initialDate: string;
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [overview, setOverview] = useState<Overview>(initialOverview);
  const [departmentFilter, setDepartmentFilter] = useState("");

  // Build attendance map from initial records keyed by staffId
  const buildEntryMap = (
    staffList: StaffMember[],
    records: AttendanceRecord[]
  ): Record<string, AttendanceEntry> => {
    const map: Record<string, AttendanceEntry> = {};
    for (const s of staffList) {
      map[s.id] = { status: "", remarks: "" };
    }
    for (const r of records) {
      if (map[r.staffId] !== undefined) {
        map[r.staffId] = {
          status: r.status as AttendanceStatus,
          remarks: r.remarks ?? "",
        };
      }
    }
    return map;
  };

  const [entries, setEntries] = useState<Record<string, AttendanceEntry>>(() =>
    buildEntryMap(initialStaff, initialRecords)
  );

  // Filtered staff based on department
  const filteredStaff = useMemo(() => {
    if (!departmentFilter) return initialStaff;
    return initialStaff.filter((s) => s.departmentName === departmentFilter);
  }, [initialStaff, departmentFilter]);

  // ─── Date Navigation ──────────────────────────────────────────

  const navigateToDate = (newDate: string) => {
    setSelectedDate(newDate);
    startTransition(async () => {
      const [attendanceResult, overviewResult] = await Promise.all([
        getStaffAttendanceAction({
          dateFrom: newDate,
          dateTo: newDate,
          pageSize: 500,
        }),
        getDailyAttendanceOverviewAction(newDate),
      ]);

      const records = ("data" in attendanceResult && attendanceResult.data ? attendanceResult.data : []).map((r: { id: string; staffId: string; status: string; remarks: string | null }) => ({
        id: r.id,
        staffId: r.staffId,
        status: r.status,
        remarks: r.remarks,
      }));

      setEntries(buildEntryMap(initialStaff, records));
      setOverview(
        ("data" in overviewResult && overviewResult.data) ? overviewResult.data : {
          date: newDate,
          totalActive: 0,
          recorded: 0,
          notRecorded: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          halfDay: 0,
          onLeave: 0,
          holiday: 0,
        }
      );
    });
  };

  // ─── Entry Updates ────────────────────────────────────────────

  const updateStatus = (staffId: string, status: AttendanceStatus | "") => {
    setEntries((prev) => ({
      ...prev,
      [staffId]: { ...prev[staffId], status },
    }));
  };

  const updateRemarks = (staffId: string, remarks: string) => {
    setEntries((prev) => ({
      ...prev,
      [staffId]: { ...prev[staffId], remarks },
    }));
  };

  // ─── Mark All ─────────────────────────────────────────────────

  const markAllAs = (status: AttendanceStatus) => {
    setEntries((prev) => {
      const next = { ...prev };
      for (const s of filteredStaff) {
        next[s.id] = { ...next[s.id], status };
      }
      return next;
    });
  };

  // ─── Save ─────────────────────────────────────────────────────

  const handleSave = () => {
    const records = Object.entries(entries)
      .filter(([, entry]) => entry.status !== "")
      .map(([staffId, entry]) => ({
        staffId,
        status: entry.status as AttendanceStatus,
        remarks: entry.remarks || undefined,
      }));

    if (records.length === 0) {
      toast.error("No attendance records to save. Please set at least one status.");
      return;
    }

    startTransition(async () => {
      const result = await bulkRecordStaffAttendanceAction({
        date: selectedDate,
        records,
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      const saved = "saved" in result ? result.saved : 0;
      const errs = "errors" in result && result.errors ? result.errors : [];
      toast.success(
        `Attendance saved for ${saved} staff member${saved !== 1 ? "s" : ""}.` +
          (errs.length > 0 ? ` ${errs.length} error(s) occurred.` : "")
      );

      // Refresh overview
      const overviewResult = await getDailyAttendanceOverviewAction(selectedDate);
      if ("data" in overviewResult && overviewResult.data) {
        setOverview(overviewResult.data);
      }
      router.refresh();
    });
  };

  // ─── Summary Cards ────────────────────────────────────────────

  const summaryCards = [
    { label: "Present", value: overview.present, color: STATUS_COLORS.present },
    { label: "Absent", value: overview.absent, color: STATUS_COLORS.absent },
    { label: "Late", value: overview.late, color: STATUS_COLORS.late },
    { label: "On Leave", value: overview.onLeave, color: STATUS_COLORS.onLeave },
    {
      label: "Not Recorded",
      value: overview.notRecorded,
      color: STATUS_COLORS.notRecorded,
    },
  ];

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Date Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateToDate(shiftDate(selectedDate, -1))}
            disabled={isPending}
            className="rounded-md border border-gray-300 p-2 hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) navigateToDate(e.target.value);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              {formatDate(selectedDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateToDate(shiftDate(selectedDate, 1))}
            disabled={isPending}
            className="rounded-md border border-gray-300 p-2 hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Quick Mark All */}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                markAllAs(e.target.value as AttendanceStatus);
              }
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Mark All As...</option>
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-lg p-4 ${card.color}`}
          >
            <p className="text-sm font-medium">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Attendance Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Staff ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Department
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Remarks
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredStaff.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No active staff found.
                </td>
              </tr>
            ) : (
              filteredStaff.map((staff, index) => {
                const entry = entries[staff.id] ?? { status: "", remarks: "" };
                return (
                  <tr
                    key={staff.id}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {index + 1}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-600">
                      {staff.staffId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {staff.firstName} {staff.lastName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {staff.departmentName ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <select
                        value={entry.status}
                        onChange={(e) =>
                          updateStatus(
                            staff.id,
                            e.target.value as AttendanceStatus | ""
                          )
                        }
                        className={`rounded-md border px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          entry.status === ""
                            ? "border-gray-300 text-gray-400"
                            : "border-gray-300 text-gray-900"
                        }`}
                      >
                        <option value="">-- Select --</option>
                        {ATTENDANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={entry.remarks}
                        onChange={(e) =>
                          updateRemarks(staff.id, e.target.value)
                        }
                        placeholder="Optional remarks"
                        className="w-full min-w-[150px] rounded-md border border-gray-300 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {filteredStaff.length} of {initialStaff.length} active staff
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Attendance
        </button>
      </div>
    </div>
  );
}
