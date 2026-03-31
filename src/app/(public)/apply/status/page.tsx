"use client";

import { useState, useTransition } from "react";
import { checkApplicationStatusAction } from "@/modules/admissions/actions/public-admission.action";
import { StatusBadge } from "@/components/shared/status-badge";

interface ApplicationStatus {
  applicationNumber: string;
  firstName: string;
  lastName: string;
  status: string;
  submittedAt: Date;
  reviewedAt: Date | null;
}

export default function StatusPage() {
  const [isPending, startTransition] = useTransition();
  const [applicationNumber, setApplicationNumber] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [result, setResult] = useState<ApplicationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    startTransition(async () => {
      const res = await checkApplicationStatusAction({
        applicationNumber: applicationNumber.trim(),
        guardianPhone: guardianPhone.trim(),
      });

      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setResult(res.data as ApplicationStatus);
      }
    });
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Check Application Status</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your application reference number and guardian phone to check your application status.
        </p>
      </div>

      <form onSubmit={handleCheck} className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Application Reference Number <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={applicationNumber}
            onChange={(e) => setApplicationNumber(e.target.value.toUpperCase())}
            className={inputClass}
            placeholder="e.g., APP/2026/0001"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Guardian Phone Number <span className="text-destructive">*</span>
          </label>
          <input
            type="tel"
            value={guardianPhone}
            onChange={(e) => setGuardianPhone(e.target.value)}
            className={inputClass}
            placeholder="e.g., 0241234567"
            required
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Checking..." : "Check Status"}
        </button>
      </form>

      {result && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Application Found</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Reference Number</dt>
              <dd className="font-mono font-medium">{result.applicationNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Applicant Name</dt>
              <dd className="font-medium">
                {result.firstName} {result.lastName}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={result.status} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Submitted</dt>
              <dd className="font-medium">
                {new Date(result.submittedAt).toLocaleDateString("en-GH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
            {result.reviewedAt && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Last Reviewed</dt>
                <dd className="font-medium">
                  {new Date(result.reviewedAt).toLocaleDateString("en-GH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="mt-6 text-center">
        <a href="/apply" className="text-sm text-primary hover:underline">
          Submit a new application
        </a>
      </div>
    </div>
  );
}
