import { auth } from "@/lib/auth";
import { getAccountsAction } from "@/modules/accounting/actions/chart-of-accounts.action";
import { getBudgetsAction } from "@/modules/accounting/actions/budget.action";
import { FinancialStatementsClient } from "./financial-statements-client";

export default async function FinancialStatementsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [accountsResult, budgetsResult] = await Promise.all([
    getAccountsAction({ isActive: true }),
    getBudgetsAction(),
  ]);

  return (
    <FinancialStatementsClient
      accounts={"data" in accountsResult ? accountsResult.data : []}
      budgets={"data" in budgetsResult ? budgetsResult.data.map((b) => ({ id: b.id, name: b.name })) : []}
    />
  );
}
