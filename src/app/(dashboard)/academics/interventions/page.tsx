import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { getInterventionsAction } from "@/modules/academics/actions/intervention.action";
import { InterventionsClient } from "./interventions-client";

export default async function InterventionsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [dropdownsResult, interventionsResult] = await Promise.all([
    getAcademicDropdownsAction(),
    getInterventionsAction(),
  ]);

  const dropdownsData = "data" in dropdownsResult ? dropdownsResult.data : null;
  const terms = dropdownsData?.terms ?? [];
  const academicYears = dropdownsData?.academicYears ?? [];
  const interventions = "data" in interventionsResult ? interventionsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Interventions"
        description="Track remedial support, tutoring, and counseling interventions for students."
      />
      <InterventionsClient
        initialInterventions={interventions}
        terms={terms}
        academicYears={academicYears}
      />
    </div>
  );
}
