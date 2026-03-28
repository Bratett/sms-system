import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ImportClient } from "./import-client";
import Link from "next/link";

export default async function ImportStudentsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Students"
        description="Bulk import students from a CSV file."
        actions={
          <Link
            href="/students"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to Students
          </Link>
        }
      />
      <ImportClient />
    </div>
  );
}
