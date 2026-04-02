import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportTemplatesAction } from "@/modules/academics/actions/report-template.action";
import { ReportTemplatesClient } from "./report-templates-client";

export default async function ReportTemplatesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getReportTemplatesAction();
  const templates = "data" in result ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Templates"
        description="Configure report card templates and layout settings."
      />
      <ReportTemplatesClient initialTemplates={templates} />
    </div>
  );
}
