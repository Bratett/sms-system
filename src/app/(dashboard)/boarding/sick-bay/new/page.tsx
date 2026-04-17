import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getHostelsAction } from "@/modules/boarding/actions/hostel.action";
import { SickBayForm } from "./sick-bay-form";
import Link from "next/link";

export default async function NewSickBayAdmissionPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const hostelsResult = await getHostelsAction();
  const hostels = "data" in hostelsResult ? hostelsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admit Student to Sick Bay"
        description="Record a new sick bay admission for a boarding student."
        actions={
          <Link
            href="/boarding/sick-bay"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Sick Bay
          </Link>
        }
      />
      <SickBayForm hostels={hostels} />
    </div>
  );
}
