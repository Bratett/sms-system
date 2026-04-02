import { auth } from "@/lib/auth";
import { getFeeStructuresAction } from "@/modules/finance/actions/fee-structure.action";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { FeeStructuresClient } from "./fee-structures-client";

export default async function FeeStructuresPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [feeStructuresResult, academicYearsResult, termsResult] = await Promise.all([
    getFeeStructuresAction(),
    getAcademicYearsAction(),
    getTermsAction(),
  ]);

  const feeStructures = "data" in feeStructuresResult ? feeStructuresResult.data : [];
  const academicYears = "data" in academicYearsResult ? academicYearsResult.data : [];
  const terms = "data" in termsResult ? termsResult.data : [];

  return (
    <FeeStructuresClient
      feeStructures={feeStructures}
      academicYears={academicYears}
      terms={terms}
    />
  );
}
