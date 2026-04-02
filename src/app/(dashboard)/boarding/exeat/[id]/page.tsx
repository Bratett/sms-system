import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getExeatAction } from "@/modules/boarding/actions/exeat.action";
import { ExeatDetail } from "./exeat-detail";
import Link from "next/link";

export default async function ExeatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const { id } = await params;
  const result = await getExeatAction(id);

  if ("error" in result) {
    return (
      <div className="space-y-6">
        <PageHeader title="Exeat Not Found" />
        <p className="text-muted-foreground">
          {result.error || "The exeat record could not be found."}
        </p>
        <Link
          href="/boarding/exeat"
          className="text-primary hover:underline text-sm"
        >
          Back to Exeats
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Exeat ${result.data.exeatNumber}`}
        description="View exeat details, approvals, and tracking information."
        actions={
          <Link
            href="/boarding/exeat"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Exeats
          </Link>
        }
      />
      <ExeatDetail exeat={result.data} />
    </div>
  );
}
