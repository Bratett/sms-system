"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  getAlumniEventListAction,
  publishAlumniEventAction,
  cancelAlumniEventAction,
} from "@/modules/alumni-events/actions/admin-events.action";
import { EventFormModal } from "./event-form-modal";

type Row = {
  id: string;
  title: string;
  startAt: Date | string;
  status: "DRAFT" | "PUBLISHED" | "CANCELED";
  capacity: number | null;
  yesCount: number;
  noCount: number;
  maybeCount: number;
  confirmedHeadcount: number;
  waitlistHeadcount: number;
  createdByUserId: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type StatusFilter = "all" | "DRAFT" | "PUBLISHED" | "CANCELED";

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventsListClient({
  initialRows,
  initialPagination,
}: {
  initialRows: Row[];
  initialPagination: Pagination;
}) {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [creatingNew, setCreatingNew] = useState(false);

  function load(page: number, status: StatusFilter = statusFilter) {
    start(async () => {
      const res = await getAlumniEventListAction({
        status: status === "all" ? undefined : status,
        page,
        pageSize: 20,
      });
      if ("data" in res) {
        setRows(res.data as Row[]);
        setPagination(res.pagination);
      }
    });
  }

  function handlePublish(id: string) {
    if (!window.confirm("Publish this event? This will email all alumni in the school.")) return;
    start(async () => {
      const res = await publishAlumniEventAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Event published.");
      load(pagination.page);
    });
  }

  function handleCancel(id: string) {
    if (!window.confirm("Cancel this event? Existing RSVPs will be preserved.")) return;
    start(async () => {
      const res = await cancelAlumniEventAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Event canceled.");
      load(pagination.page);
    });
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Alumni events</h1>
        <button
          onClick={() => setCreatingNew(true)}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm"
        >
          + New event
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "DRAFT", "PUBLISHED", "CANCELED"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              load(1, s);
            }}
            className={`px-3 py-1.5 rounded-full text-xs ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Start</th>
              <th className="p-3 text-left">YES</th>
              <th className="p-3 text-left">Headcount</th>
              <th className="p-3 text-left">Waitlist</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No alumni events. Click &quot;+ New event&quot; to create your first.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                  <td className="p-3">
                    <Link
                      href={`/graduation/alumni-events/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.status === "PUBLISHED"
                          ? "bg-green-100 text-green-800"
                          : r.status === "DRAFT"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3">{formatDate(r.startAt)}</td>
                  <td className="p-3">{r.yesCount}</td>
                  <td className="p-3">
                    {r.confirmedHeadcount}
                    {r.capacity ? ` / ${r.capacity}` : ""}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {r.waitlistHeadcount > 0 ? r.waitlistHeadcount : "—"}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    {r.status === "DRAFT" && (
                      <button
                        onClick={() => handlePublish(r.id)}
                        disabled={pending}
                        className="text-xs text-primary hover:underline"
                      >
                        Publish
                      </button>
                    )}
                    {r.status === "PUBLISHED" && (
                      <button
                        onClick={() => handleCancel(r.id)}
                        disabled={pending}
                        className="text-xs text-destructive hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => load(pagination.page - 1)}
              disabled={pagination.page <= 1 || pending}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => load(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || pending}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {creatingNew && (
        <EventFormModal
          mode="create"
          onClose={() => setCreatingNew(false)}
          onSaved={() => {
            setCreatingNew(false);
            load(pagination.page);
          }}
        />
      )}
    </div>
  );
}
