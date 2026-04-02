import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getInspectionsAction } from "@/modules/boarding/actions/inspection.action";
import { InspectionsClient } from "./inspections-client";
import Link from "next/link";

export default async function InspectionsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getInspectionsAction({ page: 1, pageSize: 20 });

  const inspections = ("data" in result ? result.data : null) ?? [];
  const pagination = ("pagination" in result ? result.pagination : null) ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boarding Inspections"
        description="Record and review hostel and dormitory inspections."
        actions={
          <Link
            href="/boarding/inspections/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New Inspection
          </Link>
        }
      />
      <InspectionsClient
        inspections={inspections}
        pagination={pagination}
      />
    </div>
  );
}
