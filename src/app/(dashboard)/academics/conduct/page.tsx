import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { ConductEntryClient } from "./conduct-entry-client";

export default async function ConductPage() {
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
        title="Conduct & Behaviour"
        description="Rate student conduct and behaviour traits for report cards."
      />
      <ConductEntryClient classArms={classArms} terms={terms} academicYears={academicYears} />
    </div>
  );
}
