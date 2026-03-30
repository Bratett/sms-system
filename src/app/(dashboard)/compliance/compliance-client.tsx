"use client";

import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────

interface ConsentEntry {
  type: string;
  granted: boolean;
  grantedAt: string | Date | null;
  revokedAt: string | Date | null;
  version: string | null;
}

interface ExportRequest {
  id: string;
  status: string;
  [key: string]: unknown;
}

interface DeletionRequest {
  id: string;
  status: string;
  [key: string]: unknown;
}

interface ComplianceClientProps {
  consentStatus: ConsentEntry[];
  exportRequests: ExportRequest[];
  deletionRequests: DeletionRequest[];
}

// ─── Component ─────────────────────────────────────────────────────

export function ComplianceClient({
  consentStatus,
  exportRequests,
  deletionRequests,
}: ComplianceClientProps) {
  const grantedCount = consentStatus.filter((c) => c.granted).length;
  const totalConsent = consentStatus.length;

  const pendingExports = exportRequests.filter(
    (r) => r.status === "PENDING"
  ).length;
  const pendingDeletions = deletionRequests.filter(
    (r) => r.status === "PENDING"
  ).length;
  const totalPendingRights = pendingExports + pendingDeletions;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Consent summary */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">
            Consent Status
          </h3>
          <p className="mt-2 text-2xl font-bold">
            {grantedCount} / {totalConsent}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            consent types granted
          </p>
        </div>

        {/* Pending data rights */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">
            Pending Data Rights
          </h3>
          <p className="mt-2 text-2xl font-bold">{totalPendingRights}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pendingExports} export, {pendingDeletions} deletion
          </p>
        </div>

        {/* Export requests total */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">
            Total Export Requests
          </h3>
          <p className="mt-2 text-2xl font-bold">{exportRequests.length}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            all time requests
          </p>
        </div>
      </div>

      {/* Quick-link cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/compliance/consent"
          className="group rounded-lg border bg-card p-6 shadow-sm transition-colors hover:bg-accent"
        >
          <h3 className="text-lg font-semibold group-hover:underline">
            Consent Management
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage consent toggles for data processing, marketing,
            photos, third-party sharing, and analytics.
          </p>
        </Link>

        <Link
          href="/compliance/data-rights"
          className="group rounded-lg border bg-card p-6 shadow-sm transition-colors hover:bg-accent"
        >
          <h3 className="text-lg font-semibold group-hover:underline">
            Data Rights
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Handle data export requests, deletion requests, privacy policies,
            and retention rules.
          </p>
        </Link>
      </div>

      {/* Recent consent status */}
      {consentStatus.length > 0 && (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">Current Consent Status</h3>
          </div>
          <div className="divide-y">
            {consentStatus.map((entry) => (
              <div
                key={entry.type}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm font-medium">
                  {formatConsentType(entry.type)}
                </span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    entry.granted
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {entry.granted ? "Granted" : "Not Granted"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatConsentType(type: string) {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
