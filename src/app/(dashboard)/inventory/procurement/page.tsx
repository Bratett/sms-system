import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getPurchaseRequestsAction, getPurchaseOrdersAction } from "@/modules/inventory/actions/procurement.action";
import { getItemsAction } from "@/modules/inventory/actions/item.action";
import { getStoresAction } from "@/modules/inventory/actions/store.action";
import { getSuppliersAction } from "@/modules/inventory/actions/supplier.action";
import { ProcurementClient } from "./procurement-client";

export default async function ProcurementPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [requestsResult, ordersResult, itemsResult, storesResult, suppliersResult] =
    await Promise.all([
      getPurchaseRequestsAction(),
      getPurchaseOrdersAction(),
      getItemsAction({ pageSize: 500 }),
      getStoresAction(),
      getSuppliersAction(),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement"
        description="Manage purchase requests, orders, and goods received."
      />
      <ProcurementClient
        requests={requestsResult.data ?? []}
        orders={ordersResult.data ?? []}
        allItems={itemsResult.data ?? []}
        stores={storesResult.data ?? []}
        suppliers={suppliersResult.data ?? []}
      />
    </div>
  );
}
