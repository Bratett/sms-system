"use client";

import { useState } from "react";
import type { DuplicateMatch } from "@/lib/guardian-matching";

export function GuardianDedupModal({
  duplicates,
  onUseExisting,
  onCreateNew,
  onCancel,
  pending,
}: {
  duplicates: DuplicateMatch[];
  onUseExisting: (guardianId: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(duplicates[0]?.guardian.id ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Possible duplicate guardian</h2>
        <p className="text-sm text-muted-foreground">
          We found {duplicates.length} existing guardian(s) that might be the same person.
        </p>

        <ul className="space-y-2">
          {duplicates.map((m) => (
            <li key={m.guardian.id}>
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40">
                <input
                  type="radio"
                  name="dedup-selection"
                  checked={selected === m.guardian.id}
                  onChange={() => setSelected(m.guardian.id)}
                  className="mt-1"
                />
                <div className="flex-1 text-sm">
                  <p className="font-medium">
                    {m.guardian.firstName} {m.guardian.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.guardian.phone}
                    {m.guardian.email ? ` • ${m.guardian.email}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Matches: {m.reasons.join(", ")}
                  </p>
                </div>
              </label>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={onCreateNew}
            disabled={pending}
            className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50"
          >
            Create new anyway
          </button>
          <button
            onClick={() => selected && onUseExisting(selected)}
            disabled={pending || !selected}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Use existing
          </button>
        </div>
      </div>
    </div>
  );
}
