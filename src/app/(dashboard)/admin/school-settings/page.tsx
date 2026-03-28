import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getSchoolAction } from "@/modules/school/actions/school.action";
import { SchoolSettingsForm } from "./school-settings-form";

export default async function SchoolSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getSchoolAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="School Settings"
        description="Manage your school's basic information, location, and contact details."
      />
      <SchoolSettingsForm school={result.data ?? null} />
    </div>
  );
}
