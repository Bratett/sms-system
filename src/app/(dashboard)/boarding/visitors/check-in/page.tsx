import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getHostelsAction } from "@/modules/boarding/actions/hostel.action";
import Link from "next/link";
import { VisitorCheckInForm } from "./check-in-form";

export default async function CheckInVisitorPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const hostelsResult = await getHostelsAction();
  const hostels = "data" in hostelsResult ? hostelsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check In Visitor"
        description="Register a new visitor for a boarding student."
        actions={
          <Link
            href="/boarding/visitors"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Visitors
          </Link>
        }
      />
      <VisitorCheckInForm hostels={hostels} />
    </div>
  );
}
