import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getRequisitionsAction } from "@/modules/inventory/actions/requisition.action";
import { getStoresAction } from "@/modules/inventory/actions/store.action";
import { RequisitionsClient } from "./requisitions-client";

export default async function RequisitionsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [requisitionsResult, storesResult] = await Promise.all([
    getRequisitionsAction(),
    getStoresAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requisitions"
        description="Manage item requisitions from departments."
      />
      <RequisitionsClient
        requisitions={"data" in requisitionsResult ? requisitionsResult.data : []}
        stores={"data" in storesResult ? storesResult.data : []}
      />
    </div>
  );
}
