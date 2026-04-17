"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createTeacherLicenceAction,
  updateTeacherLicenceAction,
  deleteTeacherLicenceAction,
} from "@/modules/hr/actions/licensure.action";

interface LicenceRow {
  id: string;
  staffId: string;
  staffName: string;
  staffRef: string;
  ntcNumber: string;
  category: string;
  issuedAt: Date | string;
  expiresAt: Date | string;
  status: string;
  documentId: string | null;
  notes: string | null;
  daysToExpiry: number;
}

type Category = "BEGINNER" | "PROFICIENT" | "EXPERT" | "LEAD";
type Status = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED";

export function LicencesClient({ licences }: { licences: LicenceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LicenceRow | null>(null);
  const [form, setForm] = useState({
    staffId: "",
    ntcNumber: "",
    category: "PROFICIENT" as Category,
    issuedAt: today(),
    expiresAt: inNYears(3),
    status: "ACTIVE" as Status,
    notes: "",
  });

  const visible = useMemo(() => {
    switch (filter) {
      case "expiring":
        return licences.filter((l) => l.status === "ACTIVE" && l.daysToExpiry <= 90);
      case "expired":
        return licences.filter((l) => l.status === "EXPIRED" || l.daysToExpiry < 0);
      default:
        return licences;
    }
  }, [licences, filter]);

  function openCreate() {
    setEditing(null);
    setForm({
      staffId: "",
      ntcNumber: "",
      category: "PROFICIENT",
      issuedAt: today(),
      expiresAt: inNYears(3),
      status: "ACTIVE",
      notes: "",
    });
    setOpen(true);
  }

  function openEdit(l: LicenceRow) {
    setEditing(l);
    setForm({
      staffId: l.staffId,
      ntcNumber: l.ntcNumber,
      category: l.category as Category,
      issuedAt: asDateInputValue(l.issuedAt),
      expiresAt: asDateInputValue(l.expiresAt),
      status: l.status as Status,
      notes: l.notes ?? "",
    });
    setOpen(true);
  }

  function handleSubmit() {
    const payload = {
      staffId: form.staffId,
      ntcNumber: form.ntcNumber,
      category: form.category,
      issuedAt: new Date(form.issuedAt),
      expiresAt: new Date(form.expiresAt),
      notes: form.notes || null,
    };
    startTransition(async () => {
      const result = editing
        ? await updateTeacherLicenceAction(editing.id, {
            ...payload,
            status: form.status,
          })
        : await createTeacherLicenceAction(payload);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(editing ? "Licence updated." : "Licence created.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this licence record? Audit history remains intact.")) return;
    startTransition(async () => {
      const r = await deleteTeacherLicenceAction(id);
      if ("error" in r) toast.error(r.error);
      else {
        toast.success("Licence deleted.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {(["all", "expiring", "expired"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "rounded bg-blue-600 px-3 py-1 text-sm text-white"
                  : "rounded border border-gray-300 px-3 py-1 text-sm"
              }
            >
              {f === "all" ? "All" : f === "expiring" ? "Expiring ≤90d" : "Expired"}
            </button>
          ))}
        </div>
        <button
          onClick={openCreate}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white"
        >
          Issue licence
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-semibold">Staff</th>
              <th className="px-4 py-2 font-semibold">NTC #</th>
              <th className="px-4 py-2 font-semibold">Category</th>
              <th className="px-4 py-2 font-semibold">Issued</th>
              <th className="px-4 py-2 font-semibold">Expires</th>
              <th className="px-4 py-2 font-semibold">Days</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No licences match the current filter.
                </td>
              </tr>
            ) : (
              visible.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{l.staffName}</div>
                    <div className="font-mono text-xs text-gray-500">{l.staffRef}</div>
                  </td>
                  <td className="px-4 py-2 font-mono">{l.ntcNumber}</td>
                  <td className="px-4 py-2">{l.category}</td>
                  <td className="px-4 py-2 text-xs">
                    {new Date(l.issuedAt).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {new Date(l.expiresAt).toLocaleDateString("en-GB")}
                  </td>
                  <td
                    className={
                      l.daysToExpiry < 0
                        ? "px-4 py-2 font-semibold text-red-700"
                        : l.daysToExpiry < 30
                          ? "px-4 py-2 font-semibold text-amber-700"
                          : "px-4 py-2"
                    }
                  >
                    {l.daysToExpiry}
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill status={l.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => openEdit(l)}
                      className="mr-3 text-sm text-blue-600 underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(l.id)}
                      className="text-sm text-red-600 underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl space-y-3 rounded bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">
              {editing ? "Edit licence" : "Issue NTC licence"}
            </h2>

            {!editing && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Staff ID</span>
                <input
                  type="text"
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                  placeholder="Prisma staff.id"
                  className="w-full rounded border border-gray-300 p-2 font-mono text-sm"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-sm font-medium">NTC number</span>
              <input
                type="text"
                value={form.ntcNumber}
                onChange={(e) => setForm({ ...form, ntcNumber: e.target.value })}
                placeholder="NTC/2026/001"
                className="w-full rounded border border-gray-300 p-2 font-mono text-sm uppercase"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Category</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                  className="w-full rounded border border-gray-300 p-2"
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="PROFICIENT">Proficient</option>
                  <option value="EXPERT">Expert</option>
                  <option value="LEAD">Lead</option>
                </select>
              </label>
              {editing && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
                    className="w-full rounded border border-gray-300 p-2"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="REVOKED">Revoked</option>
                  </select>
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Issued at</span>
                <input
                  type="date"
                  value={form.issuedAt}
                  onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
                  className="w-full rounded border border-gray-300 p-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Expires at</span>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full rounded border border-gray-300 p-2"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Notes</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded border border-gray-300 p-2 text-sm"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded px-3 py-2 text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={pending || !form.ntcNumber || (!editing && !form.staffId)}
                className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Saving…" : editing ? "Save" : "Issue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    EXPIRED: "bg-red-100 text-red-700",
    SUSPENDED: "bg-amber-100 text-amber-700",
    REVOKED: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100"}`}>
      {status}
    </span>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function inNYears(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}
function asDateInputValue(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}
