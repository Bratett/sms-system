export default function PortalLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div>
        <div className="h-7 w-44 animate-pulse rounded-md bg-gray-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded-md bg-gray-200" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            <div className="mt-3 h-7 w-14 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-3 w-28 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
