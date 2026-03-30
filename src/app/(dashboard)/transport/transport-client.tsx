"use client";

import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────

interface TransportStats {
  totalVehicles: number;
  activeRoutes: number;
  assignedStudents: number;
  totalCapacity: number;
  availableCapacity: number;
}

// ─── Component ──────────────────────────────────────────────────────

export function TransportClient({ stats }: { stats: TransportStats | null }) {
  const cards = [
    { label: "Total Vehicles", value: stats?.totalVehicles ?? 0 },
    { label: "Active Routes", value: stats?.activeRoutes ?? 0 },
    { label: "Assigned Students", value: stats?.assignedStudents ?? 0 },
    { label: "Total Capacity", value: stats?.totalCapacity ?? 0 },
    { label: "Available Capacity", value: stats?.availableCapacity ?? 0 },
  ];

  const quickLinks = [
    { title: "Vehicles", description: "Manage fleet vehicles", href: "/transport/vehicles" },
    { title: "Routes", description: "Manage transport routes", href: "/transport/routes" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border bg-card p-6 transition-colors hover:bg-accent"
          >
            <h3 className="font-semibold">{link.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
