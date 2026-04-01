import { auth } from "@/lib/auth";
import { getBankReconciliationsAction } from "@/modules/finance/actions/bank-reconciliation.action";
import { BankReconciliationClient } from "./bank-reconciliation-client";

export default async function BankReconciliationPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getBankReconciliationsAction();

  return (
    <BankReconciliationClient
      reconciliations={result.data ?? []}
      pagination={result.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
    />
  );
}
