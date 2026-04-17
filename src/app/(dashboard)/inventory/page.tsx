import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getStoresAction } from "@/modules/inventory/actions/store.action";
import { getLowStockAlertsAction } from "@/modules/inventory/actions/item.action";
import { getStockValuationAction } from "@/modules/inventory/actions/inventory-report.action";
import { InventoryDashboardClient } from "./inventory-dashboard-client";

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [storesResult, alertsResult, valuationResult] = await Promise.all([
    getStoresAction(),
    getLowStockAlertsAction(),
    getStockValuationAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Overview of stores, stock levels, and alerts."
      />
      <InventoryDashboardClient
        stores={"data" in storesResult ? storesResult.data : []}
        lowStockAlerts={"data" in alertsResult ? alertsResult.data : []}
        valuation={"data" in valuationResult ? valuationResult.data : []}
        grandTotal={"grandTotal" in valuationResult ? valuationResult.grandTotal : 0}
      />
    </div>
  );
}
