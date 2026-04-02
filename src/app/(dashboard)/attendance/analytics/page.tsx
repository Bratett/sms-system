import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { AnalyticsClient } from "./analytics-client";
import Link from "next/link";

export default async function AttendanceAnalyticsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const termsResult = await getTermsAction();
  const terms = (termsResult.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    isCurrent: t.isCurrent,
    academicYearName: t.academicYear?.name ?? "",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Analytics"
        description="Analyze attendance trends, chronic absenteeism, and patterns."
        actions={
          <Link
            href="/attendance"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Attendance
          </Link>
        }
      />
      <AnalyticsClient terms={terms} />
    </div>
  );
}
