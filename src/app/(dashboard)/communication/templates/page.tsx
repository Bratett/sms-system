import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { listNotificationTemplatesAction } from "@/modules/communication/actions/notification-template.action";
import { TemplatesClient } from "./templates-client";

export default async function NotificationTemplatesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await listNotificationTemplatesAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Templates"
        description="Customise the copy sent via email, SMS, WhatsApp, and in-app notifications. Global defaults stay read-only; create school overrides to change them."
      />
      <TemplatesClient
        templates={"data" in result ? result.data : []}
      />
    </div>
  );
}
