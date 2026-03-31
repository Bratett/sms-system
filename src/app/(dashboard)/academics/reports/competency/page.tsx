import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { CompetencyClient } from "./competency-client";

export default async function CompetencyReportsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const dropdownsResult = await getAcademicDropdownsAction();
  const academicYears = dropdownsResult.data?.academicYears ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competency Reports"
        description="View standards-based competency tracking and mastery levels."
      />
      <CompetencyClient academicYears={academicYears} />
    </div>
  );
}
