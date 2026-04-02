import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAnnouncementsAction } from "@/modules/communication/actions/announcement.action";
import { AnnouncementsClient } from "./announcements-client";

export default async function AnnouncementsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getAnnouncementsAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Create and manage school announcements."
      />
      <AnnouncementsClient
        announcements={"data" in result ? result.data : []}
        pagination={"pagination" in result ? result.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 } : { page: 1, pageSize: 20, total: 0, totalPages: 0 }}
      />
    </div>
  );
}
