import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getTimetableAction, getPeriodsAction, getRoomsAction } from "@/modules/timetable/actions/timetable.action";
import { TimetableClient } from "./timetable-client";

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ classArmId?: string; teacherId?: string; roomId?: string; termId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;

  const [slotsResult, periodsResult, roomsResult] = await Promise.all([
    getTimetableAction({
      classArmId: params.classArmId,
      teacherId: params.teacherId,
      roomId: params.roomId,
      termId: params.termId,
    }),
    getPeriodsAction(),
    getRoomsAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable"
        description="Manage class timetables, rooms, and periods."
      />
      <TimetableClient
        slots={slotsResult.data ?? []}
        periods={periodsResult.data ?? []}
        rooms={roomsResult.data ?? []}
        filters={params}
      />
    </div>
  );
}
