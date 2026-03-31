import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { getAwardsAction } from "@/modules/academics/actions/awards.action";
import { AwardsClient } from "./awards-client";

export default async function AwardsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [dropdownsResult, awardsResult] = await Promise.all([
    getAcademicDropdownsAction(),
    getAwardsAction(),
  ]);

  const classArms = dropdownsResult.data?.classArms ?? [];
  const terms = dropdownsResult.data?.terms ?? [];
  const academicYears = dropdownsResult.data?.academicYears ?? [];
  const awards = awardsResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Awards"
        description="Recognize student achievement with awards and honours."
      />
      <AwardsClient
        initialAwards={awards}
        classArms={classArms}
        terms={terms}
        academicYears={academicYears}
      />
    </div>
  );
}
