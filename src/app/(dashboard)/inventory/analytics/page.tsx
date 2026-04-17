import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getInventoryOverviewAction,
  getStockTrendAnalyticsAction,
  getABCAnalysisAction,
  getCategoryDistributionAction,
  getStockAgingAnalysisAction,
  getReorderAnalyticsAction,
  getProcurementAnalyticsAction,
  getSupplierPerformanceAction,
  getAssetAnalyticsAction,
} from "@/modules/inventory/actions/analytics.action";
import { AnalyticsClient } from "./analytics-client";

export default async function InventoryAnalyticsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [
    overviewResult,
    trendsResult,
    abcResult,
    categoryResult,
    agingResult,
    reorderResult,
    procurementResult,
    supplierResult,
    assetResult,
  ] = await Promise.all([
    getInventoryOverviewAction(),
    getStockTrendAnalyticsAction(6),
    getABCAnalysisAction(),
    getCategoryDistributionAction(),
    getStockAgingAnalysisAction(),
    getReorderAnalyticsAction(),
    getProcurementAnalyticsAction(),
    getSupplierPerformanceAction(),
    getAssetAnalyticsAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Analytics"
        description="Comprehensive analytics and insights across all inventory operations."
      />
      <AnalyticsClient
        overview={"data" in overviewResult ? overviewResult.data : null}
        trends={"data" in trendsResult ? trendsResult.data : []}
        abcAnalysis={{ data: "data" in abcResult ? abcResult.data : [], summary: "summary" in abcResult ? abcResult.summary ?? null : null }}
        categoryDistribution={"data" in categoryResult ? categoryResult.data : []}
        stockAging={{ data: "data" in agingResult ? agingResult.data : [], summary: "summary" in agingResult ? agingResult.summary ?? [] : [] }}
        reorderAnalytics={{ data: "data" in reorderResult ? reorderResult.data : [], summary: "summary" in reorderResult ? reorderResult.summary ?? null : null }}
        procurementAnalytics={"data" in procurementResult ? procurementResult.data : null}
        supplierPerformance={"data" in supplierResult ? supplierResult.data : []}
        assetAnalytics={"data" in assetResult ? assetResult.data : null}
      />
    </div>
  );
}
