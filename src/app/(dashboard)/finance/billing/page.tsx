import { auth } from "@/lib/auth";
import { getFeeStructuresAction } from "@/modules/finance/actions/fee-structure.action";
import { getBillsAction } from "@/modules/finance/actions/billing.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { BillingClient } from "./billing-client";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [feeStructuresResult, billsResult, termsResult] = await Promise.all([
    getFeeStructuresAction({ status: "ACTIVE" }),
    getBillsAction({ page: 1, pageSize: 25 }),
    getTermsAction(),
  ]);

  const feeStructures = feeStructuresResult.data ?? [];
  const bills = billsResult.data ?? [];
  const pagination = billsResult.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 };
  const terms = termsResult.data ?? [];

  return (
    <BillingClient
      feeStructures={feeStructures}
      initialBills={bills}
      initialPagination={pagination}
      terms={terms}
    />
  );
}
