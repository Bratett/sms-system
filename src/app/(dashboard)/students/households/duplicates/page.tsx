import { scanGuardianDuplicatesAction } from "@/modules/student/actions/guardian-merge.action";
import { DuplicatesClient } from "./duplicates-client";

export default async function DuplicatesPage() {
  const result = await scanGuardianDuplicatesAction();
  if ("error" in result) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }

  return <DuplicatesClient clusters={result.data} />;
}
