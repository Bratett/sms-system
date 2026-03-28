import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { TerminalReportsClient } from "./terminal-reports-client";

export default async function TerminalReportsPage() {
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
        title="Terminal Report Cards"
        description="Generate and print student terminal report cards."
      />
      <TerminalReportsClient
        classArms={classArms}
        terms={terms}
        academicYears={academicYears}
      />
    </div>
  );
}
