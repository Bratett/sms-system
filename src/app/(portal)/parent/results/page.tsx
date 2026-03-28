import { auth } from "@/lib/auth";
import { getParentChildrenAction } from "@/modules/portal/actions/parent.action";
import { ResultsClient } from "./results-client";

export default async function ParentResultsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getParentChildrenAction();
  const children = result.data ?? [];

  return <ResultsClient students={children} />;
}
