import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { getStaffStatsAction } from "@/modules/hr/actions/staff.action";

export default async function HRPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const statsResult = await getStaffStatsAction();
  const stats = statsResult.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Human Resources"
        description="Manage staff, leave, and payroll."
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">Total Staff</p>
            <p className="mt-1 text-3xl font-bold">{stats.active}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.total} total ({stats.terminated + stats.retired} inactive)
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">Teaching Staff</p>
            <p className="mt-1 text-3xl font-bold">{stats.teaching}</p>
            <p className="mt-1 text-xs text-muted-foreground">Active teaching staff</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">Non-Teaching Staff</p>
            <p className="mt-1 text-3xl font-bold">{stats.nonTeaching}</p>
            <p className="mt-1 text-xs text-muted-foreground">Active non-teaching staff</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">Pending Leave Requests</p>
            <p className="mt-1 text-3xl font-bold">{stats.pendingLeaveRequests}</p>
            <p className="mt-1 text-xs text-muted-foreground">Awaiting review</p>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/hr/staff"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Staff Directory</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage all staff members, employment records, and qualifications.
          </p>
        </Link>
        <Link
          href="/hr/leave"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Leave Management</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure leave types, review and approve leave requests.
          </p>
        </Link>
        <Link
          href="/hr/payroll"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Payroll</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage allowances, deductions, and generate monthly payroll.
          </p>
        </Link>
        <Link
          href="/hr/staff/new"
          className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Register Staff</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a new staff member with personal and employment details.
          </p>
        </Link>
      </div>
    </div>
  );
}
