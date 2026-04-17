import { PageHeader } from "@/components/layout/page-header";
import { getDashboardStatsAction } from "@/modules/school/actions/dashboard.action";
import { FeeCollectionChart, StudentBreakdownChart } from "@/components/shared/dashboard-charts";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  Users,
  Briefcase,
  DollarSign,
  ClipboardCheck,
  UserPlus,
  Calendar,
  CreditCard,
  BookOpen,
  FileText,
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  Send,
  ArrowUpRight,
  GraduationCap,
} from "lucide-react";

export default async function DashboardPage() {
  const result = await getDashboardStatsAction();

  if ("error" in result) {
    const isSchoolContext = result.error.toLowerCase().includes("school context");
    return (
      <div className="space-y-4">
        <PageHeader
          title="Dashboard"
          description="We couldn't load this page's statistics."
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold">Dashboard unavailable</p>
          <p className="mt-1">{result.error}</p>
          {isSchoolContext ? (
            <p className="mt-3 text-xs text-amber-800">
              Your session doesn&apos;t have an active school bound to it. Sign out and sign
              back in so your new school assignment flows into the session token.
            </p>
          ) : (
            <p className="mt-3 text-xs text-amber-800">
              If this persists, ask an administrator to confirm your account has the
              <code> school:settings:read</code> permission.
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Link
              href="/login"
              className="rounded border border-amber-400 px-3 py-1 text-xs hover:bg-amber-100"
            >
              Sign in again
            </Link>
            <Link
              href="/admin/school"
              className="rounded border border-amber-400 px-3 py-1 text-xs hover:bg-amber-100"
            >
              Open school settings
            </Link>
          </div>
        </div>
      </div>
    );
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
        <StatCard
          href="/students"
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-600"
          value={String(stats.students.active)}
          label="Active Students"
          secondary={`${stats.students.male}M / ${stats.students.female}F`}
        />
        <StatCard
          href="/hr/staff"
          icon={<Briefcase className="h-5 w-5" />}
          iconBg="bg-purple-50 text-purple-600"
          value={String(stats.staff.total)}
          label="Staff"
          secondary={`${stats.staff.teaching} teaching`}
        />
        <StatCard
          href="/finance/payments"
          icon={<DollarSign className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-600"
          value={stats.finance.collectionRate > 0 ? `${stats.finance.collectionRate}%` : "--"}
          label="Fee Collection"
          secondary={
            Number(stats.finance.totalCollected) > 0
              ? `GHS ${formatCurrency(stats.finance.totalCollected)} collected`
              : "No bills this term"
          }
        />
        <StatCard
          href="/attendance"
          icon={<ClipboardCheck className="h-5 w-5" />}
          iconBg="bg-orange-50 text-orange-600"
          value={stats.attendance.todayRate !== null ? `${stats.attendance.todayRate}%` : "--"}
          label="Attendance Today"
          secondary={
            stats.attendance.registersToday > 0
              ? `${stats.attendance.registersToday} register${stats.attendance.registersToday !== 1 ? "s" : ""} taken`
              : "No registers today"
          }
        />
        <StatCard
          href="/admissions/applications"
          icon={<UserPlus className="h-5 w-5" />}
          iconBg="bg-cyan-50 text-cyan-600"
          value={String(stats.admissions.pending)}
          label="Pending Admissions"
          secondary="Awaiting review"
        />
        <StatCard
          href="/hr/leave"
          icon={<Calendar className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-600"
          value={String(stats.hr.pendingLeave)}
          label="Pending Leave"
          secondary="Requests to review"
        />
      </div>

      {/* ── Row 3: Quick Actions + Recent Activity ─────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold">Quick Actions</h3>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <QuickAction
              href="/students/new"
              label="Register Student"
              icon={<UserPlus className="h-5 w-5" />}
              color="bg-blue-50 text-blue-600"
            />
            <QuickAction
              href="/finance/payments"
              label="Record Payment"
              icon={<CreditCard className="h-5 w-5" />}
              color="bg-emerald-50 text-emerald-600"
            />
            <QuickAction
              href="/attendance/take"
              label="Take Attendance"
              icon={<ClipboardCheck className="h-5 w-5" />}
              color="bg-orange-50 text-orange-600"
            />
            <QuickAction
              href="/academics/assessments/mark-entry"
              label="Enter Marks"
              icon={<BookOpen className="h-5 w-5" />}
              color="bg-purple-50 text-purple-600"
            />
            <QuickAction
              href="/admissions/applications/new"
              label="New Application"
              icon={<FileText className="h-5 w-5" />}
              color="bg-cyan-50 text-cyan-600"
            />
            <QuickAction
              href="/hr/staff/new"
              label="Add Staff"
              icon={<Briefcase className="h-5 w-5" />}
              color="bg-pink-50 text-pink-600"
            />
            <QuickAction
              href="/academics/results"
              label="View Results"
              icon={<GraduationCap className="h-5 w-5" />}
              color="bg-indigo-50 text-indigo-600"
            />
            <QuickAction
              href="/communication/sms"
              label="Send SMS"
              icon={<MessageSquare className="h-5 w-5" />}
              color="bg-teal-50 text-teal-600"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Recent Activity</h3>
            <Link
              href="/admin/audit-log"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="mt-4 space-y-1">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    <ActivityIcon action={activity.action} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{activity.description}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{activity.user}</span>
                      <span className="text-border">&middot;</span>
                      <span>{formatRelative(activity.timestamp)}</span>
                      <span className="text-border">&middot;</span>
                      <ModuleBadge module={activity.module} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Charts + Stats ─────────────────────────── */}
      {(stats.students.active > 0 || Number(stats.finance.totalBilled) > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Fee Collection with Chart */}
          {Number(stats.finance.totalBilled) > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold">Fee Collection — Current Term</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total Billed</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">
                    GHS {formatCurrency(stats.finance.totalBilled)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Collected</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-emerald-600">
                    GHS {formatCurrency(stats.finance.totalCollected)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-red-600">
                    GHS {formatCurrency(stats.finance.outstanding)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <FeeCollectionChart
                  collected={Number(stats.finance.totalCollected)}
                  outstanding={Number(stats.finance.outstanding)}
                />
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Collection Progress</span>
                  <span className="font-medium tabular-nums">{stats.finance.collectionRate}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(stats.finance.collectionRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Student Breakdown with Chart */}
          {stats.students.active > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold">Student Breakdown</h3>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Boarding" value={stats.students.boarding} />
                <MiniStat label="Day" value={stats.students.day} />
                <MiniStat label="Classes" value={stats.academic.totalClasses} />
                <MiniStat label="Subjects" value={stats.academic.totalSubjects} />
              </div>
              <div className="mt-4">
                <StudentBreakdownChart
                  male={stats.students.male}
                  female={stats.students.female}
                  boarding={stats.students.boarding}
                  day={stats.students.day}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Setup Guide (only if no academic year) ─────────── */}
      {!currentYear && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-base font-semibold text-amber-900">Getting Started</h3>
          <p className="mt-2 text-sm text-amber-800">
            Your school is set up. Complete these steps to get started:
          </p>
          <ol className="mt-3 list-inside list-decimal space-y-1.5 text-sm text-amber-800">
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
  href,
  icon,
  iconBg,
  value,
  label,
  secondary,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
  secondary: string;
}) {
  return (
    <Link
      href={href}
      className="group cursor-pointer rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/20 hover:shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{secondary}</p>
    </Link>
  );
}

function QuickAction({
  href,
  label,
  icon,
  color,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border border-border px-3 py-4 text-center text-sm font-medium transition-all hover:border-primary/20 hover:shadow-sm"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>{icon}</span>
      <span className="leading-tight">{label}</span>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

const activityIconMap: Record<string, { icon: React.ReactNode; bg: string }> = {
  CREATE: { icon: <Plus className="h-3.5 w-3.5" />, bg: "bg-emerald-100 text-emerald-600" },
  UPDATE: { icon: <Pencil className="h-3.5 w-3.5" />, bg: "bg-blue-100 text-blue-600" },
  DELETE: { icon: <Trash2 className="h-3.5 w-3.5" />, bg: "bg-red-100 text-red-600" },
  LOGIN: { icon: <LogIn className="h-3.5 w-3.5" />, bg: "bg-purple-100 text-purple-600" },
  LOGOUT: { icon: <LogOut className="h-3.5 w-3.5" />, bg: "bg-gray-100 text-gray-500" },
  APPROVE: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    bg: "bg-emerald-100 text-emerald-600",
  },
  REJECT: { icon: <XCircle className="h-3.5 w-3.5" />, bg: "bg-red-100 text-red-500" },
  EXPORT: { icon: <Download className="h-3.5 w-3.5" />, bg: "bg-orange-100 text-orange-600" },
  IMPORT: { icon: <Upload className="h-3.5 w-3.5" />, bg: "bg-cyan-100 text-cyan-600" },
  PUBLISH: { icon: <Send className="h-3.5 w-3.5" />, bg: "bg-indigo-100 text-indigo-600" },
};

function ActivityIcon({ action }: { action: string }) {
  const config = activityIconMap[action] || {
    icon: <Pencil className="h-3.5 w-3.5" />,
    bg: "bg-muted text-muted-foreground",
  };
  return (
    <div className={`flex h-7 w-7 items-center justify-center rounded-full ${config.bg}`}>
      {config.icon}
    </div>
  );
}

function ModuleBadge({ module }: { module: string }) {
  return (
    <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">
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

function formatCurrency(amount: number | unknown): string {
  return Number(amount).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
