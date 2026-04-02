import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { HomeworkClient } from "./homework-client";

export default async function HomeworkPage() {
  const session = await auth();
  if (!session?.user) return null;

  const dropdownsResult = await getAcademicDropdownsAction();
  const dropdownsData = "data" in dropdownsResult ? dropdownsResult.data : null;
  const classArms = dropdownsData?.classArms ?? [];
  const terms = dropdownsData?.terms ?? [];
  const subjects = dropdownsData?.subjects ?? [];
  const academicYears = dropdownsData?.academicYears ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Homework"
        description="Assign homework, track submissions, and grade student work."
      />
      <HomeworkClient
        classArms={classArms}
        terms={terms}
        subjects={subjects}
        academicYears={academicYears}
      />
    </div>
  );
}
