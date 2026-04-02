import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getHostelsAction } from "@/modules/boarding/actions/hostel.action";
import { IncidentForm } from "./incident-form";
import Link from "next/link";

export default async function NewIncidentPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const hostelsResult = await getHostelsAction();
  const hostels = "data" in hostelsResult ? hostelsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Incident"
        description="Report a new boarding house incident."
        actions={
          <Link
            href="/boarding/incidents"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Incidents
          </Link>
        }
      />
      <IncidentForm hostels={hostels} />
    </div>
  );
}
