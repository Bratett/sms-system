import { auth } from "@/lib/auth";
import { getFinanceDashboardAction } from "@/modules/finance/actions/finance-report.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { FinanceDashboardClient } from "./finance-dashboard-client";

export default async function FinancePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [dashboardResult, termsResult] = await Promise.all([
    getFinanceDashboardAction(),
    getTermsAction(),
  ]);

  const dashboard = "data" in dashboardResult ? dashboardResult.data : null;
  const terms = "data" in termsResult ? termsResult.data : [];

  return <FinanceDashboardClient dashboard={dashboard} terms={terms} />;
}
