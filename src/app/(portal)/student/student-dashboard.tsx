"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";

interface StudentData {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  gender: string;
  dateOfBirth: Date;
  photoUrl: string | null;
  boardingStatus: string;
  status: string;
  currentClass: {
    classArmId: string;
    className: string;
    armName: string;
    yearGroup: number;
  } | null;
  feeBalance: number;
  recentResult: {
    termName: string;
    academicYearName: string;
    averageScore: number | null;
    classPosition: number | null;
    overallGrade: string | null;
  } | null;
  attendanceRate: number | null;
}

interface StudentDashboardProps {
  data: StudentData | null;
  error: string | null;
}

export function StudentDashboard({ data, error }: StudentDashboardProps) {
  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Student Dashboard" />
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">Account Not Linked</h3>
          <p className="mt-1 text-sm text-gray-500">
            {error || "Your account has not been linked to a student record. Please contact the school administration."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${data.firstName}`}
        description="Your academic dashboard and student information."
      />

      {/* Profile Card */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-5 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-teal-600 text-2xl font-semibold text-white">
              {data.firstName.charAt(0)}
              {data.lastName.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {data.firstName} {data.lastName}
                {data.otherNames ? ` ${data.otherNames}` : ""}
              </h2>
              <p className="text-sm text-gray-600">{data.studentId}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <StatusBadge status={data.status} />
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    data.boardingStatus === "BOARDING"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {data.boardingStatus === "BOARDING" ? "Boarding" : "Day"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-xs text-gray-500">Current Class</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {data.currentClass
                ? `${data.currentClass.className} ${data.currentClass.armName}`
                : "N/A"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Year Group</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {data.currentClass ? `Year ${data.currentClass.yearGroup}` : "N/A"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Fee Balance</p>
            <p
              className={`mt-1 text-lg font-bold ${
                data.feeBalance > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              GHS {data.feeBalance.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Attendance</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {data.attendanceRate !== null ? `${data.attendanceRate}%` : "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Recent Results Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recent Results</h3>
            <Link href="/student/results" className="text-xs font-medium text-teal-600 hover:text-teal-700">
              View All
            </Link>
          </div>
          {data.recentResult ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                {data.recentResult.termName} - {data.recentResult.academicYearName}
              </p>
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-xs text-gray-500">Average</p>
                  <p className="text-2xl font-bold text-teal-600">
                    {data.recentResult.averageScore?.toFixed(1) ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Grade</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.recentResult.overallGrade ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Position</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.recentResult.classPosition
                      ? `${data.recentResult.classPosition}${getOrdinalSuffix(data.recentResult.classPosition)}`
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No results available yet.</p>
          )}
        </div>

        {/* Fee Status Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Fee Status</h3>
          </div>
          <div>
            <p className="text-xs text-gray-500">Outstanding Balance</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                data.feeBalance > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              GHS {data.feeBalance.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              {data.feeBalance > 0
                ? "Please ensure timely payment of outstanding fees."
                : "All fees are up to date."}
            </p>
          </div>
        </div>

        {/* Quick Links Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Quick Links</h3>
          <div className="space-y-2">
            <Link
              href="/student/results"
              className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700"
            >
              <span className="mr-3 text-teal-500">&#8250;</span>
              View My Results
            </Link>
            <Link
              href="/student/timetable"
              className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700"
            >
              <span className="mr-3 text-teal-500">&#8250;</span>
              My Timetable
            </Link>
            {data.boardingStatus === "BOARDING" && (
              <Link
                href="/student/exeat"
                className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700"
              >
                <span className="mr-3 text-teal-500">&#8250;</span>
                Exeat Requests
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
