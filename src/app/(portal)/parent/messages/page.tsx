import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMessageThreadsAction } from "@/modules/messaging/actions/thread.action";
import { MessagesClient } from "./messages-client";

export default async function ParentMessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

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

  return (
    <MessagesClient
      threads={result.data}
      role="parent"
      currentUserId={session.user.id as string}
    />
  );
}
