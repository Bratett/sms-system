"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";

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

interface ChildrenClientProps {
  students: ChildData[];
}

export function ChildrenClient({ students }: ChildrenClientProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Children"
        description="View details of your children enrolled at the school."
      />

      {students.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">No Children Found</h3>
          <p className="mt-1 text-sm text-gray-500">
            No student records have been linked to your account.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {students.map((child) => (
            <div
              key={child.id}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xl font-semibold text-white">
                    {child.firstName.charAt(0)}
                    {child.lastName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {child.firstName} {child.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">{child.studentId}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={child.status} />
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          child.boardingStatus === "BOARDING"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {child.boardingStatus === "BOARDING" ? "Boarding" : "Day"}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {child.gender}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center sm:gap-6">
                  <div>
                    <p className="text-xs text-gray-500">Class</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      {child.currentClass
                        ? `${child.currentClass.className} ${child.currentClass.armName}`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Fee Balance</p>
                    <p
                      className={`mt-0.5 text-sm font-semibold ${
                        child.feeBalance > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      GHS {child.feeBalance.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Attendance</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      {child.attendanceRate !== null ? `${child.attendanceRate}%` : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                <Link
                  href={`/parent/results?studentId=${child.id}`}
                  className="rounded-md bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
                >
                  View Results
                </Link>
                <Link
                  href={`/parent/fees?studentId=${child.id}`}
                  className="rounded-md bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
                >
                  View Fees
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
