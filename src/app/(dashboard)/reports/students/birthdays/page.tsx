import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentBirthdayListAction } from "@/modules/reports/actions/student-birthday-list.action";
import { BirthdaysClient } from "./birthdays-client";

export default async function BirthdaysPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string; classArmId?: string; month?: string; upcomingDays?: string; includeGuardianPhone?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;
  const month = sp.month ? Number(sp.month) : undefined;
  const upcomingDays = sp.upcomingDays ? Number(sp.upcomingDays) : undefined;
  const includeGuardianPhone = sp.includeGuardianPhone === "1";

  const [filtersR, reportR] = await Promise.all([
    getReportFiltersAction(),
    getStudentBirthdayListAction({
      academicYearId: sp.academicYearId, classArmId: sp.classArmId,
      month, upcomingDays, includeGuardianPhone,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Birthday List" description="Birthdays in a chosen month or upcoming N days." />
      <BirthdaysClient
        academicYears={"data" in filtersR ? filtersR.data.academicYears : []}
        classArms={"data" in filtersR ? filtersR.data.classArms : []}
        report={"data" in reportR ? reportR.data : null}
        error={"error" in reportR ? reportR.error : null}
        appliedFilters={{ academicYearId: sp.academicYearId, classArmId: sp.classArmId, month: sp.month, upcomingDays: sp.upcomingDays, includeGuardianPhone: sp.includeGuardianPhone }}
      />
    </div>
  );
}
