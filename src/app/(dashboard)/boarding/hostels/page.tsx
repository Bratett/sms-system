import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getHostelsAction } from "@/modules/boarding/actions/hostel.action";
import { HostelsClient } from "./hostels-client";

export default async function HostelsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getHostelsAction();
  const hostels = "data" in result ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hostels"
        description="Manage hostels, dormitories, and beds."
      />
      <HostelsClient hostels={hostels} />
    </div>
  );
}
