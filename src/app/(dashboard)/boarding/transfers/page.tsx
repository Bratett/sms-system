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

  const transfers = result.data ?? [];
  const total = result.total ?? 0;
  const page = result.page ?? 1;
  const pageSize = result.pageSize ?? 20;

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
