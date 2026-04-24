import { getMessageThreadsAction } from "@/modules/messaging/actions/thread.action";
import { MessagingAdminClient } from "./messaging-admin-client";

export default async function AdminMessagingPage() {
  const result = await getMessageThreadsAction();
  if ("error" in result) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }
  return <MessagingAdminClient threads={result.data} />;
}
