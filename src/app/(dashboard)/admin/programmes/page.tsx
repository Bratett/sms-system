import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getProgrammesAction } from "@/modules/school/actions/programme.action";
import { getDepartmentsAction } from "@/modules/school/actions/department.action";
import { ProgrammesClient } from "./programmes-client";

export default async function ProgrammesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [programmesResult, departmentsResult] = await Promise.all([
    getProgrammesAction(),
    getDepartmentsAction(),
  ]);

  const programmes = programmesResult.data ?? [];
  const departments = (departmentsResult.data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programmes"
        description="Manage academic programmes offered by your school."
      />
      <ProgrammesClient programmes={programmes} departments={departments} />
    </div>
  );
}
