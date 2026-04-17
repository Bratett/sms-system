import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getPayrollPeriodsAction,
  getAllowancesAction,
  getDeductionsAction,
} from "@/modules/hr/actions/payroll.action";
import { PayrollClient } from "./payroll-client";

export default async function PayrollPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [periodsResult, allowancesResult, deductionsResult] = await Promise.all([
    getPayrollPeriodsAction(),
    getAllowancesAction(),
    getDeductionsAction(),
  ]);

  const periods = "data" in periodsResult ? periodsResult.data : [];
  const allowances = "data" in allowancesResult ? allowancesResult.data : [];
  const deductions = "data" in deductionsResult ? deductionsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Management"
        description="Manage payroll periods, allowances, and deductions."
      />
      <PayrollClient
        initialPeriods={periods}
        initialAllowances={allowances}
        initialDeductions={deductions}
      />
    </div>
  );
}
