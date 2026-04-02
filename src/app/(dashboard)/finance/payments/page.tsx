import { auth } from "@/lib/auth";
import { getPaymentsAction } from "@/modules/finance/actions/payment.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { PaymentsClient } from "./payments-client";

export default async function PaymentsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [paymentsResult, termsResult] = await Promise.all([
    getPaymentsAction({ page: 1, pageSize: 25 }),
    getTermsAction(),
  ]);

  const payments = "data" in paymentsResult ? paymentsResult.data : [];
  const pagination = "pagination" in paymentsResult ? paymentsResult.pagination ?? {
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  } : { page: 1, pageSize: 25, total: 0, totalPages: 0 };
  const terms = "data" in termsResult ? termsResult.data : [];

  return (
    <PaymentsClient
      initialPayments={payments}
      initialPagination={pagination}
      terms={terms}
    />
  );
}
