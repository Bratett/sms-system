import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ImportStaffClient } from "./import-client";

export default async function ImportStaffPage() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div>
      <PageHeader
        title="Import Staff"
        description="Bulk import staff members from a CSV file."
      />
      <ImportStaffClient />
    </div>
  );
}
