import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getReleaseQueueAction } from "@/modules/academics/release/actions/release.action";
import { ReleaseClient } from "./release-client";

export default async function ResultsReleasePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const res = await getReleaseQueueAction();
  if ("error" in res) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {res.error}
        </div>
      </div>
    );
  }

  // When no current term exists the action returns { data: [] }
  if (Array.isArray(res.data)) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          No current term is set. Please configure a current term before releasing report cards.
        </div>
      </div>
    );
  }

  return (
    <ReleaseClient
      initialTermId={res.data.termId}
      initialRows={res.data.rows as never}
    />
  );
}
