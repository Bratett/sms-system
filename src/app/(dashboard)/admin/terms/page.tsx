import { auth } from "@/lib/auth";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { TermsClient } from "./terms-client";

export default async function TermsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [academicYearsResult, termsResult] = await Promise.all([
    getAcademicYearsAction(),
    getTermsAction(),
  ]);

  const academicYears = academicYearsResult.data ?? [];
  const terms = termsResult.data ?? [];

  return <TermsClient academicYears={academicYears} terms={terms} />;
}
