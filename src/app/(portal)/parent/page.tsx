import { auth } from "@/lib/auth";
import { getParentChildrenAction } from "@/modules/portal/actions/parent.action";
import { ParentDashboard } from "./parent-dashboard";

export default async function ParentPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getParentChildrenAction();
  const children = result.data ?? [];

  return <ParentDashboard children={children} userName={session.user.name ?? "Parent"} />;
}
