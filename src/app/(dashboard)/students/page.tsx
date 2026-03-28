import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getStudentsAction } from "@/modules/student/actions/student.action";
import { getClassesAction } from "@/modules/academics/actions/class.action";
import { getProgrammesAction } from "@/modules/school/actions/programme.action";
import { StudentsClient } from "./students-client";

export default async function StudentsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [studentsResult, classesResult, programmesResult] = await Promise.all([
    getStudentsAction({ page: 1, pageSize: 25 }),
    getClassesAction(),
    getProgrammesAction(),
  ]);

  const students = studentsResult.students ?? [];
  const total = studentsResult.total ?? 0;
  const page = studentsResult.page ?? 1;
  const pageSize = studentsResult.pageSize ?? 25;

  // Build class arm options from classes
  const allClasses = classesResult.data ?? [];
  const classArmOptions = allClasses.flatMap((cls) =>
    cls.classArms.map((arm) => ({
      id: arm.id,
      label: `${cls.name} ${arm.name}`,
      className: cls.name,
    })),
  );

  const programmes = (programmesResult.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage student directory, enrollment, and profiles."
      />
      <StudentsClient
        initialStudents={students}
        initialTotal={total}
        initialPage={page}
        initialPageSize={pageSize}
        classArmOptions={classArmOptions}
        programmes={programmes}
      />
    </div>
  );
}
