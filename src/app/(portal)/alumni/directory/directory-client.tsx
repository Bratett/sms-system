"use client";

import { useState, useTransition } from "react";
import { getAlumniDirectoryAction } from "@/modules/alumni/actions/alumni-self.action";

type Row = {
  id: string;
  studentId: string;
  graduationYear: number;
  currentEmployer: string | null;
  currentPosition: string | null;
  industry: string | null;
  highestEducation: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function DirectoryClient({
  initialData,
  initialPagination,
  initialYears,
}: {
  initialData: Row[];
  initialPagination: Pagination;
  initialYears: number[];
}) {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialData);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("");
  const [industry, setIndustry] = useState("");
  const [opened, setOpened] = useState<Row | null>(null);

  function load(page: number) {
    start(async () => {
      const res = await getAlumniDirectoryAction({
        search: search || undefined,
        graduationYear: year ? Number(year) : undefined,
        industry: industry || undefined,
        page,
        pageSize: 20,
      });
      if ("data" in res) {
        setRows(res.data);
        setPagination(res.pagination);
      }
    });
  }

  const hasFilters = !!(search || year || industry);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Alumni directory</h1>

      {/* Filter bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap gap-3 items-end">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs font-medium text-gray-500">Search by name</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder="First or last name…"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-500">Graduation year</span>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="">All years</option>
            {initialYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-500">Industry</span>
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. Technology"
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </label>

        <button
          onClick={() => load(1)}
          disabled={pending}
          className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm hover:bg-teal-700 disabled:opacity-50"
        >
          {pending ? "Loading…" : "Apply"}
        </button>
      </div>

      {/* Results */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          {pagination.total === 0 && !hasFilters
            ? "No alumni have made their profiles public yet. Be the first — toggle visibility on your profile."
            : "No alumni match these filters."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpened(r)}
              className="text-left rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                {r.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.photoUrl}
                    alt={`${r.firstName} ${r.lastName}`}
                    className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
                    {r.firstName.charAt(0)}
                    {r.lastName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-xs text-gray-500">Class of {r.graduationYear}</p>
                </div>
              </div>

              {(r.currentEmployer || r.currentPosition) && (
                <p className="text-xs text-gray-600 truncate">
                  {r.currentPosition}
                  {r.currentPosition && r.currentEmployer ? " · " : ""}
                  {r.currentEmployer}
                </p>
              )}

              {r.industry && (
                <p className="text-xs text-gray-500 mt-1 truncate">{r.industry}</p>
              )}

              {r.linkedinUrl && (
                <a
                  href={r.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-2 text-xs text-teal-600 hover:text-teal-700 hover:underline"
                >
                  LinkedIn ↗
                </a>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => load(pagination.page - 1)}
              disabled={pagination.page <= 1 || pending}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => load(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || pending}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {opened && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpened(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {opened.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={opened.photoUrl}
                    alt={`${opened.firstName} ${opened.lastName}`}
                    className="h-14 w-14 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center text-lg font-semibold text-gray-600 flex-shrink-0">
                    {opened.firstName.charAt(0)}
                    {opened.lastName.charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {opened.firstName} {opened.lastName}
                  </h2>
                  <p className="text-xs text-gray-500">Class of {opened.graduationYear}</p>
                </div>
              </div>
              <button
                onClick={() => setOpened(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Employment */}
            {(opened.currentEmployer || opened.currentPosition) && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Current role
                </p>
                <p className="text-sm text-gray-900 mt-0.5">
                  {opened.currentPosition}
                  {opened.currentPosition && opened.currentEmployer ? " at " : ""}
                  {opened.currentEmployer}
                </p>
              </div>
            )}

            {/* Industry */}
            {opened.industry && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Industry
                </p>
                <p className="text-sm text-gray-900 mt-0.5">{opened.industry}</p>
              </div>
            )}

            {/* Education */}
            {opened.highestEducation && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Education
                </p>
                <p className="text-sm text-gray-900 mt-0.5">{opened.highestEducation}</p>
              </div>
            )}

            {/* Bio */}
            {opened.bio && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bio</p>
                <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{opened.bio}</p>
              </div>
            )}

            {/* LinkedIn */}
            {opened.linkedinUrl && (
              <a
                href={opened.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 hover:underline"
              >
                LinkedIn profile ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
