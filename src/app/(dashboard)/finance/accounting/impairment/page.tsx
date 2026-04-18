import { auth } from "@/lib/auth";
import { generateReceivablesAgingAction } from "@/modules/accounting/actions/financial-reports.action";
import { ImpairmentClient } from "./impairment-client";

export default async function ImpairmentPage() {
  const session = await auth();
  if (!session?.user) return null;

  const agingResult = await generateReceivablesAgingAction(new Date());
  const aging = "data" in agingResult ? agingResult.data : null;

  return <ImpairmentClient aging={aging} />;
}
