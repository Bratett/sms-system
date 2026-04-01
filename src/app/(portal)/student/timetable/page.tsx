import { auth } from "@/lib/auth";
import { getMyTimetableAction } from "@/modules/portal/actions/student-portal.action";
import { TimetableClient } from "./timetable-client";

export default async function StudentTimetablePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getMyTimetableAction();
  const data = result.data ?? { timetable: [], periods: [] };

  return <TimetableClient timetable={data.timetable} periods={data.periods} />;
}
