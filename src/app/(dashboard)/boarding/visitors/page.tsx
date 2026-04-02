import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getVisitorsAction, getVisitorStatsAction } from "@/modules/boarding/actions/visitor.action";
import { VisitorsClient } from "./visitors-client";
import Link from "next/link";

export default async function VisitorsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [visitorsResult, statsResult] = await Promise.all([
    getVisitorsAction({ page: 1, pageSize: 20 }),
    getVisitorStatsAction(),
  ]);

  const visitors = visitorsResult.data ?? [];
  const pagination = visitorsResult.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 };
  const stats = statsResult.data ?? {
    activeVisitors: 0,
    todayTotal: 0,
    weekTotal: 0,
    byRelationship: {},
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boarding Visitors"
        description="Manage visitor check-ins and check-outs for boarding students."
        actions={
          <Link
            href="/boarding/visitors/check-in"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Check In Visitor
          </Link>
        }
      />
      <VisitorsClient
        visitors={visitors}
        pagination={pagination}
        stats={stats}
      />
    </div>
  );
}
