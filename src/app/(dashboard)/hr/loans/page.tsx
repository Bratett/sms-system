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

  const loans = "data" in loansResult ? loansResult.data : [];
  const total = "total" in loansResult ? loansResult.total ?? 0 : 0;
  const page = "page" in loansResult ? loansResult.page ?? 1 : 1;
  const pageSize = "pageSize" in loansResult ? loansResult.pageSize ?? 25 : 25;

  const staffOptions = ("staff" in staffResult ? staffResult.staff ?? [] : []).map((s: { id: string; staffId: string; firstName: string; lastName: string }) => ({
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
