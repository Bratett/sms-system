import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyLeaveRequestsAction, getMyStaffProfileAction } from "@/modules/hr/actions/self-service.action";
import { getLeaveTypesAction } from "@/modules/hr/actions/leave.action";
import { StaffLeaveClient } from "./staff-leave-client";

export default async function StaffLeavePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [profile, requests, leaveTypes] = await Promise.all([
    getMyStaffProfileAction(),
    getMyLeaveRequestsAction(),
    getLeaveTypesAction(),
  ]);

  if ("error" in profile) {
    return <div className="py-12 text-center text-gray-500">{profile.error}</div>;
  }

  return (
    <StaffLeaveClient
      leaveBalances={profile.data.leaveBalances}
      leaveRequests={"data" in requests && requests.data ? requests.data : []}
      leaveTypes={"data" in leaveTypes && leaveTypes.data ? leaveTypes.data : []}
      gender={profile.data.gender}
    />
  );
}
