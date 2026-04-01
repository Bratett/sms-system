"use client";

import { useState, useTransition } from "react";
import { getMyAttendanceAction } from "@/modules/hr/actions/self-service.action";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData: any;
  initialMonth: number;
  initialYear: number;
}

const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700",
  ABSENT: "bg-red-100 text-red-700",
  LATE: "bg-yellow-100 text-yellow-700",
  EXCUSED: "bg-blue-100 text-blue-700",
  HALF_DAY: "bg-orange-100 text-orange-700",
  ON_LEAVE: "bg-purple-100 text-purple-700",
  HOLIDAY: "bg-gray-100 text-gray-600",
};

export function StaffAttendanceClient({ initialData, initialMonth, initialYear }: Props) {
  const [isPending, startTransition] = useTransition();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(initialData);

  function loadMonth() {
    startTransition(async () => {
      const res = await getMyAttendanceAction(month, year);
      if ("data" in res) setData(res.data);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">My Attendance</h2>
        <div className="flex items-center gap-3">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-md border px-3 py-2 text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2024, i).toLocaleString("default", { month: "long" })}
              </option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border px-3 py-2 text-sm">
            {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={loadMonth} disabled={isPending}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
            {isPending ? "Loading..." : "Go"}
          </button>
        </div>
      </div>

      {/* Summary */}
      {data?.summary && (
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(data.summary as Record<string, number>).map(([status, count]) => (
            <div key={status} className="rounded-lg border bg-white p-3 text-center">
              <div className="text-xl font-bold">{count}</div>
              <div className="text-xs text-gray-500">{status.replace("_", " ")}</div>
            </div>
          ))}
        </div>
      )}

      {/* Records Table */}
      {data?.records && (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Clock In</th>
                <th className="px-4 py-3 text-left font-medium">Clock Out</th>
                <th className="px-4 py-3 text-left font-medium">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {data.records.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No records for this month.</td></tr>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data.records.map((r: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3">{new Date(r.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-700"}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.clockIn ? new Date(r.clockIn).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "---"}</td>
                    <td className="px-4 py-3 text-gray-500">{r.clockOut ? new Date(r.clockOut).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "---"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.remarks || "---"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
