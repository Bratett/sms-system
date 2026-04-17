import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntakeClient } from "./intake-client";

export default async function IntakePage() {
  const session = await auth();
  if (!session?.user) return null;
  const schoolId = session.user.schoolId;
  if (!schoolId) return null;
  const suppliers = await db.supplier.findMany({
    where: { schoolId, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return <IntakeClient suppliers={suppliers} />;
}
