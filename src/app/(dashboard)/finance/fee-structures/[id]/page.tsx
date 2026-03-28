import { auth } from "@/lib/auth";
import { getFeeStructureAction } from "@/modules/finance/actions/fee-structure.action";
import { FeeStructureDetail } from "./fee-structure-detail";
import { notFound } from "next/navigation";

export default async function FeeStructureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const { id } = await params;
  const result = await getFeeStructureAction(id);

  if (result.error || !result.data) {
    notFound();
  }

  return <FeeStructureDetail feeStructure={result.data} />;
}
