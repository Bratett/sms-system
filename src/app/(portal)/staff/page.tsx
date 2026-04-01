import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyStaffProfileAction } from "@/modules/hr/actions/self-service.action";
import Link from "next/link";

export default async function StaffDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const result = await getMyStaffProfileAction();

  if ("error" in result) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-semibold">No Staff Profile Found</h2>
        <p className="text-sm text-gray-500 mt-2">{result.error}</p>
      </div>
    );
  }

  const staff = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Welcome, {staff.firstName} {staff.lastName}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Staff ID: {staff.staffId} &middot; {staff.staffType.replace("_", " ")} &middot; {staff.status}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {staff.employments[0] && (
          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm font-medium text-gray-500">Current Position</p>
            <p className="mt-1 text-lg font-bold">{staff.employments[0].position}</p>
            <p className="text-xs text-gray-400">{staff.employments[0].departmentName || "No department"}</p>
          </div>
        )}
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Leave Balances</p>
          {staff.leaveBalances.length === 0 ? (
            <p className="mt-1 text-sm text-gray-400">Not initialized</p>
          ) : (
            <div className="mt-2 space-y-1">
              {staff.leaveBalances.slice(0, 3).map((lb) => (
                <div key={lb.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{lb.leaveTypeName}</span>
                  <span className="font-medium">{lb.remainingDays} days</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/staff/leave" className="rounded-lg border bg-white p-5 hover:bg-gray-50 transition-colors">
          <h3 className="font-semibold text-gray-900">Request Leave</h3>
          <p className="text-sm text-gray-500 mt-1">Submit a new leave request.</p>
        </Link>
        <Link href="/staff/payslips" className="rounded-lg border bg-white p-5 hover:bg-gray-50 transition-colors">
          <h3 className="font-semibold text-gray-900">My Payslips</h3>
          <p className="text-sm text-gray-500 mt-1">View your payroll history.</p>
        </Link>
        <Link href="/staff/attendance" className="rounded-lg border bg-white p-5 hover:bg-gray-50 transition-colors">
          <h3 className="font-semibold text-gray-900">My Attendance</h3>
          <p className="text-sm text-gray-500 mt-1">Check your attendance record.</p>
        </Link>
        <Link href="/staff/profile" className="rounded-lg border bg-white p-5 hover:bg-gray-50 transition-colors">
          <h3 className="font-semibold text-gray-900">My Profile</h3>
          <p className="text-sm text-gray-500 mt-1">Update your contact details.</p>
        </Link>
      </div>
    </div>
  );
}
