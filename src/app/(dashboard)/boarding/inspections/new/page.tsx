import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getHostelsAction } from "@/modules/boarding/actions/hostel.action";
import { InspectionForm } from "./inspection-form";
import Link from "next/link";

export default async function NewInspectionPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const hostelsResult = await getHostelsAction();
  const hostels = hostelsResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Inspection"
        description="Record a new hostel or dormitory inspection."
        actions={
          <Link
            href="/boarding/inspections"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Inspections
          </Link>
        }
      />
      <InspectionForm hostels={hostels} />
    </div>
  );
}
