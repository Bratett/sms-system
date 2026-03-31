import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicDropdownsAction } from "@/modules/academics/actions/dropdown.action";
import { getAcademicEventsAction } from "@/modules/school/actions/academic-event.action";
import { AcademicCalendarClient } from "./academic-calendar-client";

export default async function AcademicCalendarPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [dropdownsResult, eventsResult] = await Promise.all([
    getAcademicDropdownsAction(),
    getAcademicEventsAction(),
  ]);

  const academicYears = dropdownsResult.data?.academicYears ?? [];
  const terms = dropdownsResult.data?.terms ?? [];
  const events = eventsResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Calendar"
        description="Manage school events, exam periods, holidays, and important dates."
      />
      <AcademicCalendarClient
        initialEvents={events}
        academicYears={academicYears}
        terms={terms}
      />
    </div>
  );
}
