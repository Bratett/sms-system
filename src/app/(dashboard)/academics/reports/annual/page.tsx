import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { AnnualReportsClient } from "./annual-reports-client";

export default async function AnnualReportsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const dropdownsResult = await getAcademicDropdownsAction();
  const dropdownsData = "data" in dropdownsResult ? dropdownsResult.data : null;
  const classArms = dropdownsData?.classArms ?? [];
  const academicYears = dropdownsData?.academicYears ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Annual Reports"
        description="Compute and view annual results aggregated across all terms."
      />
      <AnnualReportsClient classArms={classArms} academicYears={academicYears} />
    </div>
  );
}
