import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getPeriodsAction } from "@/modules/timetable/actions/timetable.action";
import { getStaffAction } from "@/modules/hr/actions/staff.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { TeacherAvailabilityClient } from "./teacher-availability-client";

export default async function TeacherAvailabilityPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [periodsResult, staffResult, termsResult] = await Promise.all([
    getPeriodsAction(),
    getStaffAction({ staffType: "TEACHING", status: "ACTIVE", pageSize: 200 }),
    getTermsAction(),
  ]);

  const periods = (periodsResult.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    startTime: p.startTime,
    endTime: p.endTime,
    type: p.type,
    order: p.order,
  }));

  const staffList = "staff" in staffResult ? staffResult.staff ?? [] : [];
  const teachers = staffList.map((s) => ({
    id: s.id,
    staffId: s.staffId,
    name: `${s.firstName} ${s.lastName}`,
  }));

  const terms = (termsResult.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    isCurrent: t.isCurrent,
    academicYearName: t.academicYear?.name ?? "",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Availability"
        description="Manage teacher availability and scheduling preferences per term."
      />
      <TeacherAvailabilityClient
        teachers={teachers}
        periods={periods}
        terms={terms}
      />
    </div>
  );
}
