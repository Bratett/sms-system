import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { MarkEntryClient } from "./mark-entry-client";

export default async function MarkEntryPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const dropdownsResult = await getAcademicDropdownsAction();
  const dropdowns = dropdownsResult.data ?? {
    subjects: [],
    classArms: [],
    assessmentTypes: [],
    terms: [],
    academicYears: [],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mark Entry"
        description="Enter and submit student marks for assessment types."
      />
      <MarkEntryClient dropdowns={dropdowns} />
    </div>
  );
}
