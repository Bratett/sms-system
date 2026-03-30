import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getOverdueAction } from "@/modules/library/actions/library.action";
import { OverdueClient } from "./overdue-client";

export default async function OverduePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const overdueResult = await getOverdueAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overdue Books"
        description="Books that are past their due date."
      />
      <OverdueClient issues={overdueResult.data ?? []} />
    </div>
  );
}
