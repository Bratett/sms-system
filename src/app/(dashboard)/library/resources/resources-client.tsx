"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createDigitalResourceAction,
  deleteDigitalResourceAction,
} from "@/modules/library/actions/library.action";

// ─── Types ──────────────────────────────────────────────────────────

interface DigitalResource {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileUrl: string;
  category: string | null;
  accessLevel: string | null;
}

// ─── Component ──────────────────────────────────────────────────────

export function ResourcesClient({
  resources,
  total,
  page,
  pageSize,
  filters,
}: {
  resources: DigitalResource[];
  total: number;
  page: number;
  pageSize: number;
  filters: { search?: string; category?: string; type?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const [search, setSearch] = useState(filters.search ?? "");
  const [category, setCategory] = useState(filters.category ?? "");
  const [type, setType] = useState(filters.type ?? "");

  // Resource form
  const [showForm, setShowForm] = useState(false);
  const [resourceForm, setResourceForm] = useState({
    title: "",
    description: "",
    type: "DOCUMENT",
    fileUrl: "",
    category: "",
    accessLevel: "PUBLIC",
  });

  const totalPages = Math.ceil(total / pageSize);

  // ─── Filters ────────────────────────────────────────────────────

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (type) params.set("type", type);
    router.push(`/library/resources?${params.toString()}`);
  }

  function clearFilters() {
    setSearch("");
    setCategory("");
    setType("");
    router.push("/library/resources");
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (type) params.set("type", type);
    params.set("page", String(p));
    router.push(`/library/resources?${params.toString()}`);
  }

  // ─── CRUD ───────────────────────────────────────────────────────

  function openForm() {
    setResourceForm({
      title: "",
      description: "",
      type: "DOCUMENT",
      fileUrl: "",
      category: "",
      accessLevel: "PUBLIC",
    });
    setShowForm(true);
  }

  function handleSave() {
    if (!resourceForm.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!resourceForm.fileUrl.trim()) {
      toast.error("File URL is required.");
      return;
    }

    startTransition(async () => {
      const result = await createDigitalResourceAction({
        title: resourceForm.title,
        description: resourceForm.description || undefined,
        type: (resourceForm.type || undefined) as "DOCUMENT" | "VIDEO" | "AUDIO" | "EBOOK" | "LINK" | undefined,
        fileUrl: resourceForm.fileUrl,
        category: resourceForm.category || undefined,
        accessLevel: resourceForm.accessLevel || undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Resource created successfully.");
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(resource: DigitalResource) {
    if (!confirm(`Delete "${resource.title}"? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deleteDigitalResourceAction(resource.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Resource deleted successfully.");
      router.refresh();
    });
  }

  // ─── Type Badge ─────────────────────────────────────────────────

  function typeBadge(t: string) {
    const colors: Record<string, string> = {
      DOCUMENT: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
      VIDEO: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
      AUDIO: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
      EBOOK: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
      LINK: "bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-400",
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[t] ?? colors.LINK}`}>
        {t}
      </span>
    );
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
            placeholder="Title..."
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
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="DOCUMENT">Document</option>
            <option value="VIDEO">Video</option>
            <option value="AUDIO">Audio</option>
            <option value="EBOOK">eBook</option>
            <option value="LINK">Link</option>
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
            onClick={openForm}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Resource
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Access Level</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {resources.map((resource) => (
              <tr key={resource.id}>
                <td className="px-4 py-3 text-sm font-medium">
                  <a
                    href={resource.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {resource.title}
                  </a>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-sm text-muted-foreground">
                  {resource.description ?? "-"}
                </td>
                <td className="px-4 py-3 text-sm">{typeBadge(resource.type)}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{resource.category ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{resource.accessLevel ?? "-"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(resource)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {resources.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No digital resources found.
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
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} resources
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

      {/* Resource Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Digital Resource</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Title *</label>
                <input
                  type="text"
                  value={resourceForm.title}
                  onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Resource title"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  value={resourceForm.description}
                  onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Type</label>
                  <select
                    value={resourceForm.type}
                    onChange={(e) => setResourceForm({ ...resourceForm, type: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="DOCUMENT">Document</option>
                    <option value="VIDEO">Video</option>
                    <option value="AUDIO">Audio</option>
                    <option value="EBOOK">eBook</option>
                    <option value="LINK">Link</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Access Level</label>
                  <select
                    value={resourceForm.accessLevel}
                    onChange={(e) => setResourceForm({ ...resourceForm, accessLevel: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="STUDENTS">Students Only</option>
                    <option value="STAFF">Staff Only</option>
                    <option value="RESTRICTED">Restricted</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">File URL *</label>
                <input
                  type="text"
                  value={resourceForm.fileUrl}
                  onChange={(e) => setResourceForm({ ...resourceForm, fileUrl: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Category</label>
                <input
                  type="text"
                  value={resourceForm.category}
                  onChange={(e) => setResourceForm({ ...resourceForm, category: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Category"
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
                {isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
