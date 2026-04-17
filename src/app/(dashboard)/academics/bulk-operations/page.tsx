import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { BulkOperationsClient } from "./bulk-operations-client";

export default async function BulkOperationsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const dropdownsResult = await getAcademicDropdownsAction();
  const dropdownsData = "data" in dropdownsResult ? dropdownsResult.data : null;
  const classArms = dropdownsData?.classArms ?? [];
  const terms = dropdownsData?.terms ?? [];
  const academicYears = dropdownsData?.academicYears ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Operations"
        description="Execute batch operations across multiple class arms at once."
      />
      <BulkOperationsClient classArms={classArms} terms={terms} academicYears={academicYears} />
    </div>
  );
}
