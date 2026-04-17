import { auth } from "@/lib/auth";
import { getParentChildrenAction } from "@/modules/portal/actions/parent.action";
import { getPortalStatementAction } from "@/modules/portal/actions/portal-payment.action";
import { StatementClient } from "./statement-client";

interface Props {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentStatementPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;

  const childrenRes = await getParentChildrenAction();
  const children = "data" in childrenRes ? childrenRes.data : [];
  const selectedId = sp.studentId ?? (children[0]?.id as string | undefined);

  let statement: unknown = null;
  if (selectedId) {
    const res = await getPortalStatementAction(selectedId);
    if ("data" in res) statement = res.data;
  }

  return (
    <StatementClient
      students={children.map((c: { id: string; studentId: string; firstName: string; lastName: string }) => ({
        id: c.id,
        studentId: c.studentId,
        name: `${c.firstName} ${c.lastName}`,
      }))}
      selectedId={selectedId}
      statement={statement as never}
    />
  );
}
