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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contracts: any[] = "data" in contractsResult && contractsResult.data ? contractsResult.data : [];
  const total = "total" in contractsResult ? contractsResult.total ?? 0 : 0;
  const page = "page" in contractsResult ? contractsResult.page ?? 1 : 1;
  const pageSize = "pageSize" in contractsResult ? contractsResult.pageSize ?? 25 : 25;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expiring: any[] = "data" in expiringResult && expiringResult.data ? expiringResult.data : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffOptions = (("staff" in staffResult && staffResult.staff ? staffResult.staff : []) as any[]).map((s: { id: string; staffId: string; firstName: string; lastName: string }) => ({
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
