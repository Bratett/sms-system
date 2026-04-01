import { auth } from "@/lib/auth";
import { getInstallmentPlansAction } from "@/modules/finance/actions/installment.action";
import { getFeeStructuresAction } from "@/modules/finance/actions/fee-structure.action";
import { InstallmentsClient } from "./installments-client";

export default async function InstallmentsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [plansResult, feeStructuresResult] = await Promise.all([
    getInstallmentPlansAction(),
    getFeeStructuresAction({ status: "ACTIVE" }),
  ]);

  const plans = plansResult.data ?? [];
  const feeStructures = feeStructuresResult.data ?? [];

  return (
    <InstallmentsClient
      plans={plans}
      feeStructures={feeStructures}
    />
  );
}
