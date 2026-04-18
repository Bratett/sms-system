import { auth } from "@/lib/auth";
import { getAccountsAction } from "@/modules/accounting/actions/chart-of-accounts.action";
import { getFundsAction } from "@/modules/accounting/actions/fund.action";
import { GeneralLedgerClient } from "./general-ledger-client";

export default async function GeneralLedgerPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [accountsResult, fundsResult] = await Promise.all([
    getAccountsAction({ isActive: true }),
    getFundsAction({ isActive: true }),
  ]);

  return (
    <GeneralLedgerClient
      accounts={"data" in accountsResult ? accountsResult.data : []}
      funds={"data" in fundsResult ? fundsResult.data : []}
    />
  );
}
