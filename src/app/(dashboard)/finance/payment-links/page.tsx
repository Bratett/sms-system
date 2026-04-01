import { auth } from "@/lib/auth";
import { getPaymentLinksAction } from "@/modules/finance/actions/payment-link.action";
import { PaymentLinksClient } from "./payment-links-client";

export default async function PaymentLinksPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getPaymentLinksAction();

  return (
    <PaymentLinksClient
      links={result.data ?? []}
      pagination={result.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
    />
  );
}
