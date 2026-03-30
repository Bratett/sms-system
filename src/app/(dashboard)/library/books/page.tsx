import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getBooksAction } from "@/modules/library/actions/library.action";
import { BooksClient } from "./books-client";

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const params = await searchParams;

  const booksResult = await getBooksAction({
    search: params.search,
    category: params.category,
    status: params.status,
    page: params.page ? parseInt(params.page) : 1,
    pageSize: 25,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Books"
        description="Browse and manage the book catalog."
      />
      <BooksClient
        books={booksResult.data ?? []}
        total={booksResult.total ?? 0}
        page={booksResult.page ?? 1}
        pageSize={booksResult.pageSize ?? 25}
        filters={params}
      />
    </div>
  );
}
