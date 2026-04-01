import { auth } from "@/lib/auth";
import {
  getAccountCategoriesAction,
  getAccountsAction,
} from "@/modules/accounting/actions/chart-of-accounts.action";
import { ChartOfAccountsClient } from "./chart-of-accounts-client";

export default async function ChartOfAccountsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [categoriesResult, accountsResult] = await Promise.all([
    getAccountCategoriesAction(),
    getAccountsAction(),
  ]);

  return (
    <ChartOfAccountsClient
      categories={categoriesResult.data ?? []}
      accounts={accountsResult.data ?? []}
    />
  );
}
