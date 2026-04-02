import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getSuppliersAction } from "@/modules/inventory/actions/supplier.action";
import { getExpiringContractsAction, getSupplierContractsAction } from "@/modules/inventory/actions/supplier-contract.action";
import { getSupplierScorecardsAction } from "@/modules/inventory/actions/supplier-rating.action";
import { SuppliersClient } from "./suppliers-client";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [suppliersResult, contractsResult, expiringResult, scorecardsResult] = await Promise.all([
    getSuppliersAction(),
    getSupplierContractsAction(),
    getExpiringContractsAction(),
    getSupplierScorecardsAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage your supplier directory, contracts, and performance scorecards."
      />
      <SuppliersClient
        suppliers={suppliersResult.data ?? []}
        contracts={contractsResult.data ?? []}
        expiringContracts={expiringResult.data ?? []}
        scorecards={scorecardsResult.data ?? []}
      />
    </div>
  );
}
