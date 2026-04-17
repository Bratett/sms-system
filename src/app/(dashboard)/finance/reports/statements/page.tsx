import { auth } from "@/lib/auth";
import { getAccountsAction } from "@/modules/accounting/actions/chart-of-accounts.action";
import { FinancialStatementsClient } from "./financial-statements-client";

export default async function FinancialStatementsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const accountsResult = await getAccountsAction({ isActive: true });

  return <FinancialStatementsClient accounts={"data" in accountsResult ? accountsResult.data : []} />;
}
