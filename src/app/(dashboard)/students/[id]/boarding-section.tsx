"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStudentVisitHistoryAction } from "@/modules/boarding/actions/visitor.action";
import { getStudentTransferHistoryAction } from "@/modules/boarding/actions/transfer.action";

interface Visit {
  id: string;
  hostelName: string;
  visitorName: string;
  relationship: string;
  purpose: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  status: string;
}

interface Transfer {
  id: string;
  transferNumber: string;
  fromDormitoryName: string;
  fromBedNumber: string;
  toDormitoryName: string;
  toBedNumber: string;
  reason: string;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
}

function formatDateTime(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function StudentBoardingSection({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [visitRes, transferRes] = await Promise.all([
        getStudentVisitHistoryAction(studentId),
        getStudentTransferHistoryAction(studentId),
      ]);
      if (cancelled) return;
      if ("error" in visitRes) {
        setError(visitRes.error as string);
        setLoading(false);
        return;
      }
      if ("error" in transferRes) {
        setError(transferRes.error as string);
        setLoading(false);
        return;
      }
      setVisits((visitRes.data ?? []) as unknown as Visit[]);
      setTransfers((transferRes.data ?? []) as unknown as Transfer[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading boarding data…</div>;
  }
  if (error) {
    return <div className="py-12 text-center text-sm text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Visit history */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Visit History</h3>
        {visits.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No visits recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Visitor</th>
                  <th className="px-3 py-2 font-medium">Relationship</th>
                  <th className="px-3 py-2 font-medium">Purpose</th>
                  <th className="px-3 py-2 font-medium">Check-in</th>
                  <th className="px-3 py-2 font-medium">Check-out</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visits.slice(0, 10).map((v) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="px-3 py-2">{v.visitorName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{v.relationship}</td>
                    <td className="px-3 py-2 text-muted-foreground">{v.purpose}</td>
                    <td className="px-3 py-2">{formatDateTime(v.checkInAt)}</td>
                    <td className="px-3 py-2">{formatDateTime(v.checkOutAt)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={v.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer history */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Bed Transfer History</h3>
        {transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No transfers recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Transfer #</th>
                  <th className="px-3 py-2 font-medium">From</th>
                  <th className="px-3 py-2 font-medium">To</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Requested</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.slice(0, 10).map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{t.transferNumber}</td>
                    <td className="px-3 py-2">
                      {t.fromDormitoryName} / {t.fromBedNumber}
                    </td>
                    <td className="px-3 py-2">
                      {t.toDormitoryName} / {t.toBedNumber}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{t.reason}</td>
                    <td className="px-3 py-2">{formatDate(t.requestedAt)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
