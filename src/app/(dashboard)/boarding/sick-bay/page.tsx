import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getSickBayAdmissionsAction,
  getSickBayStatsAction,
} from "@/modules/boarding/actions/sick-bay.action";
import { SickBayClient } from "./sick-bay-client";
import Link from "next/link";

export default async function SickBayPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [admissionsResult, statsResult] = await Promise.all([
    getSickBayAdmissionsAction({ page: 1, pageSize: 20 }),
    getSickBayStatsAction(),
  ]);

  const admissions = admissionsResult.data ?? [];
  const pagination = admissionsResult.pagination ?? {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  };
  const stats = statsResult.data ?? {
    currentlyAdmitted: 0,
    underObservation: 0,
    totalDischarged: 0,
    totalReferred: 0,
    bySeverity: { mild: 0, moderate: 0, severe: 0, emergency: 0 },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sick Bay"
        description="Manage sick bay admissions, medications, and discharges."
        actions={
          <Link
            href="/boarding/sick-bay/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Admit Student
          </Link>
        }
      />
      <SickBayClient
        admissions={admissions}
        pagination={pagination}
        stats={stats}
      />
    </div>
  );
}
