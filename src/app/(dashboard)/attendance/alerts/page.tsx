import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAttendanceAlertsAction } from "@/modules/attendance/actions/attendance-policy.action";
import { AlertsClient } from "./alerts-client";
import Link from "next/link";

export default async function AttendanceAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;
  const result = await getAttendanceAlertsAction({
    status: params.status as "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | undefined,
    severity: params.severity as "INFO" | "WARNING" | "CRITICAL" | undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Alerts"
        description="Review and manage attendance policy alerts."
        actions={
          <Link
            href="/attendance/policies"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Manage Policies
          </Link>
        }
      />
      <AlertsClient
        alerts={result.data ?? []}
        pagination={result.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 }}
        filters={params}
      />
    </div>
  );
}
