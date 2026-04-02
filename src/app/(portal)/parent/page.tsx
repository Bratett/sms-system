import { auth } from "@/lib/auth";
import { getParentChildrenAction } from "@/modules/portal/actions/parent.action";
import { ParentDashboard } from "./parent-dashboard";

export default async function ParentPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getParentChildrenAction();
  const children = "data" in result ? result.data : [];

  return <ParentDashboard students={children} userName={session.user.name ?? "Parent"} />;
}
