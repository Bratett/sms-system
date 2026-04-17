import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getItemsAction } from "@/modules/inventory/actions/item.action";
import { getStoresAction, getCategoriesAction } from "@/modules/inventory/actions/store.action";
import { ItemsClient } from "./items-client";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; categoryId?: string; search?: string; lowStock?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const params = await searchParams;

  const [itemsResult, storesResult, categoriesResult] = await Promise.all([
    getItemsAction({
      storeId: params.storeId,
      categoryId: params.categoryId,
      search: params.search,
      lowStock: params.lowStock === "true",
      page: params.page ? parseInt(params.page) : 1,
      pageSize: 25,
    }),
    getStoresAction(),
    getCategoriesAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Item Catalog"
        description="Manage inventory items across all stores."
      />
      <ItemsClient
        items={"data" in itemsResult ? itemsResult.data : []}
        total={"total" in itemsResult ? itemsResult.total : 0}
        page={"page" in itemsResult ? itemsResult.page : 1}
        pageSize={"pageSize" in itemsResult ? itemsResult.pageSize : 25}
        stores={"data" in storesResult ? storesResult.data : []}
        categories={"data" in categoriesResult ? categoriesResult.data : []}
        filters={params}
      />
    </div>
  );
}
