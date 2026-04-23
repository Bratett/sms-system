"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createHouseholdAction } from "@/modules/student/actions/household.action";

type HouseholdRow = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  guardianCount: number;
  studentCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export function HouseholdsClient({
  households,
  initialSearch,
}: {
  households: HouseholdRow[];
  initialSearch: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    start(() => router.replace(`/students/households?${params.toString()}`));
  };

  const onCreate = () => {
    if (!newName.trim()) {
      toast.error("Household name is required");
      return;
    }
    start(async () => {
      const res = await createHouseholdAction({ name: newName, address: newAddress });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Household "${res.data.name}" created`);
      setShowCreate(false);
      setNewName("");
      setNewAddress("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Households</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/students/households/duplicates"
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Scan duplicates
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
          >
            + Create household
          </button>
        </div>
      </div>

      <form onSubmit={onSearch} className="flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by household name…"
          className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
        >
          Search
        </button>
      </form>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Address</th>
              <th className="p-3 text-left">Guardians</th>
              <th className="p-3 text-left">Students</th>
              <th className="p-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {households.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No households found.
                </td>
              </tr>
            ) : (
              households.map((h) => (
                <tr key={h.id} className="border-t border-border hover:bg-muted/40">
                  <td className="p-3">
                    <Link href={`/students/households/${h.id}`} className="hover:underline font-medium">
                      {h.name}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{h.address ?? "—"}</td>
                  <td className="p-3">{h.guardianCount}</td>
                  <td className="p-3">{h.studentCount}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(h.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Create household</h2>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Household name (e.g., Asante Family)"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            />
            <input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="Address (optional)"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onCreate}
                disabled={pending}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
