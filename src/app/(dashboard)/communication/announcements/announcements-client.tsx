"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAnnouncementAction,
  publishAnnouncementAction,
  archiveAnnouncementAction,
  deleteAnnouncementAction,
} from "@/modules/communication/actions/announcement.action";

// ─── Types ──────────────────────────────────────────────────────────

interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  targetType: string;
  priority: string;
  status: string;
  publishedAt: Date | string | null;
  expiresAt: Date | string | null;
  createdByName: string;
  createdAt: Date | string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

function getPriorityBadge(priority: string) {
  const map: Record<string, string> = {
    low: "bg-gray-100 text-gray-700",
    normal: "bg-blue-100 text-blue-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
  };
  return map[priority] || map.normal;
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    PUBLISHED: "bg-green-100 text-green-700",
    ARCHIVED: "bg-yellow-100 text-yellow-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

function formatDate(dateStr: string | Date | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────

export function AnnouncementsClient({
  announcements: initialAnnouncements,
  pagination,
}: {
  announcements: AnnouncementRow[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [announcements] = useState<AnnouncementRow[]>(initialAnnouncements);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [form, setForm] = useState({
    title: "",
    content: "",
    targetType: "all",
    priority: "normal",
    expiresAt: "",
  });

  // ─── Handlers ─────────────────────────────────────────────────────

  function openForm() {
    setForm({
      title: "",
      content: "",
      targetType: "all",
      priority: "normal",
      expiresAt: "",
    });
    setShowForm(true);
  }

  function handleCreate() {
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!form.content.trim()) {
      toast.error("Content is required.");
      return;
    }

    startTransition(async () => {
      const result = await createAnnouncementAction({
        title: form.title,
        content: form.content,
        targetType: form.targetType,
        priority: form.priority,
        expiresAt: form.expiresAt || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Announcement created as draft.");
      setShowForm(false);
      router.refresh();
    });
  }

  function handlePublish(id: string) {
    startTransition(async () => {
      const result = await publishAnnouncementAction(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Announcement published.");
      router.refresh();
    });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      const result = await archiveAnnouncementAction(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Announcement archived.");
      router.refresh();
    });
  }

  function handleDelete(announcement: AnnouncementRow) {
    if (!confirm(`Delete announcement "${announcement.title}"?`)) return;

    startTransition(async () => {
      const result = await deleteAnnouncementAction(announcement.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Announcement deleted.");
      router.refresh();
    });
  }

  // ─── Filter ───────────────────────────────────────────────────────

  const filtered = announcements.filter((a) => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return a.title.toLowerCase().includes(term) || a.content.toLowerCase().includes(term);
    }
    return true;
  });

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search announcements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <button
          onClick={openForm}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Announcement
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Priority
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Target
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Created By
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {filtered.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{a.content}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getPriorityBadge(a.priority)}`}
                  >
                    {a.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(a.status)}`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm capitalize text-muted-foreground">
                  {a.targetType}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{a.createdByName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(a.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {a.status === "DRAFT" && (
                      <>
                        <button
                          onClick={() => handlePublish(a.id)}
                          disabled={isPending}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Publish
                        </button>
                        <button
                          onClick={() => handleDelete(a)}
                          disabled={isPending}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {a.status === "PUBLISHED" && (
                      <button
                        onClick={() => handleArchive(a.id)}
                        disabled={isPending}
                        className="text-xs text-yellow-600 hover:underline"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No announcements found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination info */}
      {pagination.total > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {pagination.total} announcements
        </p>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Announcement</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Announcement title"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Content *</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={5}
                  placeholder="Announcement content..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Target</label>
                  <select
                    value={form.targetType}
                    onChange={(e) => setForm({ ...form, targetType: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">All</option>
                    <option value="class">By Class</option>
                    <option value="programme">By Programme</option>
                    <option value="house">By House</option>
                    <option value="specific">Specific</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Expires At</label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                onClick={handleCreate}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
