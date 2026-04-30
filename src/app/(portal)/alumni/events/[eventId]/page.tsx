import { getMyAlumniEventDetailAction } from "@/modules/alumni-events/actions/alumni-events.action";
import { EventDetailClient } from "./event-detail-client";

export default async function AlumniEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const result = await getMyAlumniEventDetailAction(eventId);
  if ("error" in result) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-xl">
        <p className="text-sm text-gray-500">{result.error}</p>
      </div>
    );
  }
  return <EventDetailClient event={result.data.event} myRsvp={result.data.myRsvp} />;
}
