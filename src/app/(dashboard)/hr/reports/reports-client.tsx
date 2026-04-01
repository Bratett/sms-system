"use client";

import { useState, useTransition } from "react";
import {
  getStaffTurnoverReportAction,
  getLeaveUtilizationReportAction,
  getPayrollSummaryReportAction,
  getStaffDemographicsReportAction,
  getAttendanceTrendReportAction,
} from "@/modules/hr/actions/reports.action";

const TABS = ["Demographics", "Turnover", "Leave Utilization", "Payroll Summary", "Attendance Trend"] as const;

type Tab = (typeof TABS)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReportsClient({ initialDemographics }: { initialDemographics: any }) {
  const [tab, setTab] = useState<Tab>("Demographics");
  const [isPending, startTransition] = useTransition();

  // Demographics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [demographics, setDemographics] = useState<any>(initialDemographics);

  // Turnover
  const [turnoverFrom, setTurnoverFrom] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  });
  const [turnoverTo, setTurnoverTo] = useState(() => new Date().toISOString().split("T")[0]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [turnover, setTurnover] = useState<any>(null);

  // Leave
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [leaveData, setLeaveData] = useState<any>(null);

  // Payroll
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [payrollData, setPayrollData] = useState<any>(null);

  // Attendance
  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(new Date().getFullYear());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [attendanceData, setAttendanceData] = useState<any>(null);

  function loadTurnover() {
    startTransition(async () => {
      const res = await getStaffTurnoverReportAction(turnoverFrom, turnoverTo);
      if ("data" in res) setTurnover(res.data);
    });
  }

  function loadLeave() {
    startTransition(async () => {
      const res = await getLeaveUtilizationReportAction();
      if ("data" in res) setLeaveData(res.data);
    });
  }

  function loadPayroll() {
    startTransition(async () => {
      const res = await getPayrollSummaryReportAction(payrollYear);
      if ("data" in res) setPayrollData(res.data);
    });
  }

  function loadAttendance() {
    startTransition(async () => {
      const res = await getAttendanceTrendReportAction(attMonth, attYear);
      if ("data" in res) setAttendanceData(res.data);
    });
  }

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isPending && (
        <div className="text-sm text-muted-foreground">Loading report...</div>
      )}

      {/* Demographics Tab */}
      {tab === "Demographics" && demographics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Active Staff" value={demographics.totalActive} />
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Gender Distribution</h4>
              {Object.entries(demographics.gender as Record<string, number>).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-1">
                  <span>{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Staff Type</h4>
              {Object.entries(demographics.staffType as Record<string, number>).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-1">
                  <span>{k.replace("_", " ")}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Age Distribution</h4>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {Object.entries(demographics.ageDistribution as Record<string, number>).map(([band, count]) => (
                <div key={band} className="text-center p-3 rounded-md bg-muted/50">
                  <div className="text-lg font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">{band}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Turnover Tab */}
      {tab === "Turnover" && (
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div>
              <label className="text-sm font-medium">From</label>
              <input type="date" value={turnoverFrom} onChange={(e) => setTurnoverFrom(e.target.value)}
                className="block mt-1 rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">To</label>
              <input type="date" value={turnoverTo} onChange={(e) => setTurnoverTo(e.target.value)}
                className="block mt-1 rounded-md border px-3 py-2 text-sm" />
            </div>
            <button onClick={loadTurnover} disabled={isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              Generate
            </button>
          </div>
          {turnover && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="New Hires" value={turnover.newHires} />
                <StatCard label="Terminations" value={turnover.terminations} />
                <StatCard label="Retirements" value={turnover.retirements} />
                <StatCard label="Transfers" value={turnover.transfers} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Total Exits" value={turnover.totalExits} />
                <StatCard label="Current Active" value={turnover.totalActive} />
                <StatCard label="Turnover Rate" value={turnover.turnoverRate} accent />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leave Utilization Tab */}
      {tab === "Leave Utilization" && (
        <div className="space-y-4">
          <button onClick={loadLeave} disabled={isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            {leaveData ? "Refresh" : "Load Report"}
          </button>
          {leaveData && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-4 py-3 font-medium">Leave Type</th>
                    <th className="px-4 py-3 font-medium text-right">Staff Count</th>
                    <th className="px-4 py-3 font-medium text-right">Total Allocated</th>
                    <th className="px-4 py-3 font-medium text-right">Total Used</th>
                    <th className="px-4 py-3 font-medium text-right">Remaining</th>
                    <th className="px-4 py-3 font-medium text-right">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {leaveData.map((row: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3">{row.leaveType}</td>
                      <td className="px-4 py-3 text-right">{row.staffCount}</td>
                      <td className="px-4 py-3 text-right">{row.totalAllocated}</td>
                      <td className="px-4 py-3 text-right">{row.totalUsed}</td>
                      <td className="px-4 py-3 text-right">{row.totalRemaining}</td>
                      <td className="px-4 py-3 text-right font-medium">{row.utilizationRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payroll Summary Tab */}
      {tab === "Payroll Summary" && (
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div>
              <label className="text-sm font-medium">Year</label>
              <select value={payrollYear} onChange={(e) => setPayrollYear(Number(e.target.value))}
                className="block mt-1 rounded-md border px-3 py-2 text-sm">
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button onClick={loadPayroll} disabled={isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              Generate
            </button>
          </div>
          {payrollData && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-4 py-3 font-medium">Month</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Staff</th>
                      <th className="px-4 py-3 font-medium text-right">Basic</th>
                      <th className="px-4 py-3 font-medium text-right">Allowances</th>
                      <th className="px-4 py-3 font-medium text-right">Deductions</th>
                      <th className="px-4 py-3 font-medium text-right">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {payrollData.monthly.map((m: any) => (
                      <tr key={m.month} className="border-b">
                        <td className="px-4 py-3">{new Date(payrollData.year, m.month - 1).toLocaleString("default", { month: "long" })}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            m.status === "APPROVED" ? "bg-green-100 text-green-700" :
                            m.status === "PAID" ? "bg-blue-100 text-blue-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>{m.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right">{m.staffCount}</td>
                        <td className="px-4 py-3 text-right">{m.totalBasic.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{m.totalAllowances.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{m.totalDeductions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium">{m.totalNet.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="px-4 py-3" colSpan={3}>Grand Total</td>
                      <td className="px-4 py-3 text-right">{payrollData.grandTotal.totalBasic.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{payrollData.grandTotal.totalAllowances.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{payrollData.grandTotal.totalDeductions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{payrollData.grandTotal.totalNet.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attendance Trend Tab */}
      {tab === "Attendance Trend" && (
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div>
              <label className="text-sm font-medium">Month</label>
              <select value={attMonth} onChange={(e) => setAttMonth(Number(e.target.value))}
                className="block mt-1 rounded-md border px-3 py-2 text-sm">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Year</label>
              <select value={attYear} onChange={(e) => setAttYear(Number(e.target.value))}
                className="block mt-1 rounded-md border px-3 py-2 text-sm">
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button onClick={loadAttendance} disabled={isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              Generate
            </button>
          </div>
          {attendanceData && attendanceData.daily.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium text-right">Present</th>
                    <th className="px-4 py-3 font-medium text-right">Absent</th>
                    <th className="px-4 py-3 font-medium text-right">Late</th>
                    <th className="px-4 py-3 font-medium text-right">On Leave</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {attendanceData.daily.map((d: any) => (
                    <tr key={d.date} className="border-b">
                      <td className="px-4 py-3">{new Date(d.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="px-4 py-3 text-right text-green-600">{d.present}</td>
                      <td className="px-4 py-3 text-right text-red-600">{d.absent}</td>
                      <td className="px-4 py-3 text-right text-yellow-600">{d.late}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{d.onLeave}</td>
                      <td className="px-4 py-3 text-right font-medium">{d.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {attendanceData && attendanceData.daily.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No attendance records for this period.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
