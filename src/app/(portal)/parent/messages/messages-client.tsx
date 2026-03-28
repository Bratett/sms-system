"use client";

import { PageHeader } from "@/components/layout/page-header";

export function MessagesClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Communicate with teachers and school administration."
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
              d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Coming Soon</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          Parent-teacher messaging is currently being developed. You will be able to communicate
          directly with your child&apos;s teachers and school administration from this page.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          In the meantime, please contact the school directly for any inquiries.
        </p>
      </div>
    </div>
  );
}
