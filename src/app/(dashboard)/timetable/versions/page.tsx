import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getTimetableVersionsAction } from "@/modules/timetable/actions/timetable-version.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { VersionsClient } from "./versions-client";

export default async function TimetableVersionsPage({
  searchParams,
}: {
  searchParams: Promise<{ termId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;
  const [versionsResult, termsResult] = await Promise.all([
    getTimetableVersionsAction(params.termId),
    getTermsAction(),
  ]);

  const terms = ("data" in termsResult ? termsResult.data ?? [] : []).map((t) => ({
    id: t.id,
    name: t.name,
    isCurrent: t.isCurrent,
    academicYearName: t.academicYear?.name ?? "",
    academicYearId: t.academicYear?.id ?? "",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable Versions"
        description="Snapshot, publish, and restore timetable versions."
      />
      <VersionsClient
        versions={"data" in versionsResult ? versionsResult.data : []}
        terms={terms}
        currentTermId={params.termId}
      />
    </div>
  );
}
