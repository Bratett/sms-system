import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getIncidentAction,
  updateIncidentAction,
  escalateIncidentAction,
} from "@/modules/boarding/actions/incident.action";
import { IncidentDetail } from "./incident-detail";
import Link from "next/link";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const { id } = await params;
  const result = await getIncidentAction(id);

  if (result.error || !result.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Incident Not Found" />
        <p className="text-muted-foreground">
          {result.error || "The incident record could not be found."}
        </p>
        <Link
          href="/boarding/incidents"
          className="text-primary hover:underline text-sm"
        >
          Back to Incidents
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Incident ${result.data.incidentNumber}`}
        description="View incident details, involved students, and take actions."
        actions={
          <Link
            href="/boarding/incidents"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Incidents
          </Link>
        }
      />
      <IncidentDetail incident={result.data} />
    </div>
  );
}
