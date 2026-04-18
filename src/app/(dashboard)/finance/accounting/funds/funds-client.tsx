"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { createFundAction, updateFundAction } from "@/modules/accounting/actions/fund.action";

type FundType = "GENERAL" | "RESTRICTED" | "CAPITAL" | "DONOR" | "ENDOWMENT";

interface Fund {
  id: string;
  code: string;
  name: string;
  type: FundType;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
}

const TYPE_LABELS: Record<FundType, string> = {
  GENERAL: "General (unrestricted)",
  RESTRICTED: "Restricted",
  CAPITAL: "Capital",
  DONOR: "Donor-restricted",
  ENDOWMENT: "Endowment",
};

export function FundsClient({ funds }: { funds: Fund[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<{ code: string; name: string; type: FundType; description: string; isDefault: boolean }>({
    code: "",
    name: "",
    type: "GENERAL",
    description: "",
    isDefault: false,
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createFundAction({
        code: form.code,
        name: form.name,
        type: form.type,
        description: form.description || undefined,
        isDefault: form.isDefault,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Fund created");
      setShowModal(false);
      setForm({ code: "", name: "", type: "GENERAL", description: "", isDefault: false });
      router.refresh();
    });
  }

  function handleToggleActive(fund: Fund) {
    startTransition(async () => {
      const result = await updateFundAction(fund.id, { isActive: !fund.isActive });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`${fund.name} ${!fund.isActive ? "activated" : "deactivated"}`);
      router.refresh();
    });
  }

  function handleMakeDefault(fund: Fund) {
    startTransition(async () => {
      const result = await updateFundAction(fund.id, { isDefault: true });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`${fund.name} is now the default fund`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funds"
        description="Manage segregated funds for IPSAS fund accounting (General, Restricted, Capital, Donor, Endowment)"
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Fund
          </button>
        }
      />

      {funds.length === 0 ? (
        <EmptyState
          title="No funds"
          description="Seed the Chart of Accounts to create default General, Capital, and Restricted funds."
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {funds.map((f) => (
                <tr key={f.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-mono">{f.code}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {f.name}
                    {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">{TYPE_LABELS[f.type]}</td>
                  <td className="px-4 py-3 text-sm">{f.isActive ? "✓" : "—"}</td>
                  <td className="px-4 py-3 text-sm">{f.isDefault ? "⭐" : ""}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 text-xs">
                      <button disabled={isPending} onClick={() => handleToggleActive(f)} className="text-primary hover:underline">
                        {f.isActive ? "Deactivate" : "Activate"}
                      </button>
                      {!f.isDefault && (
                        <button disabled={isPending} onClick={() => handleMakeDefault(f)} className="text-primary hover:underline">
                          Make default
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create Fund</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground text-xl">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Code *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    required
                    placeholder="RF-SCI"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as FundType })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Science Lab Restricted Fund"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                Set as default fund (existing default will be demoted)
              </label>
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
