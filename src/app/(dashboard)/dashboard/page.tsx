import { PageHeader } from "@/components/layout/page-header";
import { getDashboardStatsAction } from "@/modules/school/actions/dashboard.action";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";

export default async function DashboardPage() {
  const result = await getDashboardStatsAction();

  if ("error" in result) {
    return <div>Error loading dashboard</div>;
  }

  const { school, currentYear, currentTerm, stats, recentActivity } = result;

  return (
    <div className="space-y-6">
      {/* ── Top Row: Welcome + Academic Period ──────────────── */}
      <PageHeader
        title={`Welcome to ${school?.name || "School Management System"}`}
        description={
          currentYear && currentTerm
            ? `${currentYear.name} — ${currentTerm.name} (${format(new Date(currentTerm.startDate), "dd MMM")} – ${format(new Date(currentTerm.endDate), "dd MMM yyyy")})`
            : currentYear
              ? `${currentYear.name} — No active term set`
              : "No academic year configured"
        }
      />

      {/* ── Row 2: Stat Cards ──────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Students */}
        <StatCard
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          }
          value={String(stats.students.active)}
          label="Active Students"
          secondary={`${stats.students.male}M / ${stats.students.female}F`}
          color="blue"
        />

        {/* Staff */}
        <StatCard
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          }
          value={String(stats.staff.total)}
          label="Staff"
          secondary={`${stats.staff.teaching} teaching`}
          color="purple"
        />

        {/* Fee Collection */}
        <StatCard
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          }
          value={stats.finance.collectionRate > 0 ? `${stats.finance.collectionRate}%` : "--"}
          label="Fee Collection"
          secondary={
            stats.finance.totalCollected > 0
              ? `GHS ${formatCurrency(stats.finance.totalCollected)} collected`
              : "No bills this term"
          }
          color="green"
        />

        {/* Attendance */}
        <StatCard
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          }
          value={stats.attendance.todayRate !== null ? `${stats.attendance.todayRate}%` : "--"}
          label="Attendance Today"
          secondary={
            stats.attendance.registersToday > 0
              ? `${stats.attendance.registersToday} register${stats.attendance.registersToday !== 1 ? "s" : ""} taken`
              : "No registers today"
          }
          color="orange"
        />

        {/* Pending Admissions */}
        <StatCard
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 text-cyan-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          }
          value={String(stats.admissions.pending)}
          label="Pending Admissions"
          secondary="Awaiting review"
          color="cyan"
        />

        {/* Pending Leave */}
        <StatCard
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          }
          value={String(stats.hr.pendingLeave)}
          label="Pending Leave"
          secondary="Requests to review"
          color="yellow"
        />
      </div>

      {/* ── Row 3: Quick Actions + Recent Activity ─────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold">Quick Actions</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <QuickAction
              href="/students/new"
              label="Register Student"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              }
            />
            <QuickAction
              href="/finance/payments"
              label="Record Payment"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
            <QuickAction
              href="/attendance/take"
              label="Take Attendance"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            />
            <QuickAction
              href="/academics/assessments/mark-entry"
              label="Enter Marks"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              }
            />
            <QuickAction
              href="/admissions/applications/new"
              label="New Application"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
            <QuickAction
              href="/hr/staff/new"
              label="Add Staff"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />
            <QuickAction
              href="/academics/results"
              label="View Results"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />
            <QuickAction
              href="/communication/sms"
              label="Send SMS"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              }
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="mt-4 space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-1.5 flex-shrink-0">
                    <ActivityIcon action={activity.action} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{activity.description}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{activity.user}</span>
                      <span>&middot;</span>
                      <span>{formatRelative(activity.timestamp)}</span>
                      <span>&middot;</span>
                      <ModuleBadge module={activity.module} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Student Breakdown (optional detail) ─────── */}
      {stats.students.active > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Boarding Students" value={stats.students.boarding} />
          <MiniStat label="Day Students" value={stats.students.day} />
          <MiniStat label="Classes This Year" value={stats.academic.totalClasses} />
          <MiniStat label="Active Subjects" value={stats.academic.totalSubjects} />
        </div>
      )}

      {/* ── Finance Detail Row ─────────────────────────────── */}
      {stats.finance.totalBilled > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Fee Collection Summary — Current Term</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Total Billed</p>
              <p className="mt-1 text-2xl font-bold">GHS {formatCurrency(stats.finance.totalBilled)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Collected</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                GHS {formatCurrency(stats.finance.totalCollected)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                GHS {formatCurrency(stats.finance.outstanding)}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Collection Progress</span>
              <span>{stats.finance.collectionRate}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${Math.min(stats.finance.collectionRate, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Setup Guide (only if no academic year) ─────────── */}
      {!currentYear && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900 dark:bg-yellow-950">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200">Getting Started</h3>
          <p className="mt-2 text-sm text-yellow-800 dark:text-yellow-300">
            Your school is set up. Complete these steps to get started:
          </p>
          <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-yellow-800 dark:text-yellow-300">
            <li>
              <Link href="/admin/academic-year" className="underline hover:no-underline">
                Create an Academic Year
              </Link>{" "}
              (e.g., 2025/2026)
            </li>
            <li>
              <Link href="/admin/terms" className="underline hover:no-underline">
                Add 3 Terms
              </Link>{" "}
              with start and end dates
            </li>
            <li>Set the current academic year and term</li>
            <li>
              <Link href="/admin/departments" className="underline hover:no-underline">
                Create Departments
              </Link>{" "}
              and{" "}
              <Link href="/admin/programmes" className="underline hover:no-underline">
                Programmes
              </Link>
            </li>
            <li>
              <Link href="/admin/houses" className="underline hover:no-underline">
                Set up Houses
              </Link>{" "}
              (for boarding schools)
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Helper Components ──────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
  secondary,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  secondary: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{secondary}</p>
    </div>
  );
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-lg border border-border px-3 py-4 text-center text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="leading-tight">{label}</span>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function ActivityIcon({ action }: { action: string }) {
  const colorMap: Record<string, string> = {
    CREATE: "bg-green-500",
    UPDATE: "bg-blue-500",
    DELETE: "bg-red-500",
    LOGIN: "bg-purple-500",
    LOGOUT: "bg-gray-400",
    APPROVE: "bg-emerald-500",
    REJECT: "bg-red-400",
    EXPORT: "bg-orange-500",
    IMPORT: "bg-cyan-500",
    PUBLISH: "bg-indigo-500",
  };
  const bg = colorMap[action] || "bg-primary";
  return <div className={`h-2 w-2 rounded-full ${bg}`} />;
}

function ModuleBadge({ module }: { module: string }) {
  return (
    <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">
      {module}
    </span>
  );
}

// ── Utility Functions ──────────────────────────────────────────

function formatRelative(date: Date | string): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "unknown";
  }
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
