import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getExeatsAction, getExeatStatsAction } from "@/modules/boarding/actions/exeat.action";
import { ExeatClient } from "./exeat-client";
import Link from "next/link";

export default async function ExeatPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [exeatsResult, statsResult] = await Promise.all([
    getExeatsAction({ page: 1, pageSize: 20 }),
    getExeatStatsAction(),
  ]);

  const exeats = "data" in exeatsResult ? exeatsResult.data : [];
  const pagination = "pagination" in exeatsResult ? exeatsResult.pagination : { page: 1, pageSize: 20, total: 0, totalPages: 0 };
  const stats = "data" in statsResult ? statsResult.data : {
    total: 0,
    requested: 0,
    housemasterApproved: 0,
    headmasterApproved: 0,
    rejected: 0,
    departed: 0,
    returned: 0,
    overdue: 0,
    cancelled: 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exeat Management"
        description="Manage student exeat requests, approvals, and tracking."
        actions={
          <Link
            href="/boarding/exeat/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New Exeat Request
          </Link>
        }
      />
      <ExeatClient
        exeats={exeats}
        pagination={pagination}
        stats={stats}
      />
    </div>
  );
}
