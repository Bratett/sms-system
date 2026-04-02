import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAssetAuditsAction } from "@/modules/inventory/actions/asset-audit.action";
import { getAssetCategoriesAction } from "@/modules/inventory/actions/fixed-asset.action";
import { AssetAuditsClient } from "./asset-audits-client";

export default async function AssetAuditsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const [auditsResult, categoriesResult] = await Promise.all([
    getAssetAuditsAction(),
    getAssetCategoriesAction(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Asset Audits" description="Schedule and conduct physical verification of fixed assets." />
      <AssetAuditsClient audits={auditsResult.data ?? []} categories={categoriesResult.data ?? []} />
    </div>
  );
}
