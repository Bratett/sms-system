import Link from "next/link";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; name?: string }>;
}) {
  const params = await searchParams;
  const applicationNumber = params.ref ?? "N/A";
  const applicantName = params.name ?? "";

  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center max-w-xl mx-auto">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <svg
          className="h-8 w-8 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
      {applicantName && (
        <p className="text-muted-foreground mb-4">
          Thank you, the application for <strong>{applicantName}</strong> has been received.
        </p>
      )}

      <div className="my-6 rounded-lg bg-muted p-4">
        <p className="text-sm text-muted-foreground mb-1">Your Application Reference Number</p>
        <p className="text-2xl font-mono font-bold text-primary">{applicationNumber}</p>
      </div>

      <div className="text-sm text-muted-foreground space-y-2 mb-6">
        <p>Please save this reference number. You will need it to check the status of your application.</p>
        <p>A confirmation message will be sent to the guardian&apos;s phone number provided.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/apply/status"
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Check Application Status
        </Link>
        <Link
          href="/apply"
          className="rounded-md border border-border px-6 py-2 text-sm font-medium hover:bg-accent"
        >
          Submit Another Application
        </Link>
      </div>
    </div>
  );
}
