"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { getIncidentsAction } from "@/modules/discipline/actions/discipline.action";

interface Incident {
  id: string;
  date: Date;
  type: string;
  severity: string;
  description: string;
  sanction: string | null;
  status: string;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function StudentDisciplineSection({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await getIncidentsAction({ studentId, pageSize: 20 });
      if (cancelled) return;
      if ("error" in res) {
        setError(res.error as string);
        setLoading(false);
        return;
      }
      setIncidents((res.data ?? []) as unknown as Incident[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading discipline records…</div>;
  }
  if (error) {
    return <div className="py-12 text-center text-sm text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Disciplinary Incidents</h3>
        <Link
          href={`/discipline?studentId=${studentId}`}
          className="text-xs text-primary hover:underline"
        >
          View in Discipline →
        </Link>
      </div>
      {incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No incidents on record.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Sanction</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDate(i.date)}</td>
                  <td className="px-3 py-2">{i.type}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={i.severity} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">
                    {i.description}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{i.sanction ?? "—"}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={i.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
