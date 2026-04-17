import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getHostelsAction } from "@/modules/boarding/actions/hostel.action";
import { RollCallClient } from "./roll-call-client";

export default async function RollCallPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const hostelsResult = await getHostelsAction();
  const hostels = ("data" in hostelsResult ? hostelsResult.data : []).map((h: { id: string; name: string; gender: string }) => ({
    id: h.id,
    name: h.name,
    gender: h.gender,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roll Call"
        description="Conduct morning and evening roll calls for boarding students."
      />
      <RollCallClient hostels={hostels} />
    </div>
  );
}
