import { auth } from "@/lib/auth";
import { getParentChildrenAction } from "@/modules/portal/actions/parent.action";
import { ParentAttendanceClient } from "./parent-attendance-client";

export default async function ParentAttendancePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getParentChildrenAction();
  const children = "data" in result ? result.data : [];

  return <ParentAttendanceClient students={children} />;
}
