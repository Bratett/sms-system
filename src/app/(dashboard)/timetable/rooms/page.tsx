import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getRoomsAction } from "@/modules/timetable/actions/timetable.action";
import { RoomsClient } from "./rooms-client";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; search?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;

  const roomsResult = await getRoomsAction({
    type: params.type,
    search: params.search,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms"
        description="Manage classrooms, laboratories, and other facilities."
      />
      <RoomsClient
        rooms={"data" in roomsResult ? roomsResult.data : []}
        filters={params}
      />
    </div>
  );
}
