import { auth } from "@/lib/auth";
import { getFiscalPeriodsAction } from "@/modules/accounting/actions/fiscal-period.action";
import { FiscalPeriodsClient } from "./periods-client";

export default async function FiscalPeriodsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getFiscalPeriodsAction();
  const periods = "data" in result ? result.data : [];

  return <FiscalPeriodsClient periods={periods} />;
}
