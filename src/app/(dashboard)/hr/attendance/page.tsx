import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getStaffAction } from "@/modules/hr/actions/staff.action";
import {
  getStaffAttendanceAction,
  getDailyAttendanceOverviewAction,
} from "@/modules/hr/actions/staff-attendance.action";
import { getDepartmentsAction } from "@/modules/school/actions/department.action";
import { AttendanceClient } from "./attendance-client";

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const today = new Date().toISOString().split("T")[0];

  const [staffResult, attendanceResult, overviewResult, departmentsResult] =
    await Promise.all([
      getStaffAction({ status: "ACTIVE", pageSize: 500 }),
      getStaffAttendanceAction({
        dateFrom: today,
        dateTo: today,
        pageSize: 500,
      }),
      getDailyAttendanceOverviewAction(today),
      getDepartmentsAction(),
    ]);

  const staff = ("staff" in staffResult && staffResult.staff ? staffResult.staff : []).map((s: { id: string; staffId: string; firstName: string; lastName: string; departmentName: string | null; position: string | null }) => ({
    id: s.id,
    staffId: s.staffId,
    firstName: s.firstName,
    lastName: s.lastName,
    departmentName: s.departmentName,
    position: s.position,
  }));

  const attendanceRecords = ("data" in attendanceResult && attendanceResult.data ? attendanceResult.data : []).map((r: { id: string; staffId: string; status: string; remarks: string | null }) => ({
    id: r.id,
    staffId: r.staffId,
    status: r.status,
    remarks: r.remarks,
  }));

  const overview = ("data" in overviewResult && overviewResult.data) ? overviewResult.data : {
    date: today,
    totalActive: 0,
    recorded: 0,
    notRecorded: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    halfDay: 0,
    onLeave: 0,
    holiday: 0,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const departments = (("data" in departmentsResult && departmentsResult.data ? departmentsResult.data : []) as any[]).map((d: { id: string; name: string }) => ({
    id: d.id,
    name: d.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Attendance"
        description="Record and manage daily staff attendance."
      />
      <AttendanceClient
        initialStaff={staff}
        initialRecords={attendanceRecords}
        initialOverview={overview}
        initialDate={today}
        departments={departments}
      />
    </div>
  );
}
