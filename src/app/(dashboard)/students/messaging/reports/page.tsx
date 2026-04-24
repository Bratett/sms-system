import { getMessageReportsAction } from "@/modules/messaging/actions/message-moderation.action";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const result = await getMessageReportsAction({ status: "PENDING" });
  if ("error" in result) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }
  return <ReportsClient reports={result.data} />;
}
