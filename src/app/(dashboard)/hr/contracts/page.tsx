import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAllContractsAction, getExpiringContractsAction } from "@/modules/hr/actions/contract.action";
import { getStaffAction } from "@/modules/hr/actions/staff.action";
import { ContractsClient } from "./contracts-client";

export default async function ContractsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [contractsResult, expiringResult, staffResult] = await Promise.all([
    getAllContractsAction({ page: 1, pageSize: 25 }),
    getExpiringContractsAction(30),
    getStaffAction({ status: "ACTIVE", pageSize: 500 }),
  ]);

  const contracts = contractsResult.data ?? [];
  const total = contractsResult.total ?? 0;
  const page = contractsResult.page ?? 1;
  const pageSize = contractsResult.pageSize ?? 25;
  const expiring = expiringResult.data ?? [];

  const staffOptions = (staffResult.staff ?? []).map((s) => ({
    id: s.id,
    staffId: s.staffId,
    name: `${s.firstName} ${s.lastName}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Contracts"
        description="Manage staff employment contracts, renewals, and expiring contracts."
      />
      <ContractsClient
        initialContracts={contracts}
        initialTotal={total}
        initialPage={page}
        initialPageSize={pageSize}
        expiringContracts={expiring}
        staffOptions={staffOptions}
      />
    </div>
  );
}
