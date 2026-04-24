import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getMyExcuseRequestsAction,
} from "@/modules/parent-requests/actions/excuse.action";
import {
  getMyMedicalDisclosuresAction,
} from "@/modules/parent-requests/actions/medical-disclosure.action";
import { RequestsClient } from "./requests-client";

export default async function ParentRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [excuses, disclosures] = await Promise.all([
    getMyExcuseRequestsAction(),
    getMyMedicalDisclosuresAction(),
  ]);

  if ("error" in excuses) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {excuses.error}
        </div>
      </div>
    );
  }
  if ("error" in disclosures) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {disclosures.error}
        </div>
      </div>
    );
  }

  return <RequestsClient excuses={excuses.data as never} disclosures={disclosures.data as never} />;
}
