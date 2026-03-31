"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getApplicationsAction,
  enrollApplicationAction,
} from "@/modules/admissions/actions/admission.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Application {
  id: string;
  applicantName?: string;
  firstName?: string;
  lastName?: string;
  programme?: string;
  programmeName?: string;
  status: string;
}

interface ClassArmOption {
  id: string;
  label: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function PlacementClient({
  applications: initialApplications,
  total: initialTotal,
  page: initialPage,
  pageSize: initialPageSize,
  classArmOptions = [],
}: {
  applications: Application[];
  total: number;
  page: number;
  pageSize: number;
  classArmOptions: ClassArmOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [applications, setApplications] = useState<Application[]>(initialApplications);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);

  // Placement modal
  const [placingApp, setPlacingApp] = useState<Application | null>(null);
  const [classArmId, setClassArmId] = useState("");

  const totalPages = Math.ceil(total / pageSize);

  function fetchApplications(newPage: number) {
    startTransition(async () => {
      const result = await getApplicationsAction({
        status: "ACCEPTED",
        page: newPage,
        pageSize,
      });
      if (result.data) {
        setApplications(result.data.applications ?? []);
        setTotal(result.data.total ?? 0);
        setPage(result.data.page ?? 1);
      }
    });
  }

  function getApplicantName(app: Application): string {
    if (app.applicantName) return app.applicantName;
    if (app.firstName || app.lastName) return `${app.firstName ?? ""} ${app.lastName ?? ""}`.trim();
    return "Unknown";
  }

  function getProgramme(app: Application): string {
    return app.programme || app.programmeName || "-";
  }

  function handlePlace() {
    if (!placingApp || !classArmId) {
      toast.error("Please select a class arm.");
      return;
    }

    startTransition(async () => {
      const result = await enrollApplicationAction(placingApp.id, classArmId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Student placed successfully.");
        setPlacingApp(null);
        setClassArmId("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Applicant Name</th>
                <th className="px-4 py-3 text-left font-medium">Programme</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No approved applications awaiting placement.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{getApplicantName(app)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{getProgramme(app)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        {app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setPlacingApp(app);
                          setClassArmId("");
                        }}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Place
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchApplications(page - 1)}
            disabled={page <= 1 || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => fetchApplications(page + 1)}
            disabled={page >= totalPages || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Next
          </button>
        </div>
      )}

      {/* Placement Modal */}
      {placingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">
              Place Student: {getApplicantName(placingApp)}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Class Arm <span className="text-destructive">*</span>
                </label>
                <select
                  value={classArmId}
                  onChange={(e) => setClassArmId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select class arm</option>
                  {classArmOptions.map((ca) => (
                    <option key={ca.id} value={ca.id}>
                      {ca.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setPlacingApp(null)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handlePlace}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Placing..." : "Confirm Placement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
