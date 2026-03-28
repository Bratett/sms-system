import { auth } from "@/lib/auth";
import { getPaymentsAction } from "@/modules/finance/actions/payment.action";
import { ReceiptsClient } from "./receipts-client";

export default async function ReceiptsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getPaymentsAction({ page: 1, pageSize: 50 });

  const payments = result.data ?? [];
  const pagination = result.pagination ?? {
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  };

  return <ReceiptsClient initialPayments={payments} initialPagination={pagination} />;
}
