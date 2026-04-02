import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getStockLevelReportAction, getStockMovementReportAction } from "@/modules/inventory/actions/inventory-report.action";
import { getStoresAction } from "@/modules/inventory/actions/store.action";
import { ReportsClient } from "./reports-client";

export default async function InventoryReportsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [stockLevelResult, movementResult, storesResult] = await Promise.all([
    getStockLevelReportAction(),
    getStockMovementReportAction(),
    getStoresAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Reports"
        description="Stock level reports and movement summaries."
      />
      <ReportsClient
        stockLevels={"data" in stockLevelResult ? stockLevelResult.data : []}
        movementSummary={"data" in movementResult ? movementResult.data : []}
        stores={"data" in storesResult ? storesResult.data : []}
      />
    </div>
  );
}
