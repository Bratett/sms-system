import { auth } from "@/lib/auth";
import { getStudentPortalDataAction } from "@/modules/portal/actions/student-portal.action";
import { StudentDashboard } from "./student-dashboard";

export default async function StudentPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getStudentPortalDataAction();
  const studentData = result.data ?? null;
  const error = result.error ?? null;

  return <StudentDashboard data={studentData} error={error} />;
}
