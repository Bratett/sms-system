import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getClassesAction } from "@/modules/academics/actions/class.action";
import { StudentForm } from "./student-form";

export default async function NewStudentPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const classesResult = await getClassesAction();
  const allClasses = classesResult.data ?? [];

  // Build class arm options grouped by class
  const classArmOptions = allClasses.flatMap((cls) =>
    cls.classArms.map((arm) => ({
      id: arm.id,
      label: `${cls.name} ${arm.name}`,
      className: cls.name,
      capacity: arm.capacity,
      enrollmentCount: arm.enrollmentCount,
    })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Register New Student"
        description="Add a new student to the school register."
      />
      <StudentForm classArmOptions={classArmOptions} />
    </div>
  );
}
