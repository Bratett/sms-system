import { auth } from "@/lib/auth";
import { getParentChildrenAction } from "@/modules/portal/actions/parent.action";
import { ChildrenClient } from "./children-client";

export default async function ChildrenPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getParentChildrenAction();
  const children = result.data ?? [];

  return <ChildrenClient students={children} />;
}
