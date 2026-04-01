import { auth } from "@/lib/auth";
import { getJournalTransactionsAction } from "@/modules/accounting/actions/journal.action";
import { getAccountsAction } from "@/modules/accounting/actions/chart-of-accounts.action";
import { JournalClient } from "./journal-client";

export default async function JournalPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [transactionsResult, accountsResult] = await Promise.all([
    getJournalTransactionsAction(),
    getAccountsAction({ isActive: true }),
  ]);

  return (
    <JournalClient
      transactions={transactionsResult.data ?? []}
      pagination={transactionsResult.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
      accounts={accountsResult.data ?? []}
    />
  );
}
