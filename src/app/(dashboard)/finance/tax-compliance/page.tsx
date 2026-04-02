import { auth } from "@/lib/auth";
import { getTaxRecordsAction, getTaxSummaryAction } from "@/modules/accounting/actions/tax-compliance.action";
import { TaxComplianceClient } from "./tax-compliance-client";

export default async function TaxCompliancePage() {
  const session = await auth();
  if (!session?.user) return null;

  const [recordsResult, summaryResult] = await Promise.all([
    getTaxRecordsAction(),
    getTaxSummaryAction(),
  ]);

  return (
    <TaxComplianceClient
      records={"data" in recordsResult ? recordsResult.data : []}
      summary={"data" in summaryResult ? summaryResult.data : null}
    />
  );
}
