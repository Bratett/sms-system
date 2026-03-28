import { auth } from "@/lib/auth";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { AcademicYearClient } from "./academic-year-client";

export default async function AcademicYearPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getAcademicYearsAction();
  const academicYears = result.data ?? [];

  return <AcademicYearClient academicYears={academicYears} />;
}
