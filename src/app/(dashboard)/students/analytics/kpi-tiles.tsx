"use client";

import Link from "next/link";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";

function Tile({ label, value, href, hint }: {
  label: string;
  value: string | number;
  href?: string;
  hint?: string;
}) {
  const card = (
    <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

export function KpiTiles({ kpis }: { kpis: StudentAnalyticsPayload["kpis"] }) {
  const atRiskDisplay = kpis.atRiskCount > 0 ? kpis.atRiskCount : "—";
  const transitions = kpis.graduatedThisYear + kpis.withdrawnThisYear;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Tile label="Total Active" value={kpis.totalActive} href="/students?status=ACTIVE" />
      <Tile label="Day" value={kpis.dayStudents} href="/students?status=ACTIVE&boardingStatus=DAY" />
      <Tile label="Boarding" value={kpis.boardingStudents} href="/students?status=ACTIVE&boardingStatus=BOARDING" />
      <Tile label="Free SHS" value={kpis.freeShsCount} />
      <Tile
        label="At-Risk"
        value={atRiskDisplay}
        hint={kpis.atRiskCount > 0 ? "HIGH + CRITICAL" : "No profiles computed"}
        href="/analytics"
      />
      <Tile
        label="Graduated / Withdrawn (yr)"
        value={transitions}
        hint={`${kpis.graduatedThisYear} grad · ${kpis.withdrawnThisYear} withdrawn`}
      />
    </div>
  );
}
