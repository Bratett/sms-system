"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorCard } from "@/components/shared/error-card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <ErrorCard
      title="Something went wrong"
      message={error.message || "An unexpected error occurred. Please try again."}
      actions={
        <>
          <button
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Go home
          </Link>
        </>
      }
    />
  );
}
