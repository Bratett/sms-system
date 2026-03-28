import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getAuditLogsAction,
  getAuditModulesAction,
  getAuditUsersAction,
} from "@/modules/auth/actions/audit.action";
import { AuditLogClient } from "./audit-log-client";

interface AuditLogPageProps {
  searchParams: Promise<{
    userId?: string;
    module?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const params = await searchParams;

  const filters = {
    userId: params.userId || undefined,
    module: params.module || undefined,
    action: (params.action as "CREATE" | "READ" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "EXPORT" | "IMPORT" | "APPROVE" | "REJECT" | "PUBLISH") || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    page: params.page ? parseInt(params.page, 10) : 1,
  };

  const [logsResult, modulesResult, usersResult] = await Promise.all([
    getAuditLogsAction(filters),
    getAuditModulesAction(),
    getAuditUsersAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="View a history of all actions performed in the system."
      />
      <AuditLogClient
        logs={logsResult.data ?? []}
        pagination={logsResult.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
        modules={modulesResult.data ?? []}
        users={usersResult.data ?? []}
        currentFilters={filters}
      />
    </div>
  );
}
