import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAttendancePoliciesAction } from "@/modules/attendance/actions/attendance-policy.action";
import { PoliciesClient } from "./policies-client";
import Link from "next/link";

export default async function AttendancePoliciesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getAttendancePoliciesAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Policies"
        description="Configure attendance thresholds and automated alert rules."
        actions={
          <Link
            href="/attendance"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Attendance
          </Link>
        }
      />
      <PoliciesClient policies={result.data ?? []} />
    </div>
  );
}
