import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyTeacherTimetableAction } from "@/modules/hr/actions/self-service.action";
import { TeacherTimetableClient } from "./teacher-timetable-client";

export default async function StaffTimetablePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const result = await getMyTeacherTimetableAction();
  const data = "data" in result ? result.data : { timetable: [], periods: [] };

  return <TeacherTimetableClient timetable={data.timetable} periods={data.periods} />;
}
