import { getAlumniEventListAction } from "@/modules/alumni-events/actions/admin-events.action";
import { EventsListClient } from "./events-list-client";

export default async function AlumniEventsPage() {
  const result = await getAlumniEventListAction({ page: 1, pageSize: 20 });
  if ("error" in result) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }
  return (
    <EventsListClient
      initialRows={result.data}
      initialPagination={result.pagination}
    />
  );
}
