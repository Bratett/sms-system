import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { listTeacherLicencesAction } from "@/modules/hr/actions/licensure.action";
import { LicencesClient } from "./licences-client";

export default async function LicencesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await listTeacherLicencesAction();
  const licences = "data" in result ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher NTC Licences"
        description="Track National Teaching Council licences for each staff member. Renewal reminders fire at 90, 60, 30, 14, and 7 days before expiry."
      />
      <LicencesClient licences={licences} />
    </div>
  );
}
