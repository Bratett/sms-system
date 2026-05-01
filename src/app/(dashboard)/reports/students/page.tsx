import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StudentsReportsClient } from "./students-reports-client";

export default async function StudentsReportsHubPage() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Reports"
        description="Class rosters, census, nominal rolls, registers, birthdays, and missing-document follow-ups."
      />
      <StudentsReportsClient />
    </div>
  );
}
