import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getStockMovementsAction } from "@/modules/inventory/actions/stock.action";
import { getItemsAction } from "@/modules/inventory/actions/item.action";
import { getStoresAction } from "@/modules/inventory/actions/store.action";
import { StockMovementClient } from "./stock-movement-client";

export default async function StockMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; type?: string; dateFrom?: string; dateTo?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const params = await searchParams;

  const [movementsResult, itemsResult, storesResult] = await Promise.all([
    getStockMovementsAction({
      storeId: params.storeId,
      type: params.type,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page ? parseInt(params.page) : 1,
      pageSize: 25,
    }),
    getItemsAction({ pageSize: 500 }),
    getStoresAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movement"
        description="Track stock in, out, and adjustments."
      />
      <StockMovementClient
        movements={movementsResult.data ?? []}
        total={movementsResult.total ?? 0}
        page={movementsResult.page ?? 1}
        pageSize={movementsResult.pageSize ?? 25}
        allItems={itemsResult.data ?? []}
        stores={storesResult.data ?? []}
        filters={params}
      />
    </div>
  );
}
