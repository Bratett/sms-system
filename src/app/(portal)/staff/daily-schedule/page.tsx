import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { getTeacherDailyViewAction } from "@/modules/timetable/actions/daily-view.action";
import { DailyScheduleClient } from "./daily-schedule-client";

export default async function StaffDailySchedulePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const today = format(new Date(), "yyyy-MM-dd");
  const result = await getTeacherDailyViewAction(today);

  return (
    <DailyScheduleClient
      initialSchedule={result.data?.schedule ?? []}
      initialDate={today}
    />
  );
}
