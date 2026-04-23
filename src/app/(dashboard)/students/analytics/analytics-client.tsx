"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { KpiTiles } from "./kpi-tiles";
import { EnrollmentTrendChart } from "./enrollment-trend-chart";
import { DemographicsChart } from "./demographics-chart";
import { RetentionChart } from "./retention-chart";
import { FreeShsChart } from "./free-shs-chart";
import { AtRiskSection } from "./at-risk-section";

type Props = {
  academicYears: Array<{ id: string; name: string; isCurrent: boolean }>;
  programmes: Array<{ id: string; name: string }>;
  selectedAcademicYearId?: string;
  selectedProgrammeId?: string;
  payload: StudentAnalyticsPayload | null;
  error: string | null;
};

export function AnalyticsClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const activeYearId =
    props.selectedAcademicYearId ??
    props.academicYears.find((y) => y.isCurrent)?.id ??
    props.academicYears[0]?.id ??
    "";

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    start(() => router.replace(`/students/analytics?${params.toString()}`));
  };

  const handleRefresh = () => {
    start(() => router.refresh());
  };

  if (props.error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {props.error}
        </div>
      </div>
    );
  }

  if (!props.payload) {
    return null;
  }

  const p = props.payload;
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Student Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(p.computedAt).toLocaleString()} ·{" "}
            {p.cached ? "cached" : "fresh"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={activeYearId}
            onChange={(e) => updateFilter("academicYearId", e.target.value)}
            disabled={pending}
          >
            {props.academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}{y.isCurrent ? " (current)" : ""}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={props.selectedProgrammeId ?? ""}
            onChange={(e) => updateFilter("programmeId", e.target.value || undefined)}
            disabled={pending}
          >
            <option value="">All programmes</option>
            {props.programmes.map((pr) => (
              <option key={pr.id} value={pr.id}>{pr.name}</option>
            ))}
          </select>
          <button
            className="h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
            onClick={handleRefresh}
            disabled={pending}
          >
            Refresh
          </button>
        </div>
      </div>

      <KpiTiles kpis={p.kpis} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EnrollmentTrendChart
          data={p.enrollmentTrend}
          academicYearId={props.selectedAcademicYearId}
          programmeId={props.selectedProgrammeId}
        />
        <DemographicsChart
          demographics={p.demographics}
          academicYearId={props.selectedAcademicYearId}
          programmeId={props.selectedProgrammeId}
        />
        <RetentionChart
          retention={p.retention}
          academicYearId={props.selectedAcademicYearId}
          programmeId={props.selectedProgrammeId}
        />
        <FreeShsChart
          freeShs={p.freeShs}
          academicYearId={props.selectedAcademicYearId}
          programmeId={props.selectedProgrammeId}
        />
      </div>
      <AtRiskSection
        atRisk={p.atRisk}
        academicYearId={props.selectedAcademicYearId}
        programmeId={props.selectedProgrammeId}
      />
    </div>
  );
}
