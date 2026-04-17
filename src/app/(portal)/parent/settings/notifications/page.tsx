import { auth } from "@/lib/auth";
import { getMyNotificationPreferencesAction } from "@/modules/portal/actions/notification-preferences.action";
import { NotificationPreferencesClient } from "./preferences-client";

export default async function ParentNotificationPreferencesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getMyNotificationPreferencesAction();
  const preferences = "data" in result ? result.data : [];

  return <NotificationPreferencesClient preferences={preferences} />;
}
