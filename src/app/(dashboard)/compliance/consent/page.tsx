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
        consentStatus={consentResult.data ?? []}
        auditTrail={auditResult.data ?? []}
        auditTotal={auditResult.total ?? 0}
        auditPage={auditResult.page ?? 1}
        auditPageSize={auditResult.pageSize ?? 20}
      />
    </div>
  );
}
