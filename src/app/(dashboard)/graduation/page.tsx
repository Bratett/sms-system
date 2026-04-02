import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getGraduationBatchesAction,
  getAcademicYearsForGraduationAction,
} from "@/modules/graduation/actions/graduation.action";
import { GraduationClient } from "./graduation-client";

export default async function GraduationPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [batchesResult, yearsResult] = await Promise.all([
    getGraduationBatchesAction(),
    getAcademicYearsForGraduationAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Graduation"
        description="Manage graduation batches and records."
      />
      <GraduationClient
        batches={"data" in batchesResult ? batchesResult.data : []}
        academicYears={"data" in yearsResult ? yearsResult.data : []}
      />
    </div>
  );
}
