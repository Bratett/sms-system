import { auth } from "@/lib/auth";
import { getTermsAction } from "@/modules/school/actions/term.action";
import {
  getCollectionSummaryAction,
  getRevenueByClassAction,
  getRevenueByFeeItemAction,
  getDebtorListAction,
} from "@/modules/finance/actions/finance-report.action";
import { FinanceReportsClient } from "./finance-reports-client";

export default async function FinanceReportsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [termsResult, collectionResult, revenueByClassResult, revenueByFeeItemResult, debtorResult] =
    await Promise.all([
      getTermsAction(),
      getCollectionSummaryAction(),
      getRevenueByClassAction(),
      getRevenueByFeeItemAction(),
      getDebtorListAction(undefined, 20),
    ]);

  const terms = termsResult.data ?? [];
  const collection = collectionResult.data ?? null;
  const revenueByClass = revenueByClassResult.data ?? [];
  const revenueByFeeItem = revenueByFeeItemResult.data ?? [];
  const debtors = debtorResult.data ?? [];

  return (
    <FinanceReportsClient
      terms={terms}
      initialCollection={collection}
      initialRevenueByClass={revenueByClass}
      initialRevenueByFeeItem={revenueByFeeItem}
      initialDebtors={debtors}
    />
  );
}
