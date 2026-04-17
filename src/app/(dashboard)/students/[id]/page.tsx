import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getStudentAction } from "@/modules/student/actions/student.action";
import { getGuardiansAction } from "@/modules/student/actions/guardian.action";
import { getClassesAction } from "@/modules/academics/actions/class.action";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { StudentProfile } from "./student-profile";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StudentProfilePage({ params }: Props) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const { id } = await params;

  const [studentResult, guardiansResult, classesResult, academicYearsResult, termsResult] =
    await Promise.all([
      getStudentAction(id),
      getGuardiansAction(),
      getClassesAction(),
      getAcademicYearsAction(),
      getTermsAction(),
    ]);

  if ("error" in studentResult || !("data" in studentResult) || !studentResult.data) {
    notFound();
  }

  const student = studentResult.data;

  // All guardians for linking
  const allGuardians = ("data" in guardiansResult ? guardiansResult.data ?? [] : []).map((g) => ({
    id: g.id,
    name: `${g.firstName} ${g.lastName}`,
    phone: g.phone,
    relationship: g.relationship,
  }));

  // Class arm options for enrollment
  const allClasses = "data" in classesResult ? classesResult.data : [];
  const classArmOptions = allClasses.flatMap((cls) =>
    cls.classArms.map((arm) => ({
      id: arm.id,
      label: `${cls.name} ${arm.name}`,
      className: cls.name,
      academicYearId: cls.academicYearId,
    })),
  );

  const academicYears = ("data" in academicYearsResult ? academicYearsResult.data ?? [] : []).map((ay) => ({
    id: ay.id,
    name: ay.name,
    isCurrent: ay.isCurrent,
  }));

  const currentAcademicYearId = academicYears.find((ay) => ay.isCurrent)?.id;
  const terms = ("data" in termsResult ? termsResult.data ?? [] : []).map((t) => ({
    id: t.id,
    name: `${t.academicYear?.name ?? ""} — ${t.name}`.trim(),
    isCurrent: t.academicYearId === currentAcademicYearId,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        description={`Student ID: ${student.studentId}`}
      />
      <StudentProfile
        student={student}
        allGuardians={allGuardians}
        classArmOptions={classArmOptions}
        academicYears={academicYears}
        terms={terms}
      />
    </div>
  );
}
