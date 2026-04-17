import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getHolidaysAction } from "@/modules/hr/actions/holiday.action";
import { HolidaysClient } from "./holidays-client";

export default async function HolidaysPage() {
  const session = await auth();
  if (!session?.user) return null;

  const currentYear = new Date().getFullYear();
  const result = await getHolidaysAction({ year: currentYear });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public Holiday Calendar"
        description="Manage public holidays and recurring observances."
      />
      <HolidaysClient
        initialHolidays={"data" in result ? result.data : []}
        initialYear={currentYear}
      />
    </div>
  );
}
