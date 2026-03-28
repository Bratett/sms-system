"use client";

import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────

interface ComprehensiveReport {
  enrollment: {
    total: number;
    male: number;
    female: number;
    boarding: number;
    day: number;
  };
  staff: { total: number };
  academics: {
    averageScore: number;
    passRate: number;
    studentsWithResults: number;
  } | null;
  finance: {
    totalBilled: number;
    totalCollected: number;
    collectionRate: number;
  } | null;
  discipline: {
    totalIncidents: number;
    openIncidents: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ──────────────────────────────────────────────────────

export function ReportsClient({ report }: { report: ComprehensiveReport | null }) {
  if (!report) {
    return (
      <p className="text-sm text-muted-foreground">Unable to load report data.</p>
    );
  }

  const reportCategories = [
    {
      title: "Academic Reports",
      description: "Class averages, subject performance, and pass rates",
      href: "/reports/academic",
      icon: (
        <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      title: "Attendance Reports",
      description: "Attendance rates by class, gender, and trends",
      href: "/reports/attendance",
      icon: (
        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "Enrollment Reports",
      description: "Student demographics, gender and programme distribution",
      href: "/reports/enrollment",
      icon: (
        <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      title: "Finance Reports",
      description: "Billing, collections, and arrears summaries",
      href: "/finance/reports",
      icon: (
        <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Enrollment */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Total Students</p>
          <p className="mt-2 text-3xl font-bold">{report.enrollment.total}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{report.enrollment.male} Male</span>
            <span>{report.enrollment.female} Female</span>
          </div>
        </div>

        {/* Staff */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Total Staff</p>
          <p className="mt-2 text-3xl font-bold">{report.staff.total}</p>
        </div>

        {/* Academics */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Academic Performance</p>
          {report.academics ? (
            <>
              <p className="mt-2 text-3xl font-bold">{report.academics.averageScore}%</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pass Rate: {report.academics.passRate}%
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No data yet</p>
          )}
        </div>

        {/* Finance */}
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Fee Collection</p>
          {report.finance ? (
            <>
              <p className="mt-2 text-3xl font-bold">{report.finance.collectionRate}%</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCurrency(report.finance.totalCollected)} of {formatCurrency(report.finance.totalBilled)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No data yet</p>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Boarding vs Day</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Boarding</span>
              <span className="font-medium">{report.enrollment.boarding}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{
                  width: `${report.enrollment.total > 0 ? (report.enrollment.boarding / report.enrollment.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Day</span>
              <span className="font-medium">{report.enrollment.day}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Gender Distribution</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Male</span>
              <span className="font-medium">{report.enrollment.male}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{
                  width: `${report.enrollment.total > 0 ? (report.enrollment.male / report.enrollment.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Female</span>
              <span className="font-medium">{report.enrollment.female}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Discipline</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Total Incidents</span>
              <span className="font-medium">{report.discipline.totalIncidents}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Open Cases</span>
              <span className="font-medium text-orange-600">{report.discipline.openIncidents}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Report Categories */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Detailed Reports</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reportCategories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className="group rounded-lg border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/50"
            >
              <div className="mb-3">{cat.icon}</div>
              <h4 className="text-sm font-semibold group-hover:text-primary">{cat.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
