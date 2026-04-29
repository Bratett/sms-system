"use client";

import { useState, useTransition } from "react";
import { getAlumniDashboardAction } from "@/modules/alumni/actions/alumni-admin.action";
import { AlumniEditModal } from "./alumni-edit-modal";

type Row = {
  id: string;
  studentId: string;
  graduationYear: number;
  email: string | null;
  phone: string | null;
  address: string | null;
  currentEmployer: string | null;
  currentPosition: string | null;
  industry: string | null;
  highestEducation: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  isPublic: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  firstName: string;
  lastName: string;
  studentCode: string;
  photoUrl: string | null;
  needsInvite: boolean;
  profileCompleteness: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Aggregates = {
  total: number;
  publicCount: number;
  privateCount: number;
  needsInviteCount: number;
  byYear: { year: number; count: number }[];
  topIndustries: { industry: string; count: number }[];
};

type StatusFilter = "all" | "public" | "private" | "incomplete" | "needs_invite";

function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function AlumniClient({
  initialRows,
  initialPagination,
  aggregates: initialAggregates,
}: {
  initialRows: Row[];
  initialPagination: Pagination;
  aggregates: Aggregates;
}) {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [aggregates, setAggregates] = useState<Aggregates>(initialAggregates);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<Row | null>(null);

  function load(page: number) {
    start(async () => {
      const res = await getAlumniDashboardAction({
        search: search || undefined,
        graduationYear: year ? Number(year) : undefined,
        industry: industry || undefined,
        status,
        page,
        pageSize: 20,
      });
      if ("data" in res) {
        setRows(res.data);
        setPagination(res.pagination);
        setAggregates(res.aggregates);
      }
    });
  }

  function applyStatus(s: StatusFilter) {
    setStatus(s);
    start(async () => {
      const res = await getAlumniDashboardAction({
        search: search || undefined,
        graduationYear: year ? Number(year) : undefined,
        industry: industry || undefined,
        status: s,
        page: 1,
        pageSize: 20,
      });
      if ("data" in res) {
        setRows(res.data);
        setPagination(res.pagination);
        setAggregates(res.aggregates);
      }
    });
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Alumni</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Total alumni" value={aggregates.total.toString()} />
        <StatCard
          label="Public profiles"
          value={`${aggregates.publicCount} (${aggregates.total > 0 ? Math.round((aggregates.publicCount / aggregates.total) * 100) : 0}%)`}
        />
        <StatCard
          label="Needs invite"
          value={aggregates.needsInviteCount.toString()}
          onClick={() => applyStatus("needs_invite")}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-3 items-end">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs font-medium text-muted-foreground">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder="Name or student ID"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Graduation year</span>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {aggregates.byYear.map((y) => (
              <option key={y.year} value={y.year}>
                {y.year}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Industry</span>
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. Tech"
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={() => load(1)}
          disabled={pending}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
        >
          Apply
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "public", "private", "incomplete", "needs_invite"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => applyStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs ${
              status === s
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {s === "all" ? "All" : s === "needs_invite" ? "Needs invite" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Student ID</th>
              <th className="p-3 text-left">Year</th>
              <th className="p-3 text-left">Profile</th>
              <th className="p-3 text-left">Visibility</th>
              <th className="p-3 text-left">Employer</th>
              <th className="p-3 text-left">Last updated</th>
              <th className="p-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  No alumni match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                  <td className="p-3">
                    <button
                      onClick={() => setEditing(r)}
                      className="text-left font-medium hover:underline"
                    >
                      {r.firstName} {r.lastName}
                    </button>
                    {r.needsInvite && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">
                        Needs invite
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{r.studentCode}</td>
                  <td className="p-3">{r.graduationYear}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-2 bg-primary"
                          style={{ width: `${r.profileCompleteness}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {r.profileCompleteness}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.isPublic
                          ? "bg-green-100 text-green-800"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.isPublic ? "Public" : "Private"}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.currentEmployer
                      ? `${r.currentEmployer}${r.currentPosition ? " · " + r.currentPosition : ""}`
                      : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {relativeTime(r.updatedAt)}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setEditing(r)}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Top industries</h3>
          {aggregates.topIndustries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No industry data yet.</p>
          ) : (
            <ul className="space-y-2">
              {aggregates.topIndustries.map((t) => (
                <li key={t.industry} className="flex items-center justify-between text-sm">
                  <span>{t.industry}</span>
                  <span className="text-xs text-muted-foreground">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">By graduation year</h3>
          {aggregates.byYear.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          ) : (
            <ul className="space-y-2">
              {aggregates.byYear.map((y) => (
                <li key={y.year} className="flex items-center justify-between text-sm">
                  <span>{y.year}</span>
                  <span className="text-xs text-muted-foreground">{y.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {editing && (
        <AlumniEditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(pagination.page);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`rounded-xl border border-border bg-card p-4 ${
        onClick ? "text-left hover:bg-muted/40 cursor-pointer" : ""
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </Wrapper>
  );
}
