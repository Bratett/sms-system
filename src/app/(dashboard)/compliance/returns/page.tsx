import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ReturnsClient } from "./returns-client";

export default async function ComplianceReturnsPage() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statutory Returns"
        description="Generate PAYE, SSNIT, VAT, GETFund, GRA and GES returns for a reporting period. Download as CSV or XLSX. Every generation is written to the audit log."
      />
      <ReturnsClient />
    </div>
  );
}
