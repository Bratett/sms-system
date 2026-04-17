"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  createBookAction,
  updateBookAction,
  deleteBookAction,
} from "@/modules/library/actions/library.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Book {
  id: string;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  publicationYear: number | null;
  category: string | null;
  shelfLocation: string | null;
  totalCopies: number;
  availableCopies: number;
  coverImageUrl: string | null;
  status: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function BooksClient({
  books,
  total,
  page,
  pageSize,
  filters,
}: {
  books: Book[];
  total: number;
  page: number;
  pageSize: number;
  filters: { search?: string; category?: string; status?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const [search, setSearch] = useState(filters.search ?? "");
  const [category, setCategory] = useState(filters.category ?? "");
  const [status, setStatus] = useState(filters.status ?? "");

  // Book form
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [bookForm, setBookForm] = useState({
    isbn: "",
    title: "",
    author: "",
    publisher: "",
    publicationYear: "",
    category: "",
    shelfLocation: "",
    totalCopies: 1,
    coverImageUrl: "",
  });

  const totalPages = Math.ceil(total / pageSize);

  // ─── Filters ────────────────────────────────────────────────────

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    router.push(`/library/books?${params.toString()}`);
  }

  function clearFilters() {
    setSearch("");
    setCategory("");
    setStatus("");
    router.push("/library/books");
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    params.set("page", String(p));
    router.push(`/library/books?${params.toString()}`);
  }

  // ─── CRUD ───────────────────────────────────────────────────────

  function openForm(book?: Book) {
    if (book) {
      setEditingBook(book);
      setBookForm({
        isbn: book.isbn ?? "",
        title: book.title,
        author: book.author,
        publisher: book.publisher ?? "",
        publicationYear: book.publicationYear?.toString() ?? "",
        category: book.category ?? "",
        shelfLocation: book.shelfLocation ?? "",
        totalCopies: book.totalCopies,
        coverImageUrl: book.coverImageUrl ?? "",
      });
    } else {
      setEditingBook(null);
      setBookForm({
        isbn: "",
        title: "",
        author: "",
        publisher: "",
        publicationYear: "",
        category: "",
        shelfLocation: "",
        totalCopies: 1,
        coverImageUrl: "",
      });
    }
    setShowForm(true);
  }

  function handleSave() {
    if (!bookForm.title.trim()) {
      toast.error("Book title is required.");
      return;
    }
    if (!bookForm.author.trim()) {
      toast.error("Author is required.");
      return;
    }

    startTransition(async () => {
      const payload = {
        isbn: bookForm.isbn || undefined,
        title: bookForm.title,
        author: bookForm.author,
        publisher: bookForm.publisher || undefined,
        publicationYear: bookForm.publicationYear
          ? parseInt(bookForm.publicationYear)
          : undefined,
        category: bookForm.category || undefined,
        shelfLocation: bookForm.shelfLocation || undefined,
        totalCopies: bookForm.totalCopies,
        coverImageUrl: bookForm.coverImageUrl || undefined,
      };

      if (editingBook) {
        const result = await updateBookAction(editingBook.id, payload);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Book updated successfully.");
      } else {
        const result = await createBookAction(payload);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Book created successfully.");
      }
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(book: Book) {
    if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deleteBookAction(book.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Book deleted successfully.");
      router.refresh();
    });
  }

  // ─── Status Badge ───────────────────────────────────────────────

  function statusBadge(s: string) {
    switch (s) {
      case "AVAILABLE":
        return (
          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
            Available
          </span>
        );
      case "LOW_STOCK":
        return (
          <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
            Low Stock
          </span>
        );
      case "OUT_OF_STOCK":
        return (
          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
            Out of Stock
          </span>
        );
      case "ARCHIVED":
        return (
          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-950 dark:text-gray-400">
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-950 dark:text-gray-400">
            {s}
          </span>
        );
    }
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Title, author, ISBN..."
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Category..."
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <button
          onClick={applyFilters}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filter
        </button>
        <button
          onClick={clearFilters}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          Clear
        </button>
        <div className="ml-auto">
          <button
            onClick={() => openForm()}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Book
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Author</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">ISBN</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Shelf</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Available</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {books.map((book) => (
              <tr key={book.id}>
                <td className="px-4 py-3 text-sm font-medium">
                  <Link href={`/library/books/${book.id}`} className="text-primary hover:underline">
                    {book.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm">{book.author}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{book.isbn ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{book.category ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{book.shelfLocation ?? "-"}</td>
                <td className="px-4 py-3 text-right text-sm">{book.totalCopies}</td>
                <td className="px-4 py-3 text-right text-sm font-medium">{book.availableCopies}</td>
                <td className="px-4 py-3 text-sm">{statusBadge(book.status)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openForm(book)}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(book)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {books.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No books found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} books
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`rounded-md px-3 py-1 text-sm ${
                    p === page
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-accent"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Book Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editingBook ? "Edit Book" : "New Book"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Title *</label>
                <input
                  type="text"
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Book title"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Author *</label>
                <input
                  type="text"
                  value={bookForm.author}
                  onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Author name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">ISBN</label>
                <input
                  type="text"
                  value={bookForm.isbn}
                  onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="ISBN"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Publisher</label>
                <input
                  type="text"
                  value={bookForm.publisher}
                  onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Publisher"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Publication Year</label>
                <input
                  type="number"
                  value={bookForm.publicationYear}
                  onChange={(e) => setBookForm({ ...bookForm, publicationYear: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Year"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Category</label>
                <input
                  type="text"
                  value={bookForm.category}
                  onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Category"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Shelf Location</label>
                <input
                  type="text"
                  value={bookForm.shelfLocation}
                  onChange={(e) => setBookForm({ ...bookForm, shelfLocation: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. A-12"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Total Copies</label>
                <input
                  type="number"
                  value={bookForm.totalCopies}
                  onChange={(e) => setBookForm({ ...bookForm, totalCopies: parseInt(e.target.value) || 1 })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  min="1"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Cover Image URL</label>
                <input
                  type="text"
                  value={bookForm.coverImageUrl}
                  onChange={(e) => setBookForm({ ...bookForm, coverImageUrl: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : editingBook ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
