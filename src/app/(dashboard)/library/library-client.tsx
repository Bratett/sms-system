"use client";

import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────

interface LibraryStats {
  totalBooks: number;
  availableBooks: number;
  issuedCount: number;
  overdueCount: number;
  digitalResourcesCount: number;
}

// ─── Component ──────────────────────────────────────────────────────

export function LibraryClient({ stats }: { stats: LibraryStats }) {
  const statCards = [
    { label: "Total Books", value: stats.totalBooks, href: "/library/books" },
    { label: "Available", value: stats.availableBooks, href: "/library/books?status=AVAILABLE" },
    { label: "Issued", value: stats.issuedCount, href: "/library/books?status=OUT_OF_STOCK" },
    { label: "Overdue", value: stats.overdueCount, href: "/library/overdue", highlight: stats.overdueCount > 0 },
    { label: "Digital Resources", value: stats.digitalResourcesCount, href: "/library/resources" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-lg border bg-card p-6 transition-colors hover:bg-accent"
          >
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.highlight ? "text-red-600" : ""}`}>
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/library/books"
              className="rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <h3 className="font-medium">Books</h3>
              <p className="mt-1 text-xs text-muted-foreground">Browse and manage book catalog</p>
            </Link>
            <Link
              href="/library/overdue"
              className="rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <h3 className="font-medium">Overdue</h3>
              <p className="mt-1 text-xs text-muted-foreground">View overdue book issues</p>
            </Link>
            <Link
              href="/library/resources"
              className="rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <h3 className="font-medium">Digital Resources</h3>
              <p className="mt-1 text-xs text-muted-foreground">Manage digital library content</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
