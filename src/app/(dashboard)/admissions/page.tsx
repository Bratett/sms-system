import Link from "next/link";
import { auth } from "@/lib/auth";
import { ModuleOverview } from "@/components/layout/module-overview";
import {
  getAdmissionStatsAction,
  getApplicationsAction,
} from "@/modules/admissions/actions/admission.action";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  SHORTLISTED: "bg-purple-100 text-purple-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  ENROLLED: "bg-primary/15 text-primary",
};

export default async function AdmissionsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [statsRes, appsRes] = await Promise.all([
    getAdmissionStatsAction(),
    getApplicationsAction({ page: 1, pageSize: 5 }),
  ]);

  const stats =
    statsRes && "data" in statsRes && statsRes.data
      ? statsRes.data
      : {
          total: 0,
          submitted: 0,
          underReview: 0,
          shortlisted: 0,
          accepted: 0,
          rejected: 0,
          enrolled: 0,
          draft: 0,
          paymentPending: 0,
          documentsPending: 0,
          interviewScheduled: 0,
          awaitingDecision: 0,
          conditionalAccept: 0,
          waitlisted: 0,
          offerExpired: 0,
          withdrawn: 0,
          placementTotal: 0,
          placementVerified: 0,
          placementUnverified: 0,
          appealsPending: 0,
        };

  // Funnel + placement + appeals summary lines surfaced below recent apps.
  const funnel = [
    { label: "Draft", value: stats.draft },
    { label: "Submitted", value: stats.submitted },
    { label: "Under review", value: stats.underReview },
    { label: "Interview scheduled", value: stats.interviewScheduled },
    { label: "Awaiting decision", value: stats.awaitingDecision },
    { label: "Accepted", value: stats.accepted },
    { label: "Conditional", value: stats.conditionalAccept },
    { label: "Waitlisted", value: stats.waitlisted },
    { label: "Rejected", value: stats.rejected },
    { label: "Enrolled", value: stats.enrolled },
  ];

  const applications =
    appsRes && "data" in appsRes && appsRes.data
      ? (appsRes.data as {
          applications: Array<{
            id: string;
            applicationNumber: string | null;
            firstName: string;
            lastName: string;
            status: string;
            createdAt: Date | string;
          }>;
        }).applications
      : [];

  return (
    <ModuleOverview
      title="Admissions"
      description="Applications, placement, and admission workflow."
      kpis={[
        { label: "Total Applications", value: stats.total },
        { label: "Under Review", value: stats.submitted + stats.underReview },
        { label: "Accepted", value: stats.accepted },
        { label: "Enrolled", value: stats.enrolled },
      ]}
      quickActions={[
        { href: "/admissions/applications", label: "Applications", icon: "FileText" },
        { href: "/admissions/placement", label: "Placement", icon: "ClipboardList" },
        { href: "/admissions/appeals", label: "Appeals", icon: "AlertCircle" },
      ]}
    >
      {/* Funnel strip */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Application funnel
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {funnel.map((f) => (
            <div
              key={f.label}
              className="rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="text-xs text-muted-foreground">{f.label}</div>
              <div className="text-lg font-semibold">{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Placement + appeals callouts */}
      {(stats.placementTotal > 0 || stats.appealsPending > 0) && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/admissions/placement"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100"
          >
            <div className="text-xs uppercase tracking-wider text-amber-700">
              Placement students
            </div>
            <div className="mt-1 text-2xl font-semibold text-amber-900">
              {stats.placementTotal}
            </div>
            <div className="text-xs text-amber-700">
              {stats.placementUnverified} awaiting verification
            </div>
          </Link>
          <Link
            href="/admissions/appeals"
            className="rounded-lg border border-rose-200 bg-rose-50 p-4 hover:bg-rose-100"
          >
            <div className="text-xs uppercase tracking-wider text-rose-700">
              Pending appeals
            </div>
            <div className="mt-1 text-2xl font-semibold text-rose-900">
              {stats.appealsPending}
            </div>
          </Link>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Offers expired
            </div>
            <div className="mt-1 text-2xl font-semibold">{stats.offerExpired}</div>
            <div className="text-xs text-muted-foreground">
              {stats.withdrawn} withdrawn
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent applications
          </p>
          {applications.length > 0 && (
            <Link href="/admissions/applications" className="text-xs text-primary hover:underline">
              View all
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card">
          {applications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No applications yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {applications.map((app) => (
                <li key={app.id}>
                  <Link
                    href={`/admissions/applications/${app.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {app.firstName} {app.lastName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {app.applicationNumber ?? "—"} • {new Date(app.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        STATUS_STYLES[app.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {app.status.replace(/_/g, " ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModuleOverview>
  );
}
