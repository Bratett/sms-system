import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyAttendanceAction } from "@/modules/hr/actions/self-service.action";
import { StaffAttendanceClient } from "./staff-attendance-client";

export default async function StaffAttendancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const now = new Date();
  const result = await getMyAttendanceAction(now.getMonth() + 1, now.getFullYear());

  return (
    <StaffAttendanceClient
      initialData={"data" in result ? result.data : null}
      initialMonth={now.getMonth() + 1}
      initialYear={now.getFullYear()}
    />
  );
}
