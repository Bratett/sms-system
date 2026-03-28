import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getSmsLogsAction } from "@/modules/communication/actions/sms.action";
import { SmsClient } from "./sms-client";

export default async function SmsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getSmsLogsAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="SMS"
        description="Send SMS messages and view delivery logs."
      />
      <SmsClient
        logs={result.data ?? []}
        pagination={result.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 }}
      />
    </div>
  );
}
