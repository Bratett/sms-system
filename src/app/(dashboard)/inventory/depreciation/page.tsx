import { auth } from "@/lib/auth";
import { getDepreciationSummaryAction } from "@/modules/inventory/actions/depreciation.action";
import { DepreciationClient } from "./depreciation-client";

export default async function DepreciationPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getDepreciationSummaryAction();

  return (
    <DepreciationClient
      assets={result.data?.assets ?? []}
      summary={result.data?.summary ?? null}
    />
  );
}
