import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getMaintenanceRequestsAction,
  getMaintenanceStatsAction,
} from "@/modules/boarding/actions/maintenance.action";
import { MaintenanceClient } from "./maintenance-client";
import Link from "next/link";

export default async function MaintenancePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [requestsResult, statsResult] = await Promise.all([
    getMaintenanceRequestsAction({ page: 1, pageSize: 20 }),
    getMaintenanceStatsAction(),
  ]);

  const requests = requestsResult.data ?? [];
  const pagination = requestsResult.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 };
  const stats = statsResult.data ?? {
    open: 0,
    assigned: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    byCategory: {
      plumbing: 0,
      electrical: 0,
      furniture: 0,
      structural: 0,
      cleaning: 0,
      pestControl: 0,
      security: 0,
      other: 0,
    },
    byPriority: {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Requests"
        description="Submit, track, and manage hostel maintenance requests."
        actions={
          <Link
            href="/boarding/maintenance/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Submit Request
          </Link>
        }
      />
      <MaintenanceClient
        requests={requests}
        pagination={pagination}
        stats={stats}
      />
    </div>
  );
}
