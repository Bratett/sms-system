import { getMyAlumniEventsAction } from "@/modules/alumni-events/actions/alumni-events.action";
import { EventsListClient } from "./events-list-client";

export default async function AlumniEventsPage() {
  const result = await getMyAlumniEventsAction({ tab: "upcoming" });
  if ("error" in result) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-xl">
        <p className="text-sm text-gray-500">{result.error}</p>
      </div>
    );
  }
  return <EventsListClient initialRows={result.data} />;
}
