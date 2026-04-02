import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getTransfersAction } from "@/modules/boarding/actions/transfer.action";
import { TransfersClient } from "./transfers-client";
import Link from "next/link";

export default async function TransfersPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getTransfersAction({ page: 1, pageSize: 20 });

  const transfers = ("data" in result ? result.data : null) ?? [];
  const total = ("total" in result ? result.total : null) ?? 0;
  const page = ("page" in result ? result.page : null) ?? 1;
  const pageSize = ("pageSize" in result ? result.pageSize : null) ?? 20;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bed Transfers"
        description="Manage student bed transfer requests across hostels."
        actions={
          <Link
            href="/boarding/transfers/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Request Transfer
          </Link>
        }
      />
      <TransfersClient
        transfers={transfers}
        pagination={{ page, pageSize, total, totalPages: Math.ceil(total / pageSize) }}
      />
    </div>
  );
}
