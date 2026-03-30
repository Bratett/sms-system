import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getLibraryStatsAction } from "@/modules/library/actions/library.action";
import { LibraryClient } from "./library-client";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const statsResult = await getLibraryStatsAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Library"
        description="Manage books, issues, and digital resources."
      />
      <LibraryClient
        stats={statsResult.data ?? {
          totalBooks: 0,
          availableBooks: 0,
          issuedCount: 0,
          overdueCount: 0,
          digitalResourcesCount: 0,
        }}
      />
    </div>
  );
}
