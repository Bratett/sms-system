import { auth } from "@/lib/auth";
import { getParentChildrenAction } from "@/modules/portal/actions/parent.action";
import { FeesClient } from "./fees-client";

export default async function ParentFeesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getParentChildrenAction();
  const children = result.data ?? [];

  return <FeesClient children={children} />;
}
