import { auth } from "@/lib/auth";
import { getMessageThreadsAction } from "@/modules/messaging/actions/thread.action";
import { MessagesClient } from "./messages-client";

export default async function ParentMessagesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getMessageThreadsAction();
  const threads = "data" in result ? result.data : [];

  return <MessagesClient threads={threads} role="parent" />;
}
