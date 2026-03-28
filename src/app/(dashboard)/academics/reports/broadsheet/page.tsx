import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { BroadsheetClient } from "./broadsheet-client";

export default async function BroadsheetPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const dropdownsResult = await getAcademicDropdownsAction();

  const classArms = dropdownsResult.data?.classArms ?? [];
  const terms = dropdownsResult.data?.terms ?? [];
  const academicYears = dropdownsResult.data?.academicYears ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Broadsheet"
        description="View class-level results matrix showing all students and subjects."
      />
      <BroadsheetClient
        classArms={classArms}
        terms={terms}
        academicYears={academicYears}
      />
    </div>
  );
}
