import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getConsentStatusAction } from "@/modules/compliance/actions/consent.action";
import {
  getDataExportRequestsAction,
  getDeletionRequestsAction,
} from "@/modules/compliance/actions/data-rights.action";
import { ComplianceClient } from "./compliance-client";

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  await searchParams;

  const [consentResult, exportResult, deletionResult] = await Promise.all([
    getConsentStatusAction(),
    getDataExportRequestsAction(),
    getDeletionRequestsAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance & Data Privacy"
        description="Manage consent, data rights, and privacy policies."
      />
      <ComplianceClient
        consentStatus={consentResult.data ?? []}
        exportRequests={exportResult.data ?? []}
        deletionRequests={deletionResult.data ?? []}
      />
    </div>
  );
}
