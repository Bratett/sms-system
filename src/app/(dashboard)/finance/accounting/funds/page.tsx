import { auth } from "@/lib/auth";
import { getFundsAction } from "@/modules/accounting/actions/fund.action";
import { FundsClient } from "./funds-client";

export default async function FundsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getFundsAction();
  const funds = "data" in result ? result.data : [];

  return <FundsClient funds={funds} />;
}
