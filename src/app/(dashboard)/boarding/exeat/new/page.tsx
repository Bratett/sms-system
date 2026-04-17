import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { ExeatForm } from "./exeat-form";
import Link from "next/link";

export default async function NewExeatPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const termsResult = await getTermsAction();
  const terms = "data" in termsResult ? termsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Exeat Request"
        description="Create a new exeat request for a boarding student."
        actions={
          <Link
            href="/boarding/exeat"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Exeats
          </Link>
        }
      />
      <ExeatForm terms={terms} />
    </div>
  );
}
