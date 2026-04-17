"use client";

import { useEffect, useState } from "react";
import { getMedicalRecordsAction } from "@/modules/student/actions/medical.action";

interface MedicalRecord {
  id: string;
  date: Date;
  type: string;
  title: string;
  description: string;
  treatment: string | null;
  followUpDate: Date | null;
  isConfidential: boolean;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function StudentHealthSection({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await getMedicalRecordsAction({ studentId, pageSize: 20 });
      if (cancelled) return;
      if ("error" in res) {
        setError(res.error as string);
        setLoading(false);
        return;
      }
      setRecords((res.data ?? []) as unknown as MedicalRecord[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading health records…</div>;
  }
  if (error) {
    return <div className="py-12 text-center text-sm text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Medical Records</h3>
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No medical records on file.</p>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{r.title}</p>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {r.type}
                    </span>
                    {r.isConfidential && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                        Confidential
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.date)}</p>
                </div>
                {r.followUpDate && (
                  <p className="text-xs text-muted-foreground">
                    Follow-up: {formatDate(r.followUpDate)}
                  </p>
                )}
              </div>
              <p className="mt-2 text-sm">{r.description}</p>
              {r.treatment && (
                <p className="mt-2 text-sm">
                  <span className="font-medium">Treatment:</span>{" "}
                  <span className="text-muted-foreground">{r.treatment}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
