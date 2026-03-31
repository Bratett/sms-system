import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { HomeworkClient } from "./homework-client";

export default async function HomeworkPage() {
  const session = await auth();
  if (!session?.user) return null;

  const dropdownsResult = await getAcademicDropdownsAction();
  const classArms = dropdownsResult.data?.classArms ?? [];
  const terms = dropdownsResult.data?.terms ?? [];
  const subjects = dropdownsResult.data?.subjects ?? [];
  const academicYears = dropdownsResult.data?.academicYears ?? [];

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
