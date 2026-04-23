"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSiblingsAction } from "@/modules/student/actions/sibling.action";

interface Sibling {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  classArmName: string | null;
  programmeName: string | null;
}

export function StudentSiblingsSection({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(true);
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [hasHousehold, setHasHousehold] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await getSiblingsAction(studentId);
      if (cancelled) return;
      if ("error" in res) {
        setSiblings([]);
        setLoading(false);
        return;
      }
      setSiblings(res.data);
      // Empty data with success status can mean either no household or no siblings in household.
      // We can't distinguish without additional server data, so default to assuming they have
      // a household when data is non-empty, and unknown when empty.
      setHasHousehold(res.data.length > 0 ? true : null);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold mb-2">Siblings</h3>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold mb-2">Siblings</h3>
      {siblings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasHousehold === true
            ? "No siblings in household"
            : "Not assigned to a household"}
        </p>
      ) : (
        <ul className="space-y-2">
          {siblings.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-sm">
              <Link href={`/students/${s.id}`} className="hover:underline">
                {s.firstName} {s.lastName}
              </Link>
              <span className="text-xs text-muted-foreground">
                {s.studentId}
                {s.classArmName ? ` • ${s.classArmName}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
