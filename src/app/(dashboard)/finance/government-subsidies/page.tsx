import { auth } from "@/lib/auth";
import { getGovernmentSubsidiesAction, getSubsidySummaryAction } from "@/modules/finance/actions/government-subsidy.action";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { GovernmentSubsidiesClient } from "./government-subsidies-client";

export default async function GovernmentSubsidiesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [subsidiesResult, summaryResult, academicYearsResult, termsResult] = await Promise.all([
    getGovernmentSubsidiesAction(),
    getSubsidySummaryAction(),
    getAcademicYearsAction(),
    getTermsAction(),
  ]);

  return (
    <GovernmentSubsidiesClient
      subsidies={"data" in subsidiesResult ? subsidiesResult.data ?? [] : []}
      summary={"data" in summaryResult ? summaryResult.data : null}
      academicYears={"data" in academicYearsResult ? academicYearsResult.data : []}
      terms={"data" in termsResult ? termsResult.data : []}
    />
  );
}
