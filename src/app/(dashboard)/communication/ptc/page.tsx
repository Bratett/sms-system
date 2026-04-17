import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { getPTCSessionsAction } from "@/modules/communication/actions/ptc.action";
import { PTCClient } from "./ptc-client";

export default async function PTCPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [dropdownsResult, sessionsResult] = await Promise.all([
    getAcademicDropdownsAction(),
    getPTCSessionsAction(),
  ]);

  const academicYears = "data" in dropdownsResult ? dropdownsResult.data?.academicYears ?? [] : [];
  const terms = "data" in dropdownsResult ? dropdownsResult.data?.terms ?? [] : [];
  const sessions = "data" in sessionsResult ? sessionsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent-Teacher Conferences"
        description="Schedule and manage parent-teacher conference sessions and bookings."
      />
      <PTCClient initialSessions={sessions} academicYears={academicYears} terms={terms} />
    </div>
  );
}
