import { auth } from "@/lib/auth";
import { getBudgetCommitmentsAction } from "@/modules/accounting/actions/budget-commitment.action";
import { CommitmentsClient } from "./commitments-client";

export default async function CommitmentsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getBudgetCommitmentsAction();
  const commitments = "data" in result ? result.data : [];

  return <CommitmentsClient commitments={commitments} />;
}
