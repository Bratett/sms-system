import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getTransfersAction } from "@/modules/inventory/actions/transfer.action";
import { getStoresAction } from "@/modules/inventory/actions/store.action";
import { TransfersClient } from "./transfers-client";

export default async function TransfersPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [transfersResult, storesResult] = await Promise.all([
    getTransfersAction(),
    getStoresAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inter-Store Transfers"
        description="Transfer inventory items between stores."
      />
      <TransfersClient
        transfers={transfersResult.data ?? []}
        stores={storesResult.data ?? []}
      />
    </div>
  );
}
