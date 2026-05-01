import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentFormRegisterAction } from "@/modules/reports/actions/student-form-register.action";
import { FormRegisterClient, type Row } from "./form-register-client";

export default async function FormRegisterPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string; classArmId?: string; weeks?: string; daysPerWeek?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;
  const weeks = sp.weeks ? Number(sp.weeks) : undefined;
  const daysPerWeek = sp.daysPerWeek ? Number(sp.daysPerWeek) : undefined;

  const [filtersR, reportR] = await Promise.all([
    getReportFiltersAction(),
    sp.classArmId
      ? getStudentFormRegisterAction({ academicYearId: sp.academicYearId, classArmId: sp.classArmId, weeks, daysPerWeek })
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Form Master's Register" description="Configurable attendance register grid." />
      <FormRegisterClient
        academicYears={"data" in filtersR ? filtersR.data.academicYears : []}
        classArms={"data" in filtersR ? filtersR.data.classArms : []}
        report={"data" in reportR ? (reportR as { data: { rows: Row[]; total: number; weeks: number; daysPerWeek: number } | null }).data : null}
        error={"error" in reportR ? (reportR as { error: string }).error : null}
        appliedFilters={{ academicYearId: sp.academicYearId, classArmId: sp.classArmId, weeks: sp.weeks, daysPerWeek: sp.daysPerWeek }}
      />
    </div>
  );
}
