import { auth } from "@/lib/auth";
import { getFinancialAidApplicationsAction } from "@/modules/finance/actions/financial-aid.action";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { FinancialAidClient } from "./financial-aid-client";

export default async function FinancialAidPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [applicationsResult, academicYearsResult, termsResult] = await Promise.all([
    getFinancialAidApplicationsAction(),
    getAcademicYearsAction(),
    getTermsAction(),
  ]);

  return (
    <FinancialAidClient
      applications={applicationsResult.data ?? []}
      pagination={applicationsResult.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
      academicYears={academicYearsResult.data ?? []}
      terms={termsResult.data ?? []}
    />
  );
}
