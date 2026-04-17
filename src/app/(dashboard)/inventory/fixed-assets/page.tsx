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
      assets={"data" in assetsResult ? assetsResult.data : []}
      pagination={"pagination" in assetsResult ? assetsResult.pagination : { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
      categories={"data" in categoriesResult ? categoriesResult.data : []}
      summary={"data" in summaryResult ? summaryResult.data : null}
    />
  );
}
