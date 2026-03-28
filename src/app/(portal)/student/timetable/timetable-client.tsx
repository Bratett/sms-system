"use client";

import { PageHeader } from "@/components/layout/page-header";

export function TimetableClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Timetable"
        description="View your class schedule and timetable."
      />

      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
          <svg
            className="h-8 w-8 text-teal-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Coming Soon</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          The timetable feature is currently under development. You will be able to view your weekly
          class schedule, including subjects, teachers, and room assignments.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          Please check with your class teacher for your current timetable.
        </p>
      </div>
    </div>
  );
}
