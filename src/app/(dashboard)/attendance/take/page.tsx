import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getClassesAction } from "@/modules/academics/actions/class.action";
import { AttendanceForm } from "./attendance-form";
import Link from "next/link";

export default async function TakeAttendancePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const classesResult = await getClassesAction();
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Take Attendance"
        description="Select a class and date, then record attendance for each student."
        actions={
          <Link
            href="/attendance"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Attendance
          </Link>
        }
      />
      <AttendanceForm classArms={classArms} />
    </div>
  );
}
