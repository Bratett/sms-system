import { auth } from "@/lib/auth";
import { getPettyCashFundsAction } from "@/modules/accounting/actions/petty-cash.action";
import { PettyCashClient } from "./petty-cash-client";

export default async function PettyCashPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getPettyCashFundsAction();

  return <PettyCashClient funds={result.data ?? []} />;
}
