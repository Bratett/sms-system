import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getTeacherAssignmentsAction, getTeachersAction } from "@/modules/academics/actions/assignment.action";
import { getSubjectsAction } from "@/modules/academics/actions/subject.action";
import { getClassesAction } from "@/modules/academics/actions/class.action";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { AssignmentsClient } from "./assignments-client";

export default async function AssignmentsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [
    assignmentsResult,
    teachersResult,
    subjectsResult,
    classesResult,
    academicYearsResult,
    termsResult,
  ] = await Promise.all([
    getTeacherAssignmentsAction(),
    getTeachersAction(),
    getSubjectsAction(),
    getClassesAction(),
    getAcademicYearsAction(),
    getTermsAction(),
  ]);

  const assignments = "data" in assignmentsResult ? assignmentsResult.data : [];
  const teachers = "data" in teachersResult ? teachersResult.data : [];
  const subjects = ("data" in subjectsResult ? subjectsResult.data : []).map((s) => ({
    id: s.id,
    name: s.name,
  }));

  // Build class arms list from classes
  const classArms: { id: string; name: string; className: string }[] = [];
  for (const cls of "data" in classesResult ? classesResult.data : []) {
    for (const arm of cls.classArms) {
      classArms.push({
        id: arm.id,
        name: arm.name,
        className: cls.name,
      });
    }
  }

  const academicYears = ("data" in academicYearsResult ? academicYearsResult.data : []).map((ay) => ({
    id: ay.id,
    name: ay.name,
    isCurrent: ay.isCurrent,
  }));

  const terms = ("data" in termsResult ? termsResult.data : []).map((t) => ({
    id: t.id,
    name: t.name,
    academicYearId: t.academicYearId,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Assignments"
        description="Assign teachers to subjects and classes."
      />
      <AssignmentsClient
        initialAssignments={assignments}
        teachers={teachers}
        subjects={subjects}
        classArms={classArms}
        academicYears={academicYears}
        terms={terms}
      />
    </div>
  );
}
