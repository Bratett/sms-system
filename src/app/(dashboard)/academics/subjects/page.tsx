import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getSubjectsAction } from "@/modules/academics/actions/subject.action";
import { SubjectsClient } from "./subjects-client";

export default async function SubjectsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getSubjectsAction();
  const subjects = "data" in result ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subjects"
        description="Manage subjects offered at your school."
      />
      <SubjectsClient initialSubjects={subjects} />
    </div>
  );
}
