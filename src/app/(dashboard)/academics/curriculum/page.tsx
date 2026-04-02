import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getProgrammesAction } from "@/modules/school/actions/programme.action";
import { getSubjectsAction } from "@/modules/academics/actions/subject.action";
import { CurriculumClient } from "./curriculum-client";

export default async function CurriculumPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [programmesResult, subjectsResult] = await Promise.all([
    getProgrammesAction(),
    getSubjectsAction(),
  ]);

  const programmes = ("data" in programmesResult ? programmesResult.data : []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  const subjects = ("data" in subjectsResult ? subjectsResult.data : []).map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    type: s.type,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum"
        description="Assign subjects to programmes. Manage core and elective subjects for each programme."
      />
      <CurriculumClient programmes={programmes} subjects={subjects} />
    </div>
  );
}
