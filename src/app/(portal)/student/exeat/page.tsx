import { auth } from "@/lib/auth";
import { getMyExeatsAction } from "@/modules/portal/actions/student-portal.action";
import { getStudentPortalDataAction } from "@/modules/portal/actions/student-portal.action";
import { ExeatClient } from "./exeat-client";

export default async function StudentExeatPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [exeatsResult, studentResult] = await Promise.all([
    getMyExeatsAction(),
    getStudentPortalDataAction(),
  ]);

  const exeats = "data" in exeatsResult ? exeatsResult.data : [];
  const studentData = "data" in studentResult ? studentResult.data : null;
  const isBoardingStudent = studentData?.boardingStatus === "BOARDING";

  return <ExeatClient exeats={exeats} isBoardingStudent={isBoardingStudent} />;
}
