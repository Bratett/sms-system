import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getConsentStatusAction,
  getConsentAuditAction,
} from "@/modules/compliance/actions/consent.action";
import { ConsentClient } from "./consent-client";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const params = await searchParams;

  const [consentResult, auditResult] = await Promise.all([
    getConsentStatusAction(),
    getConsentAuditAction({
      page: params.page ? parseInt(params.page) : 1,
      pageSize: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consent Management"
        description="Manage data processing consent and view audit trail."
      />
      <ConsentClient
        consentStatus={"data" in consentResult ? consentResult.data : []}
        auditTrail={"data" in auditResult ? auditResult.data : []}
        auditTotal={"total" in auditResult ? auditResult.total ?? 0 : 0}
        auditPage={"page" in auditResult ? auditResult.page ?? 1 : 1}
        auditPageSize={"pageSize" in auditResult ? auditResult.pageSize ?? 20 : 20}
      />
    </div>
  );
}
