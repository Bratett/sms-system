"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateConsentAction } from "@/modules/compliance/actions/consent.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ConsentEntry {
  type: string;
  granted: boolean;
  grantedAt: string | Date | null;
  revokedAt: string | Date | null;
  version: string | null;
}

interface AuditEntry {
  type?: string;
  consentType?: string;
  action?: string;
  granted?: boolean;
  date?: string | Date;
  createdAt?: string | Date;
  version?: string | null;
  [key: string]: unknown;
}

interface ConsentClientProps {
  consentStatus: ConsentEntry[];
  auditTrail: AuditEntry[];
  auditTotal: number;
  auditPage: number;
  auditPageSize: number;
}

// ─── Constants ─────────────────────────────────────────────────────

const CONSENT_TYPES = [
  "DATA_PROCESSING",
  "MARKETING_COMMUNICATIONS",
  "PHOTO_VIDEO",
  "THIRD_PARTY_SHARING",
  "ANALYTICS_TRACKING",
] as const;

const CONSENT_LABELS: Record<string, string> = {
  DATA_PROCESSING: "Data Processing",
  MARKETING_COMMUNICATIONS: "Marketing Communications",
  PHOTO_VIDEO: "Photo & Video",
  THIRD_PARTY_SHARING: "Third-Party Sharing",
  ANALYTICS_TRACKING: "Analytics Tracking",
};

// ─── Component ─────────────────────────────────────────────────────

export function ConsentClient({
  consentStatus,
  auditTrail,
  auditTotal,
  auditPage,
  auditPageSize,
}: ConsentClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [togglingType, setTogglingType] = useState<string | null>(null);

  const consentMap = new Map(consentStatus.map((c) => [c.type, c]));
  const totalPages = Math.ceil(auditTotal / auditPageSize);

  async function handleToggle(consentType: string, currentGranted: boolean) {
    setTogglingType(consentType);
    const result = await updateConsentAction({
      consentType,
      granted: !currentGranted,
    });
    setTogglingType(null);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `${CONSENT_LABELS[consentType] ?? consentType} ${!currentGranted ? "granted" : "revoked"}`
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-8">
      {/* Consent Toggles */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Consent Toggles</h3>
        </div>
        <div className="divide-y">
          {CONSENT_TYPES.map((type) => {
            const entry = consentMap.get(type);
            const granted = entry?.granted ?? false;
            const isToggling = togglingType === type;

            return (
              <div
                key={type}
                className="flex items-center justify-between px-4 py-4"
              >
                <div>
                  <p className="font-medium">{CONSENT_LABELS[type]}</p>
                  <p className="text-sm text-muted-foreground">
                    {granted ? "Currently granted" : "Not granted"}
                    {entry?.version && ` (v${entry.version})`}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={granted}
                  disabled={isToggling || isPending}
                  onClick={() => handleToggle(type, granted)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                    granted ? "bg-primary" : "bg-input"
                  }`}
                >
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                      granted ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit Trail */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Audit Trail</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Action</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {auditTrail.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No audit records found.
                  </td>
                </tr>
              ) : (
                auditTrail.map((entry, idx) => {
                  const type = entry.consentType ?? entry.type ?? "-";
                  const isGranted = entry.granted ?? entry.action === "Granted";
                  const date = entry.createdAt ?? entry.date;

                  return (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="px-4 py-2">
                        {CONSENT_LABELS[type] ?? formatConsentType(type)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            isGranted
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {isGranted ? "Granted" : "Revoked"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {date ? formatDate(date) : "-"}
                      </td>
                      <td className="px-4 py-2">
                        {entry.version ?? "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {auditPage} of {totalPages} ({auditTotal} records)
            </p>
            <div className="flex gap-2">
              <button
                disabled={auditPage <= 1 || isPending}
                onClick={() =>
                  startTransition(() =>
                    router.push(
                      `/compliance/consent?page=${auditPage - 1}`
                    )
                  )
                }
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={auditPage >= totalPages || isPending}
                onClick={() =>
                  startTransition(() =>
                    router.push(
                      `/compliance/consent?page=${auditPage + 1}`
                    )
                  )
                }
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
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

function formatDate(dateStr: string | Date) {
  return new Date(dateStr).toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
