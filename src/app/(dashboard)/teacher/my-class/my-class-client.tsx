"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────

interface AttendanceSummary {
  totalDays: number;
  avgPresent: number;
}

interface ClassDashboard {
  classArmId: string;
  classArmName: string;
  className: string;
  yearGroup: number;
  academicYearId: string;
  currentTermId: string | null;
  currentTermName: string | null;
  studentCount: number;
  attendanceSummary: AttendanceSummary;
  draftMarksCount: number;
  submittedMarksCount: number;
  resultsComputed: number | boolean;
  atRiskCount: number;
  conductPending: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

function getAttendancePercent(summary: AttendanceSummary): string {
  if (summary.totalDays === 0) return "N/A";
  return `${Math.round((summary.avgPresent / summary.totalDays) * 100)}%`;
}

// ─── Stat Card ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  iconBg,
  icon,
}: {
  label: string;
  value: string | number;
  iconBg: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Action ───────────────────────────────────────────────────

function QuickAction({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="mt-1 text-xs text-muted-foreground">{description}</span>
    </Link>
  );
}

// ─── Icons (inline SVG) ─────────────────────────────────────────────

function UsersIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-emerald-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-amber-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-red-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-purple-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────────

export function MyClassClient({
  dashboardData,
  error,
}: {
  dashboardData: ClassDashboard[];
  error?: string;
}) {
  const [data] = useState(dashboardData);

  // ─── Error state ──────────────────────────────────────────────────

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <UsersIcon />
        </div>
        <h3 className="text-lg font-semibold">No Class Assigned</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          You have not been assigned as a class teacher for any class this term.
          Contact your administrator if this is incorrect.
        </p>
      </div>
    );
  }

  // ─── Dashboard ────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {data.map((cls) => (
        <div key={cls.classArmId} className="space-y-6">
          {/* Header */}
          <div className="rounded-xl border border-border bg-card px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {cls.className} - {cls.classArmName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Year Group {cls.yearGroup} &middot; {cls.currentTermName}
                </p>
              </div>
              {cls.resultsComputed && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  Results Computed
                </span>
              )}
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              label="Students"
              value={cls.studentCount}
              iconBg="bg-blue-100"
              icon={<UsersIcon />}
            />
            <StatCard
              label="Attendance %"
              value={getAttendancePercent(cls.attendanceSummary)}
              iconBg="bg-emerald-100"
              icon={<CheckCircleIcon />}
            />
            <StatCard
              label="Draft Marks"
              value={cls.draftMarksCount}
              iconBg="bg-amber-100"
              icon={<PencilIcon />}
            />
            <StatCard
              label="Submitted Marks"
              value={cls.submittedMarksCount}
              iconBg="bg-blue-100"
              icon={<ClipboardIcon />}
            />
            <StatCard
              label="At Risk"
              value={cls.atRiskCount}
              iconBg="bg-red-100"
              icon={<AlertIcon />}
            />
            <StatCard
              label="Conduct Pending"
              value={cls.conductPending}
              iconBg="bg-purple-100"
              icon={<ShieldIcon />}
            />
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <QuickAction
                href="/attendance/take"
                label="Take Attendance"
                description="Record daily attendance for your class"
              />
              <QuickAction
                href="/academics/assessments/mark-entry"
                label="Enter Marks"
                description="Enter assessment marks and scores"
              />
              <QuickAction
                href="/academics/conduct"
                label="Enter Conduct"
                description="Record student conduct and remarks"
              />
              <QuickAction
                href="/academics/results"
                label="View Results"
                description="View computed terminal results"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
