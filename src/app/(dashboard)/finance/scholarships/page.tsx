import { auth } from "@/lib/auth";
import { getScholarshipsAction } from "@/modules/finance/actions/scholarship.action";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { ScholarshipsClient } from "./scholarships-client";

export default async function ScholarshipsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [scholarshipsResult, academicYearsResult, termsResult] = await Promise.all([
    getScholarshipsAction(),
    getAcademicYearsAction(),
    getTermsAction(),
  ]);

  const scholarships = "data" in scholarshipsResult ? scholarshipsResult.data : [];
  const academicYears = "data" in academicYearsResult ? academicYearsResult.data : [];
  const terms = "data" in termsResult ? termsResult.data : [];

  return (
    <ScholarshipsClient
      scholarships={scholarships}
      academicYears={academicYears}
      terms={terms}
    />
  );
}
