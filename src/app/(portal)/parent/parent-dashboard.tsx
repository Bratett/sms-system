"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";

interface ChildData {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gender: string;
  photoUrl: string | null;
  boardingStatus: string;
  status: string;
  isPrimary: boolean;
  currentClass: {
    classArmId: string;
    className: string;
    armName: string;
    yearGroup: number;
  } | null;
  feeBalance: number;
  attendanceRate: number | null;
}

interface ParentDashboardProps {
  students: ChildData[];
  userName: string;
}

export function ParentDashboard({ students, userName }: ParentDashboardProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${userName}`}
        description="View your children's academic progress, fees, and more."
      />

      {students.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">No Children Linked</h3>
          <p className="mt-1 text-sm text-gray-500">
            Your account has not been linked to any student records yet. Please contact the school
            administration.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((child) => (
            <div
              key={child.id}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="border-b border-gray-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-lg font-semibold text-white">
                    {child.firstName.charAt(0)}
                    {child.lastName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-gray-900">
                      {child.firstName} {child.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">{child.studentId}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 px-5 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Class</span>
                  <span className="font-medium text-gray-900">
                    {child.currentClass
                      ? `${child.currentClass.className} ${child.currentClass.armName}`
                      : "Not enrolled"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Boarding</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      child.boardingStatus === "BOARDING"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {child.boardingStatus === "BOARDING" ? "Boarding" : "Day"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Fee Balance</span>
                  <span
                    className={`font-medium ${
                      child.feeBalance > 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    GHS {child.feeBalance.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Attendance</span>
                  <span className="font-medium text-gray-900">
                    {child.attendanceRate !== null ? `${child.attendanceRate}%` : "N/A"}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 px-5 py-3">
                <div className="flex gap-2">
                  <Link
                    href={`/parent/results?studentId=${child.id}`}
                    className="flex-1 rounded-md bg-teal-50 px-3 py-1.5 text-center text-xs font-medium text-teal-700 hover:bg-teal-100"
                  >
                    Results
                  </Link>
                  <Link
                    href={`/parent/fees?studentId=${child.id}`}
                    className="flex-1 rounded-md bg-teal-50 px-3 py-1.5 text-center text-xs font-medium text-teal-700 hover:bg-teal-100"
                  >
                    Fees
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
