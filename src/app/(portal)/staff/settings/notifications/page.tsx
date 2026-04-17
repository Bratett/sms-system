import { auth } from "@/lib/auth";
import { getMyNotificationPreferencesAction } from "@/modules/portal/actions/notification-preferences.action";
import { NotificationPreferencesClient } from "@/app/(portal)/parent/settings/notifications/preferences-client";

export default async function StaffNotificationPreferencesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getMyNotificationPreferencesAction();
  const preferences = "data" in result ? result.data : [];

  return <NotificationPreferencesClient preferences={preferences} />;
}
