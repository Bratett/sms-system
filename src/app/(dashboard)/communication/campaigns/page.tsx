import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { listCampaignsAction } from "@/modules/communication/actions/campaign.action";
import { CampaignsClient } from "./campaigns-client";

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await listCampaignsAction();
  const campaigns = "data" in result ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled Campaigns"
        description="Schedule bulk notifications to go out at a future time. Dispatch runs once per minute in the background."
      />
      <CampaignsClient campaigns={campaigns as never} />
    </div>
  );
}
