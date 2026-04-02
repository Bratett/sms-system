import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getBookAction } from "@/modules/library/actions/library.action";
import { BookDetailClient } from "./book-detail-client";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const { id } = await params;
  const bookResult = await getBookAction(id);

  if ("error" in bookResult || !("data" in bookResult) || !bookResult.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Book Not Found" description="The requested book could not be found." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={bookResult.data.title}
        description={`By ${bookResult.data.author}`}
      />
      <BookDetailClient book={bookResult.data} />
    </div>
  );
}
