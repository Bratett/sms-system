import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAttendanceHistoryAction } from "@/modules/attendance/actions/attendance.action";
import { getClassesAction } from "@/modules/academics/actions/class.action";
import Link from "next/link";

export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [historyResult, classesResult] = await Promise.all([
    getAttendanceHistoryAction({ page: 1, pageSize: 10 }),
    getClassesAction(),
  ]);

  const recentRegisters = historyResult.data ?? [];
  const classes = classesResult.data ?? [];
  const totalClassArms = classes.reduce((sum, cls) => sum + cls.classArms.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Track and manage student attendance."
        actions={
          <Link
            href="/attendance/take"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Take Attendance
          </Link>
        }
      />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Classes</p>
          <p className="mt-1 text-2xl font-bold">{classes.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Class Arms</p>
          <p className="mt-1 text-2xl font-bold">{totalClassArms}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Recent Registers</p>
          <p className="mt-1 text-2xl font-bold">{historyResult.pagination?.total ?? 0}</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/attendance/take"
          className="rounded-lg border border-border bg-card p-6 hover:bg-muted/30 transition-colors"
        >
          <h3 className="text-lg font-semibold">Take Attendance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a class and record daily attendance for students.
          </p>
        </Link>
        <Link
          href="/attendance/reports"
          className="rounded-lg border border-border bg-card p-6 hover:bg-muted/30 transition-colors"
        >
          <h3 className="text-lg font-semibold">Attendance Reports</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            View attendance summaries and statistics per class and term.
          </p>
        </Link>
      </div>

      {/* Recent Attendance Registers */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Attendance Registers</h3>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Class</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-center font-medium">Type</th>
                  <th className="px-4 py-3 text-center font-medium">Present</th>
                  <th className="px-4 py-3 text-center font-medium">Absent</th>
                  <th className="px-4 py-3 text-center font-medium">Late</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRegisters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No attendance records yet. Click &quot;Take Attendance&quot; to get started.
                    </td>
                  </tr>
                ) : (
                  recentRegisters.map((reg) => (
                    <tr
                      key={reg.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">{reg.classArmName}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(reg.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                          {reg.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">
                        {reg.presentCount}
                      </td>
                      <td className="px-4 py-3 text-center text-red-600 font-medium">
                        {reg.absentCount}
                      </td>
                      <td className="px-4 py-3 text-center text-yellow-600 font-medium">
                        {reg.lateCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            reg.status === "OPEN"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {reg.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
