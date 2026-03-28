import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAssessmentTypesAction } from "@/modules/academics/actions/assessment.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { AssessmentsClient } from "./assessments-client";

export default async function AssessmentsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [assessmentTypesResult, termsResult] = await Promise.all([
    getAssessmentTypesAction(),
    getTermsAction(),
  ]);

  const assessmentTypes = assessmentTypesResult.data ?? [];
  const terms = (termsResult.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    termNumber: t.termNumber,
    academicYearId: t.academicYear.id,
    academicYearName: t.academicYear.name,
    isCurrent: t.isCurrent,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment Types"
        description="Configure assessment types, weights, and scoring for your school."
      />
      <AssessmentsClient initialAssessmentTypes={assessmentTypes} terms={terms} />
    </div>
  );
}
