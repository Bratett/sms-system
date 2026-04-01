import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getLoansAction } from "@/modules/hr/actions/loan.action";
import { getStaffAction } from "@/modules/hr/actions/staff.action";
import { LoansClient } from "./loans-client";

export default async function LoansPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [loansResult, staffResult] = await Promise.all([
    getLoansAction({ page: 1, pageSize: 25 }),
    getStaffAction({ status: "ACTIVE", pageSize: 500 }),
  ]);

  const loans = loansResult.data ?? [];
  const total = loansResult.total ?? 0;
  const page = loansResult.page ?? 1;
  const pageSize = loansResult.pageSize ?? 25;

  const staffOptions = (staffResult.staff ?? []).map((s) => ({
    id: s.id,
    staffId: s.staffId,
    name: `${s.firstName} ${s.lastName}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Loans"
        description="Manage staff loan applications, approvals, and repayment tracking."
      />
      <LoansClient
        initialLoans={loans}
        initialTotal={total}
        initialPage={page}
        initialPageSize={pageSize}
        staffOptions={staffOptions}
      />
    </div>
  );
}
