import { auth } from "@/lib/auth";
import { getDonorFundsAction } from "@/modules/finance/actions/donor-fund.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { DonorFundsClient } from "./donor-funds-client";

export default async function DonorFundsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [fundsResult, termsResult] = await Promise.all([
    getDonorFundsAction(),
    getTermsAction(),
  ]);

  return (
    <DonorFundsClient
      funds={"data" in fundsResult ? fundsResult.data : []}
      terms={"data" in termsResult ? termsResult.data : []}
    />
  );
}
