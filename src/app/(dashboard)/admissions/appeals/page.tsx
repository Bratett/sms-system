import Link from "next/link";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { listAppealsAction } from "@/modules/admissions/actions/appeal.action";
import { AppealsClient } from "./appeals-client";

export default async function AppealsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const res = await listAppealsAction();
  const appeals = "data" in res && res.data ? res.data : [];

  const rows = appeals.map((a) => ({
    id: a.id,
    applicationId: a.applicationId,
    applicationNumber: a.application?.applicationNumber ?? "—",
    applicantName: a.application
      ? `${a.application.firstName} ${a.application.lastName}`
      : "—",
    guardianName: a.application?.guardianName ?? null,
    guardianPhone: a.application?.guardianPhone ?? null,
    reason: a.reason,
    status: a.status,
    submittedAt: a.submittedAt,
    resolvedAt: a.resolvedAt,
    resolution: a.resolution,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admission appeals"
        description="Review rejected-application appeals and decide whether to uphold or deny."
        actions={
          <Link
            href="/admissions"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to admissions
          </Link>
        }
      />
      <AppealsClient appeals={rows} />
    </div>
  );
}
