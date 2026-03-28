import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getClassesAction } from "@/modules/academics/actions/class.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { AttendanceReportsClient } from "./attendance-reports-client";
import Link from "next/link";

export default async function AttendanceReportsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [classesResult, termsResult] = await Promise.all([
    getClassesAction(),
    getTermsAction(),
  ]);

  const classes = classesResult.data ?? [];

  // Build class arms list
  const classArms: { id: string; name: string; className: string }[] = [];
  for (const cls of classes) {
    for (const arm of cls.classArms) {
      classArms.push({
        id: arm.id,
        name: arm.name,
        className: cls.name,
      });
    }
  }

  const terms = (termsResult.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    academicYearName: t.academicYear?.name ?? "",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Reports"
        description="View attendance summaries and statistics by class and term."
        actions={
          <Link
            href="/attendance"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Attendance
          </Link>
        }
      />
      <AttendanceReportsClient classArms={classArms} terms={terms} />
    </div>
  );
}
