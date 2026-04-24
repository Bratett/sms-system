import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPendingExcuseRequestsAction } from "@/modules/parent-requests/actions/excuse.action";
import { ExcuseReviewsClient } from "./excuse-reviews-client";

export default async function StaffExcuseReviewsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const res = await getPendingExcuseRequestsAction();
  if ("error" in res) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {res.error}
        </div>
      </div>
    );
  }
  return <ExcuseReviewsClient rows={res.data as never} />;
}
