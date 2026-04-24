import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMessageThreadsAction } from "@/modules/messaging/actions/thread.action";
import { MessagesClient } from "@/app/(portal)/parent/messages/messages-client";

export default async function StaffMessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const result = await getMessageThreadsAction();
  const threads = "data" in result ? result.data : [];

  return <MessagesClient threads={threads} role="teacher" />;
}
