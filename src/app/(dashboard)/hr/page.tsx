import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { getStaffStatsAction } from "@/modules/hr/actions/staff.action";
import { getExpiringContractsAction } from "@/modules/hr/actions/contract.action";

export default async function HRPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [statsResult, expiringResult] = await Promise.all([
    getStaffStatsAction(),
    getExpiringContractsAction(30),
  ]);
  const stats = "data" in statsResult ? statsResult.data : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expiringContracts: any[] = "data" in expiringResult && expiringResult.data ? expiringResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Human Resources"
        description="Manage staff, leave, payroll, attendance, contracts, and more."
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">Active Staff</p>
            <p className="mt-1 text-3xl font-bold">{stats.active}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.total} total ({stats.terminated + stats.retired} inactive)
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">Teaching</p>
            <p className="mt-1 text-3xl font-bold">{stats.teaching}</p>
            <p className="mt-1 text-xs text-muted-foreground">Active teaching staff</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">Non-Teaching</p>
            <p className="mt-1 text-3xl font-bold">{stats.nonTeaching}</p>
            <p className="mt-1 text-xs text-muted-foreground">Active non-teaching staff</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">Pending Leave</p>
            <p className="mt-1 text-3xl font-bold">{stats.pendingLeaveRequests}</p>
            <p className="mt-1 text-xs text-muted-foreground">Awaiting review</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">On Leave</p>
            <p className="mt-1 text-3xl font-bold">{stats.onLeave}</p>
            <p className="mt-1 text-xs text-muted-foreground">Currently on leave</p>
          </div>
        </div>
      )}

      {/* Alerts Section */}
      {expiringContracts.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 p-5">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            Contracts Expiring Soon ({expiringContracts.length})
          </h3>
          <div className="space-y-1">
            {expiringContracts.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-yellow-700 dark:text-yellow-300">
                  {c.staff.firstName} {c.staff.lastName} — {c.type.replace("_", " ")}
                </span>
                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                  Expires {new Date(c.endDate!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
            ))}
            {expiringContracts.length > 5 && (
              <Link href="/hr/contracts" className="text-xs text-yellow-700 dark:text-yellow-300 underline">
                View all {expiringContracts.length} expiring contracts
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Department Breakdown */}
      {stats && stats.byDepartment.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Staff by Department</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.byDepartment.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm">{dept.name}</span>
                <span className="text-sm font-semibold">{dept.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/hr/staff"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Staff Directory</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage all staff members.
          </p>
        </Link>
        <Link
          href="/hr/attendance"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Daily Attendance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Record and track daily staff attendance.
          </p>
        </Link>
        <Link
          href="/hr/leave"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Leave Management</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure leave types and approve requests.
          </p>
        </Link>
        <Link
          href="/hr/payroll"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Payroll</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage allowances, deductions, and payroll.
          </p>
        </Link>
        <Link
          href="/hr/contracts"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Contracts</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and renew staff contracts.
          </p>
        </Link>
        <Link
          href="/hr/loans"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Loans & Advances</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage staff loans and salary advances.
          </p>
        </Link>
        <Link
          href="/hr/reports"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">HR Reports</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Turnover, demographics, and payroll reports.
          </p>
        </Link>
        <Link
          href="/hr/staff/new"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Register Staff</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a new staff member.
          </p>
        </Link>
      </div>
    </div>
  );
}
