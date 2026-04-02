import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getIncidentsAction, getIncidentStatsAction } from "@/modules/boarding/actions/incident.action";
import { IncidentsClient } from "./incidents-client";
import Link from "next/link";

export default async function IncidentsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [incidentsResult, statsResult] = await Promise.all([
    getIncidentsAction({ page: 1, pageSize: 20 }),
    getIncidentStatsAction(),
  ]);

  const incidents = ("data" in incidentsResult ? incidentsResult.data : null) ?? [];
  const pagination = ("pagination" in incidentsResult ? incidentsResult.pagination : null) ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 };
  const stats = ("data" in statsResult ? statsResult.data : null) ?? {
    total: 0,
    byStatus: {
      reported: 0,
      investigating: 0,
      actionTaken: 0,
      resolved: 0,
      escalated: 0,
      dismissed: 0,
    },
    byCategory: {
      curfewViolation: 0,
      propertyDamage: 0,
      bullying: 0,
      fighting: 0,
      unauthorizedAbsence: 0,
      substanceAbuse: 0,
      theft: 0,
      noiseDisturbance: 0,
      healthEmergency: 0,
      safetyHazard: 0,
      other: 0,
    },
    bySeverity: {
      minor: 0,
      moderate: 0,
      major: 0,
      critical: 0,
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boarding Incidents"
        description="Report, track, and manage boarding house incidents."
        actions={
          <Link
            href="/boarding/incidents/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Report Incident
          </Link>
        }
      />
      <IncidentsClient
        incidents={incidents}
        pagination={pagination}
        stats={stats}
      />
    </div>
  );
}
