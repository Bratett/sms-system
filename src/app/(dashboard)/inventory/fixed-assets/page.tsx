import { auth } from "@/lib/auth";
import { getFixedAssetsAction, getAssetCategoriesAction, getAssetSummaryAction } from "@/modules/inventory/actions/fixed-asset.action";
import { FixedAssetsClient } from "./fixed-assets-client";

export default async function FixedAssetsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [assetsResult, categoriesResult, summaryResult] = await Promise.all([
    getFixedAssetsAction(),
    getAssetCategoriesAction(),
    getAssetSummaryAction(),
  ]);

  return (
    <FixedAssetsClient
      assets={assetsResult.data ?? []}
      pagination={assetsResult.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
      categories={categoriesResult.data ?? []}
      summary={summaryResult.data ?? null}
    />
  );
}
