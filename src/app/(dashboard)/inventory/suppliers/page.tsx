import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getSuppliersAction } from "@/modules/inventory/actions/supplier.action";
import { SuppliersClient } from "./suppliers-client";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getSuppliersAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage your supplier directory."
      />
      <SuppliersClient suppliers={result.data ?? []} />
    </div>
  );
}
