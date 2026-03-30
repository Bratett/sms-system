"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createDocumentAction,
  deleteDocumentAction,
  archiveDocumentAction,
} from "@/modules/documents/actions/document.action";

// ─── Types ──────────────────────────────────────────────────────────

interface DocumentRow {
  id: string;
  title: string;
  description: string | null;
  fileKey: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  category: string;
  tags: unknown;
  entityType: string | null;
  entityId: string | null;
  accessLevel: string;
  createdAt: Date | string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

const CATEGORIES = [
  "ACADEMIC",
  "ADMINISTRATIVE",
  "FINANCIAL",
  "MEDICAL",
  "LEGAL",
  "HR",
  "OTHER",
] as const;

const ACCESS_LEVELS = ["PUBLIC", "INTERNAL", "RESTRICTED", "CONFIDENTIAL"] as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: Date | string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────

export function DocumentsClient({
  documents,
  pagination,
  filters,
}: {
  documents: DocumentRow[];
  pagination: Pagination;
  filters: { category?: string; search?: string };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  // Filter state
  const [search, setSearch] = useState(filters.search ?? "");
  const [categoryFilter, setCategoryFilter] = useState(filters.category ?? "");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileKey, setFileKey] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [contentType, setContentType] = useState("");
  const [category, setCategory] = useState<string>("OTHER");
  const [accessLevel, setAccessLevel] = useState<string>("INTERNAL");

  const { page, pageSize, total, totalPages } = pagination;

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryFilter) params.set("category", categoryFilter);
    startTransition(() => {
      router.push(`/documents?${params.toString()}`);
    });
  }

  function resetFilters() {
    setSearch("");
    setCategoryFilter("");
    startTransition(() => {
      router.push("/documents");
    });
  }

  function openCreate() {
    setTitle("");
    setDescription("");
    setFileKey("");
    setFileName("");
    setFileSize(0);
    setContentType("");
    setCategory("OTHER");
    setAccessLevel("INTERNAL");
    setShowForm(true);
  }

  async function handleSubmit() {
    const res = await createDocumentAction({
      title,
      description: description || undefined,
      fileKey,
      fileName,
      fileSize,
      contentType,
      category,
      accessLevel,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Document uploaded successfully");
    setShowForm(false);
    startTransition(() => router.refresh());
  }

  async function handleArchive(id: string) {
    const res = await archiveDocumentAction(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Document archived successfully");
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this document? This action cannot be undone.")) return;
    const res = await deleteDocumentAction(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Document deleted successfully");
    startTransition(() => router.refresh());
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryFilter) params.set("category", categoryFilter);
    params.set("page", String(p));
    startTransition(() => {
      router.push(`/documents?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Document title..."
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <button onClick={applyFilters} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Filter
        </button>
        <button onClick={resetFilters} className="h-9 rounded-md border px-4 text-sm font-medium">
          Reset
        </button>
        <div className="ml-auto">
          <button onClick={openCreate} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Upload Document
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-left font-medium">File Name</th>
              <th className="px-4 py-3 text-left font-medium">Size</th>
              <th className="px-4 py-3 text-left font-medium">Content Type</th>
              <th className="px-4 py-3 text-left font-medium">Access Level</th>
              <th className="px-4 py-3 text-left font-medium">Created At</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No documents found.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{doc.title}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {doc.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">{doc.fileName}</td>
                  <td className="px-4 py-3">{formatFileSize(doc.fileSize)}</td>
                  <td className="px-4 py-3">{doc.contentType}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {doc.accessLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDate(doc.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleArchive(doc.id)} className="text-sm text-yellow-600 hover:underline">
                        Archive
                      </button>
                      <button onClick={() => handleDelete(doc.id)} className="text-sm text-red-600 hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="h-8 rounded-md border px-3 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="h-8 rounded-md border px-3 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Upload Document</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">File Key *</label>
                <input
                  type="text"
                  value={fileKey}
                  onChange={(e) => setFileKey(e.target.value)}
                  placeholder="Placeholder for upload integration"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">File Name *</label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">File Size (bytes) *</label>
                  <input
                    type="number"
                    value={fileSize}
                    onChange={(e) => setFileSize(parseInt(e.target.value) || 0)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Content Type *</label>
                <input
                  type="text"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  placeholder="e.g. application/pdf"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Access Level</label>
                  <select
                    value={accessLevel}
                    onChange={(e) => setAccessLevel(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {ACCESS_LEVELS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="h-9 rounded-md border px-4 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title || !fileKey || !fileName || !contentType}
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
