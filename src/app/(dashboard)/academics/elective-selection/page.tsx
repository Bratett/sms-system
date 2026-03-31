import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { getElectiveSelectionsAction } from "@/modules/academics/actions/elective-selection.action";
import { ElectiveSelectionClient } from "./elective-selection-client";

export default async function ElectiveSelectionPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [dropdownsResult, selectionsResult] = await Promise.all([
    getAcademicDropdownsAction(),
    getElectiveSelectionsAction(),
  ]);

  const classArms = dropdownsResult.data?.classArms ?? [];
  const academicYears = dropdownsResult.data?.academicYears ?? [];
  const selections = selectionsResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Elective Selection"
        description="Review and approve student elective subject selections."
      />
      <ElectiveSelectionClient
        initialSelections={selections}
        classArms={classArms}
        academicYears={academicYears}
      />
    </div>
  );
}
