import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getClassesAction } from "@/modules/academics/actions/class.action";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { getProgrammesAction } from "@/modules/school/actions/programme.action";
import { ClassesClient } from "./classes-client";

export default async function ClassesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [classesResult, academicYearsResult, programmesResult] = await Promise.all([
    getClassesAction(),
    getAcademicYearsAction(),
    getProgrammesAction(),
  ]);

  const classes = "data" in classesResult ? classesResult.data : [];
  const academicYears = ("data" in academicYearsResult ? academicYearsResult.data : []).map((ay) => ({
    id: ay.id,
    name: ay.name,
    isCurrent: ay.isCurrent,
  }));
  const programmes = ("data" in programmesResult ? programmesResult.data : []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description="Manage classes and class arms for your school."
      />
      <ClassesClient
        initialClasses={classes}
        academicYears={academicYears}
        programmes={programmes}
      />
    </div>
  );
}
