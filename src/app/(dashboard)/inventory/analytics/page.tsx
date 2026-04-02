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
        overview={overviewResult.data ?? null}
        trends={trendsResult.data ?? []}
        abcAnalysis={{ data: abcResult.data ?? [], summary: abcResult.summary ?? null }}
        categoryDistribution={categoryResult.data ?? []}
        stockAging={{ data: agingResult.data ?? [], summary: agingResult.summary ?? [] }}
        reorderAnalytics={{ data: reorderResult.data ?? [], summary: reorderResult.summary ?? null }}
        procurementAnalytics={procurementResult.data ?? null}
        supplierPerformance={supplierResult.data ?? []}
        assetAnalytics={assetResult.data ?? null}
      />
    </div>
  );
}
