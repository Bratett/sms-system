import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getTransportStatsAction } from "@/modules/transport/actions/transport.action";
import { TransportClient } from "./transport-client";

export default async function TransportPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getTransportStatsAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transport"
        description="Manage vehicles, routes, and student transportation."
      />
      <TransportClient stats={"data" in result ? result.data : null} />
    </div>
  );
}
