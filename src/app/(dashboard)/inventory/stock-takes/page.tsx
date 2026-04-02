import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getStockTakesAction } from "@/modules/inventory/actions/stock-take.action";
import { getStoresAction } from "@/modules/inventory/actions/store.action";
import { StockTakesClient } from "./stock-takes-client";

export default async function StockTakesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [stockTakesResult, storesResult] = await Promise.all([
    getStockTakesAction(),
    getStoresAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Takes"
        description="Plan and conduct physical inventory counts."
      />
      <StockTakesClient
        stockTakes={stockTakesResult.data ?? []}
        stores={storesResult.data ?? []}
      />
    </div>
  );
}
