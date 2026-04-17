import { auth } from "@/lib/auth";
import { getMyAttendanceAction } from "@/modules/portal/actions/student-portal.action";
import { StudentAttendanceClient } from "./student-attendance-client";

export default async function StudentAttendancePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getMyAttendanceAction();
  const data = "data" in result ? result.data : { summary: null, terms: [] };

  return <StudentAttendanceClient initialData={data} />;
}
