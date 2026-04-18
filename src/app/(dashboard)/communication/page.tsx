import Link from "next/link";
import { auth } from "@/lib/auth";
import { ModuleOverview } from "@/components/layout/module-overview";
import { getAnnouncementsAction } from "@/modules/communication/actions/announcement.action";
import { getSmsLogsAction } from "@/modules/communication/actions/sms.action";
import { getPTCSessionsAction } from "@/modules/communication/actions/ptc.action";

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-muted text-muted-foreground",
};

export default async function CommunicationPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [annRes, smsRes, ptcRes] = await Promise.all([
    getAnnouncementsAction({ page: 1, pageSize: 5 }),
    getSmsLogsAction({ status: "SENT", page: 1, pageSize: 1 }),
    getPTCSessionsAction(),
  ]);

  const announcements =
    annRes && "data" in annRes && Array.isArray(annRes.data)
      ? (annRes.data as Array<{
          id: string;
          title: string;
          priority: string;
          status: string;
          publishedAt: Date | string | null;
          createdAt: Date | string;
        }>)
      : [];
  const totalAnnouncements =
    annRes && "pagination" in annRes && annRes.pagination
      ? (annRes.pagination as { total: number }).total
      : announcements.length;

  const smsSent =
    smsRes && "pagination" in smsRes && smsRes.pagination
      ? (smsRes.pagination as { total: number }).total
      : 0;

  const ptcSessions =
    ptcRes && "data" in ptcRes && Array.isArray(ptcRes.data)
      ? (ptcRes.data as Array<{ date: Date | string }>)
      : [];
  const now = Date.now();
  const upcomingPtc = ptcSessions.filter((s) => new Date(s.date).getTime() >= now).length;

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const announcementsThisMonth = announcements.filter((a) => {
    const pub = a.publishedAt ? new Date(a.publishedAt) : new Date(a.createdAt);
    return pub >= thisMonth;
  }).length;

  return (
    <ModuleOverview
      title="Communication"
      description="Announcements, SMS, and parent-teacher conferences."
      kpis={[
        { label: "This Month", value: announcementsThisMonth, hint: "Recent announcements" },
        { label: "SMS Sent", value: smsSent.toLocaleString() },
        { label: "Upcoming PTCs", value: upcomingPtc },
        { label: "Total Announcements", value: totalAnnouncements },
      ]}
      quickActions={[
        { href: "/communication/announcements", label: "New Announcement", icon: "Megaphone" },
        { href: "/communication/sms", label: "Send SMS", icon: "MessageSquare" },
        { href: "/communication/ptc", label: "Schedule PTC", icon: "CalendarDays" },
      ]}
    >
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent announcements
          </p>
          {announcements.length > 0 && (
            <Link
              href="/communication/announcements"
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card">
          {announcements.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No announcements yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {announcements.map((a) => {
                const published = a.publishedAt
                  ? new Date(a.publishedAt)
                  : new Date(a.createdAt);
                return (
                  <li key={a.id}>
                    <Link
                      href="/communication/announcements"
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.status} • {published.toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          PRIORITY_STYLES[a.priority] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {a.priority}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </ModuleOverview>
  );
}
