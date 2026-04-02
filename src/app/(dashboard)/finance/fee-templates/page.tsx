import { auth } from "@/lib/auth";
import { getFeeTemplatesAction } from "@/modules/finance/actions/fee-template.action";
import { getProgrammesAction } from "@/modules/school/actions/programme.action";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { FeeTemplatesClient } from "./fee-templates-client";

export default async function FeeTemplatesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [templatesResult, programmesResult, academicYearsResult, termsResult] =
    await Promise.all([
      getFeeTemplatesAction(),
      getProgrammesAction(),
      getAcademicYearsAction(),
      getTermsAction(),
    ]);

  const templates = "data" in templatesResult ? templatesResult.data : [];
  const programmes = "data" in programmesResult ? programmesResult.data : [];
  const academicYears = "data" in academicYearsResult ? academicYearsResult.data : [];
  const terms = "data" in termsResult ? termsResult.data : [];

  return (
    <FeeTemplatesClient
      templates={templates}
      programmes={programmes}
      academicYears={academicYears}
      terms={terms}
    />
  );
}
