import { getPendingMedicalDisclosuresAction } from "@/modules/parent-requests/actions/medical-disclosure.action";
import { MedicalDisclosuresClient } from "./medical-disclosures-client";

export default async function MedicalDisclosuresPage() {
  const res = await getPendingMedicalDisclosuresAction();
  if ("error" in res) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {res.error}
        </div>
      </div>
    );
  }
  return <MedicalDisclosuresClient rows={res.data as never} />;
}
