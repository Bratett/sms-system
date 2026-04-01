import { auth } from "@/lib/auth";
import { getLatePenaltyRulesAction } from "@/modules/finance/actions/penalty.action";
import { getFeeStructuresAction } from "@/modules/finance/actions/fee-structure.action";
import { PenaltiesClient } from "./penalties-client";

export default async function PenaltiesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [penaltyRulesResult, feeStructuresResult] = await Promise.all([
    getLatePenaltyRulesAction(),
    getFeeStructuresAction(),
  ]);

  const penaltyRules = "data" in penaltyRulesResult ? penaltyRulesResult.data ?? [] : [];
  const feeStructures = (feeStructuresResult.data ?? []).filter(
    (fs: { status: string }) => fs.status === "ACTIVE"
  );

  return (
    <PenaltiesClient
      penaltyRules={penaltyRules}
      feeStructures={feeStructures}
    />
  );
}
