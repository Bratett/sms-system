import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getHostelsAction } from "@/modules/boarding/actions/hostel.action";
import { getAllocationsAction } from "@/modules/boarding/actions/allocation.action";
import { TransferRequestForm } from "./transfer-request-form";
import Link from "next/link";

export default async function NewTransferPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [hostelsResult, allocationsResult] = await Promise.all([
    getHostelsAction(),
    getAllocationsAction({ status: "ACTIVE" }),
  ]);

  const hostels = "data" in hostelsResult ? hostelsResult.data : [];
  const allocations = "data" in allocationsResult ? allocationsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request Bed Transfer"
        description="Create a new bed transfer request for a boarding student."
        actions={
          <Link
            href="/boarding/transfers"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Transfers
          </Link>
        }
      />
      <TransferRequestForm hostels={hostels} allocations={allocations} />
    </div>
  );
}
