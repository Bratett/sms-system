import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentCensusAction, type CensusGroupBy } from "@/modules/reports/actions/student-census.action";
import { CensusClient } from "./census-client";

const ALLOWED: CensusGroupBy[] = ["class", "programme", "region", "gender", "boarding", "religion"];

export default async function CensusPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string; groupBy?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;
  const groupBy = (ALLOWED.includes(sp.groupBy as CensusGroupBy) ? sp.groupBy : "class") as CensusGroupBy;

  const [filters, report] = await Promise.all([
    getReportFiltersAction(),
    getStudentCensusAction({ academicYearId: sp.academicYearId, groupBy }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Student Census" description="Aggregate student counts." />
      <CensusClient
        academicYears={"data" in filters ? filters.data.academicYears : []}
        report={"data" in report ? report.data : null}
        error={"error" in report ? report.error : null}
        appliedFilters={{ academicYearId: sp.academicYearId, groupBy }}
      />
    </div>
  );
}
