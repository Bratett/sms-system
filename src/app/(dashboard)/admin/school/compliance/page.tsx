import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getComplianceSettingsAction } from "@/modules/school/actions/compliance-settings.action";
import { ComplianceSettingsClient } from "./compliance-settings-client";

export default async function SchoolCompliancePage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getComplianceSettingsAction();
  const school = "data" in result ? result.data : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statutory Identifiers"
        description="Ghana-specific registration numbers used on payroll returns, GRA filings, and GETFund disbursement reports."
      />
      {school ? (
        <ComplianceSettingsClient school={school} />
      ) : (
        <p className="text-sm text-red-600">
          Could not load school settings. You may not have the required permission.
        </p>
      )}
    </div>
  );
}
