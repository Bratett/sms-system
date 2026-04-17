import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getStoresAction, getCategoriesAction } from "@/modules/inventory/actions/store.action";
import { StoresClient } from "./stores-client";

export default async function StoresPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [storesResult, categoriesResult] = await Promise.all([
    getStoresAction(),
    getCategoriesAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stores"
        description="Manage stores and item categories."
      />
      <StoresClient
        stores={"data" in storesResult ? storesResult.data : []}
        categories={"data" in categoriesResult ? categoriesResult.data : []}
      />
    </div>
  );
}
