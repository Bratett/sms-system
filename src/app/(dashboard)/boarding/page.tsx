import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getHostelsAction } from "@/modules/boarding/actions/hostel.action";
import { getOccupancyReportAction } from "@/modules/boarding/actions/allocation.action";
import { getOverdueExeatsAction, getExeatStatsAction } from "@/modules/boarding/actions/exeat.action";
import Link from "next/link";

export default async function BoardingPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [hostelsResult, occupancyResult, overdueResult, exeatStatsResult] = await Promise.all([
    getHostelsAction(),
    getOccupancyReportAction(),
    getOverdueExeatsAction(),
    getExeatStatsAction(),
  ]);

  const hostels = hostelsResult.data ?? [];
  const occupancy = occupancyResult.data ?? [];
  const overdueExeats = overdueResult.data ?? [];
  const exeatStats = exeatStatsResult.data ?? {
    total: 0,
    requested: 0,
    housemasterApproved: 0,
    headmasterApproved: 0,
    rejected: 0,
    departed: 0,
    returned: 0,
    overdue: 0,
    cancelled: 0,
  };

  const totalBeds = occupancy.reduce((sum, o) => sum + o.totalBeds, 0);
  const totalOccupied = occupancy.reduce((sum, o) => sum + o.occupiedBeds, 0);
  const totalAvailable = occupancy.reduce((sum, o) => sum + o.availableBeds, 0);
  const overallOccupancy = totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boarding"
        description="Overview of boarding facilities, exeats, and roll calls."
      />

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Hostels</p>
          <p className="mt-1 text-2xl font-bold">{hostels.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Beds</p>
          <p className="mt-1 text-2xl font-bold">{totalBeds}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Occupied Beds</p>
          <p className="mt-1 text-2xl font-bold">
            {totalOccupied}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({overallOccupancy}%)
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Available Beds</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{totalAvailable}</p>
        </div>
      </div>

      {/* Occupancy Per Hostel */}
      {occupancy.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Hostel Occupancy</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {occupancy.map((o) => (
              <div key={o.hostelId} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{o.hostelName}</h4>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.gender === "MALE"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-pink-100 text-pink-700"
                    }`}
                  >
                    {o.gender}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>
                    {o.occupiedBeds}/{o.totalBeds} beds
                  </span>
                  <span>{o.occupancyPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      o.occupancyPercent >= 90
                        ? "bg-red-500"
                        : o.occupancyPercent >= 70
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${o.occupancyPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {o.availableBeds} available
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Exeats Alert */}
      {overdueExeats.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-red-700">
              Overdue Exeats ({overdueExeats.length})
            </h3>
            <Link
              href="/boarding/exeat?status=DEPARTED"
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              View All
            </Link>
          </div>
          <div className="space-y-2">
            {overdueExeats.slice(0, 5).map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-md bg-white p-3 border border-red-100"
              >
                <div>
                  <p className="text-sm font-medium">{e.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.exeatNumber} - {e.studentNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-red-600">
                    {e.daysOverdue} day{e.daysOverdue !== 1 ? "s" : ""} overdue
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expected: {new Date(e.expectedReturnDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exeat Summary */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Exeat Summary</h3>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-yellow-600">Pending Requests</p>
            <p className="text-xl font-bold">{exeatStats.requested}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-orange-600">Currently Departed</p>
            <p className="text-xl font-bold">{exeatStats.departed}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-green-600">Returned</p>
            <p className="text-xl font-bold">{exeatStats.returned}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 border-red-200">
            <p className="text-xs text-red-600">Overdue</p>
            <p className="text-xl font-bold text-red-600">{exeatStats.overdue}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/boarding/hostels"
            className="rounded-lg border border-border bg-card p-6 hover:bg-muted/30 transition-colors"
          >
            <h4 className="font-semibold">Manage Hostels</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Add hostels, dormitories, and beds.
            </p>
          </Link>
          <Link
            href="/boarding/allocations"
            className="rounded-lg border border-border bg-card p-6 hover:bg-muted/30 transition-colors"
          >
            <h4 className="font-semibold">Bed Allocations</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Allocate students to beds.
            </p>
          </Link>
          <Link
            href="/boarding/exeat"
            className="rounded-lg border border-border bg-card p-6 hover:bg-muted/30 transition-colors"
          >
            <h4 className="font-semibold">Exeat Management</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage exeat requests and approvals.
            </p>
          </Link>
          <Link
            href="/boarding/roll-call"
            className="rounded-lg border border-border bg-card p-6 hover:bg-muted/30 transition-colors"
          >
            <h4 className="font-semibold">Roll Call</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Conduct morning and evening roll calls.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
