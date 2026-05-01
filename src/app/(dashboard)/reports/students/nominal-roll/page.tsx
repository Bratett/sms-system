import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentNominalRollAction } from "@/modules/reports/actions/student-nominal-roll.action";
import { NominalRollClient, type Row } from "./nominal-roll-client";

export default async function NominalRollPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string; classArmId?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;

  const [filtersR, reportR] = await Promise.all([
    getReportFiltersAction(),
    sp.classArmId
      ? getStudentNominalRollAction({ academicYearId: sp.academicYearId, classArmId: sp.classArmId })
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Nominal Roll" description="Official student listing per class arm." />
      <NominalRollClient
        academicYears={"data" in filtersR ? filtersR.data.academicYears : []}
        classArms={"data" in filtersR ? filtersR.data.classArms : []}
        report={"data" in reportR ? (reportR as { data: { rows: Row[]; total: number } | null }).data : null}
        error={"error" in reportR ? (reportR as { error: string }).error : null}
        appliedFilters={sp}
      />
    </div>
  );
}
