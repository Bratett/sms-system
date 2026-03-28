import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getSubmittedMarksAction } from "@/modules/academics/actions/mark.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { ApprovalClient } from "./approval-client";

export default async function ApprovalPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [marksResult, termsResult] = await Promise.all([
    getSubmittedMarksAction({ status: "SUBMITTED" }),
    getTermsAction(),
  ]);

  const markGroups = marksResult.data ?? [];
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
        title="Mark Approval"
        description="Review and approve or reject submitted marks."
      />
      <ApprovalClient initialMarkGroups={markGroups} terms={terms} />
    </div>
  );
}
