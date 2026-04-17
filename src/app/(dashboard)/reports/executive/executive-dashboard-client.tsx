"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import {
  TrendLineChart,
  AttendancePieChart,
  ClassPerformanceBar,
} from "@/components/shared/executive-charts";

interface DashboardData {
  generatedAt: string;
  kpis: {
    totalStudents: number;
    boardingStudents: number;
    dayStudents: number;
    totalStaff: number;
    attendanceRate: number;
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    collectionRate: number;
    paymentsYtdCount: number;
    paymentsYtdAmount: number;
    admissionsSubmitted: number;
    admissionsUnderReview: number;
    admissionsAccepted: number;
    openDiscipline: number;
    pendingMarks: number;
    activeDunningCases: number;
    inventoryOutOfStock: number;
  };
  trends: {
    enrolments: Array<{ month: string; count: number }>;
    revenue: Array<{ month: string; amount: number }>;
    attendanceByStatus: Array<{ status: string; count: number }>;
  };
  drilldowns: {
    topDebtors: Array<{
      studentId: string;
      studentCode: string;
      name: string;
      className: string;
      balance: number;
    }>;
    classPerformance: Array<{
      classArmId: string;
      className: string;
      students: number;
      averageScore: number;
    }>;
    riskDistribution: Array<{ level: string; count: number }>;
  };
}

function money(n: number): string {
  return `GHS ${n.toLocaleString("en-GH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function ExecutiveDashboardClient({ data }: { data: DashboardData }) {
  const k = data.kpis;
  const t = useTranslations("reports");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("executive")}
        description={t("snapshotFootnote", {
          time: new Date(data.generatedAt).toLocaleString("en-GH"),
        })}
      />

      {/* KPI tiles */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label={t("activeStudents")}
          value={k.totalStudents.toString()}
          sub={t("boardingDaySplit", { boarding: k.boardingStudents, day: k.dayStudents })}
        />
        <Tile label={t("activeStaff")} value={k.totalStaff.toString()} sub={t("teachersAdmin")} />
        <Tile
          label={t("attendanceRate")}
          value={`${k.attendanceRate}%`}
          tone={k.attendanceRate >= 90 ? "good" : k.attendanceRate >= 75 ? "neutral" : "bad"}
          sub={t("trailing12m")}
        />
        <Tile
          label={t("collectionRate")}
          value={`${k.collectionRate}%`}
          tone={k.collectionRate >= 80 ? "good" : k.collectionRate >= 60 ? "neutral" : "bad"}
          sub={t("paidOfBilled", {
            paid: money(k.totalPaid),
            billed: money(k.totalBilled),
          })}
        />
        <Tile
          label={t("outstandingBalances")}
          value={money(k.totalOutstanding)}
          tone={k.totalOutstanding > 0 ? "neutral" : "good"}
          sub={t("acrossAllTerms")}
        />
        <Tile
          label={t("paymentsYtd")}
          value={money(k.paymentsYtdAmount)}
          sub={t("transactionsCount", { count: k.paymentsYtdCount })}
        />
        <Tile
          label={t("admissionsPipeline")}
          value={(k.admissionsSubmitted + k.admissionsUnderReview).toString()}
          sub={t("admissionsAcceptedCount", { count: k.admissionsAccepted })}
        />
        <Tile
          label={t("openDiscipline")}
          value={k.openDiscipline.toString()}
          tone={k.openDiscipline > 10 ? "bad" : k.openDiscipline > 0 ? "neutral" : "good"}
          sub={t("underInvestigation")}
        />
        <Tile
          label={t("pendingMarks")}
          value={k.pendingMarks.toString()}
          sub={t("awaitingHodApproval")}
        />
        <Tile
          label={t("activeDunning")}
          value={k.activeDunningCases.toString()}
          tone={k.activeDunningCases > 0 ? "neutral" : "good"}
          sub={t("escalatedArrears")}
        />
        <Tile
          label={t("stockAlerts")}
          value={k.inventoryOutOfStock.toString()}
          tone={k.inventoryOutOfStock > 0 ? "bad" : "good"}
          sub={t("itemsOutOfStock")}
        />
      </section>

      {/* Trend charts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("enrolmentsTrend")}>
          <TrendLineChart
            data={data.trends.enrolments}
            valueKey="count"
            label={t("newEnrolments")}
            color="#0ea5e9"
          />
        </ChartCard>
        <ChartCard title={t("revenueTrend")}>
          <TrendLineChart
            data={data.trends.revenue}
            valueKey="amount"
            label={t("revenueGhs")}
            color="#059669"
            format="currency"
          />
        </ChartCard>
        <ChartCard title={t("attendanceDistribution")}>
          <AttendancePieChart data={data.trends.attendanceByStatus} />
        </ChartCard>
        <ChartCard title={t("classArmAverage")}>
          <ClassPerformanceBar data={data.drilldowns.classPerformance} />
        </ChartCard>
      </section>

      {/* Drilldowns */}
      <section className="grid gap-4 lg:grid-cols-2">
        <DrillCard title={t("topDebtors")}>
          {data.drilldowns.topDebtors.length === 0 ? (
            <Placeholder>{t("noOutstandingBalances")}</Placeholder>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-1.5">{t("studentHeader")}</th>
                  <th className="p-1.5">{t("classHeader")}</th>
                  <th className="p-1.5 text-right">{t("balanceHeader")}</th>
                </tr>
              </thead>
              <tbody>
                {data.drilldowns.topDebtors.map((d) => (
                  <tr key={d.studentId} className="border-t">
                    <td className="p-1.5">
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {d.studentCode}
                      </span>
                      {d.name}
                    </td>
                    <td className="p-1.5">{d.className}</td>
                    <td className="p-1.5 text-right font-semibold">{money(d.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DrillCard>

        <DrillCard title={t("riskDistribution")}>
          {data.drilldowns.riskDistribution.length === 0 ? (
            <Placeholder>{t("noRiskProfiles")}</Placeholder>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center">
              {data.drilldowns.riskDistribution.map((r) => (
                <div key={r.level} className="rounded border p-3">
                  <p className="text-xs uppercase text-muted-foreground">{r.level}</p>
                  <p className="mt-1 text-2xl font-semibold">{r.count}</p>
                </div>
              ))}
            </div>
          )}
        </DrillCard>
      </section>

      <p className="text-xs text-muted-foreground">
        {t.rich("footnote", {
          link: (chunks) => (
            <a className="underline" href="/reports">
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "neutral" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "bad"
        ? "border-red-200 bg-red-50"
        : tone === "neutral"
          ? "border-amber-200 bg-amber-50"
          : "bg-card";
  return (
    <div className={`rounded border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function DrillCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
