import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getHostelsAction } from "@/modules/boarding/actions/hostel.action";
import { MaintenanceForm } from "./maintenance-form";
import Link from "next/link";

export default async function NewMaintenancePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const hostelsResult = await getHostelsAction();
  const hostels = hostelsResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit Maintenance Request"
        description="Report a maintenance issue in the boarding facility."
        actions={
          <Link
            href="/boarding/maintenance"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Maintenance
          </Link>
        }
      />
      <MaintenanceForm hostels={hostels} />
    </div>
  );
}
