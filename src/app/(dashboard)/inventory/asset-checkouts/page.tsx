import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getActiveCheckoutsAction, getOverdueCheckoutsAction } from "@/modules/inventory/actions/asset-checkout.action";
import { getFixedAssetsAction } from "@/modules/inventory/actions/fixed-asset.action";
import { AssetCheckoutsClient } from "./asset-checkouts-client";

export default async function AssetCheckoutsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const [activeResult, overdueResult, assetsResult] = await Promise.all([
    getActiveCheckoutsAction(),
    getOverdueCheckoutsAction(),
    getFixedAssetsAction({ status: "ACTIVE" }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Asset Checkouts" description="Check out and return fixed assets to staff and departments." />
      <AssetCheckoutsClient
        activeCheckouts={activeResult.data ?? []}
        overdueCheckouts={overdueResult.data ?? []}
        availableAssets={assetsResult.data ?? []}
      />
    </div>
  );
}
