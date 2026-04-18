import Link from "next/link";
import { auth } from "@/lib/auth";
import { ModuleOverview } from "@/components/layout/module-overview";
import { getUsersAction } from "@/modules/auth/actions/user.action";
import { getRolesAction } from "@/modules/auth/actions/role.action";
import { getAuditLogsAction } from "@/modules/auth/actions/audit.action";

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [usersRes, rolesRes, auditRes] = await Promise.all([
    getUsersAction(),
    getRolesAction(),
    getAuditLogsAction({ dateFrom: startOfTodayISO(), pageSize: 5 }),
  ]);

  const users =
    usersRes && "data" in usersRes && Array.isArray(usersRes.data)
      ? (usersRes.data as Array<{ status: string }>)
      : [];
  const roles =
    rolesRes && "data" in rolesRes && Array.isArray(rolesRes.data)
      ? (rolesRes.data as Array<unknown>)
      : [];
  const auditLogs =
    auditRes && "data" in auditRes && Array.isArray(auditRes.data)
      ? (auditRes.data as Array<{
          id: string;
          timestamp: Date | string;
          action: string;
          module: string;
          description: string | null;
          userName: string;
        }>)
      : [];
  const auditTotal =
    auditRes && "pagination" in auditRes && auditRes.pagination
      ? (auditRes.pagination as { total: number }).total
      : 0;

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "ACTIVE").length;

  return (
    <ModuleOverview
      title="Administration"
      description="School settings, users, roles, academic structure, and audit log."
      kpis={[
        { label: "Total Users", value: totalUsers },
        { label: "Active Users", value: activeUsers },
        { label: "Roles Defined", value: roles.length },
        { label: "Events Today", value: auditTotal },
      ]}
      quickActions={[
        { href: "/admin/users", label: "Manage Users", icon: "Users" },
        { href: "/admin/roles", label: "Roles & Permissions", icon: "Shield" },
        { href: "/admin/school-settings", label: "School Settings", icon: "School" },
        { href: "/admin/audit-log", label: "Audit Log", icon: "FileText" },
      ]}
    >
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent activity
          </p>
          {auditLogs.length > 0 && (
            <Link href="/admin/audit-log" className="text-xs text-primary hover:underline">
              View audit log
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card">
          {auditLogs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No audit events today.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {auditLogs.map((log) => (
                <li key={log.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        <span className="text-muted-foreground">{log.module}</span>
                        {" · "}
                        {log.action}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {log.description ?? "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <p>{log.userName}</p>
                      <p>{new Date(log.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModuleOverview>
  );
}
