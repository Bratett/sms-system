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

  const templates = templatesResult.data ?? [];
  const programmes = programmesResult.data ?? [];
  const academicYears = academicYearsResult.data ?? [];
  const terms = termsResult.data ?? [];

  return (
    <FeeTemplatesClient
      templates={templates}
      programmes={programmes}
      academicYears={academicYears}
      terms={terms}
    />
  );
}
