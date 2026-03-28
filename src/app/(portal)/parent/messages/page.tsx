import { auth } from "@/lib/auth";
import { MessagesClient } from "./messages-client";

export default async function ParentMessagesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  return <MessagesClient />;
}
