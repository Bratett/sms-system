"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  seedDefaultChartOfAccountsAction,
  createAccountAction,
  updateAccountAction,
} from "@/modules/accounting/actions/chart-of-accounts.action";
import type { Monetary } from "@/lib/monetary";

interface AccountBase {
  id: string;
  categoryId: string;
  parentId: string | null;
  code: string;
  name: string;
  description: string | null;
  normalBalance: string;
  currentBalance: Monetary;
  isActive: boolean;
  isSystemAccount: boolean;
  schoolId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface Account extends AccountBase {
  category?: { name: string; type: string };
  parent?: { code: string; name: string } | null;
  _count?: { children: number };
  children?: AccountBase[];
}

interface AccountCategory {
  id: string;
  schoolId: string;
  name: string;
  type: string;
  sortOrder: number;
  createdAt: Date | string;
  accounts: (AccountBase & { children: AccountBase[] })[];
}

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BALANCE_STYLES: Record<string, string> = {
  DEBIT: "bg-blue-100 text-blue-700",
  CREDIT: "bg-purple-100 text-purple-700",
};

const CATEGORY_COLORS: Record<string, string> = {
  ASSET: "border-l-blue-500",
  LIABILITY: "border-l-red-500",
  EQUITY: "border-l-purple-500",
  REVENUE: "border-l-green-500",
  EXPENSE: "border-l-orange-500",
};

export function ChartOfAccountsClient({
  categories,
  accounts,
}: {
  categories: AccountCategory[];
  accounts: Account[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id))
  );

  const [formData, setFormData] = useState({
    categoryId: "",
    parentId: "",
    code: "",
    name: "",
    description: "",
    normalBalance: "DEBIT",
  });

  function toggleCategory(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function handleSeedDefaults() {
    startTransition(async () => {
      const result = await seedDefaultChartOfAccountsAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Default Chart of Accounts created successfully");
      router.refresh();
    });
  }

  function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createAccountAction({
        categoryId: formData.categoryId,
        parentId: formData.parentId || undefined,
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        normalBalance: formData.normalBalance as "DEBIT" | "CREDIT",
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Account "${formData.code} - ${formData.name}" created`);
      setShowAddModal(false);
      setFormData({ categoryId: "", parentId: "", code: "", name: "", description: "", normalBalance: "DEBIT" });
      router.refresh();
    });
  }

  function handleToggleActive(accountId: string, currentlyActive: boolean) {
    startTransition(async () => {
      const result = await updateAccountAction(accountId, { isActive: !currentlyActive });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Account ${currentlyActive ? "deactivated" : "activated"}`);
      router.refresh();
    });
  }

  function resetAndOpenModal() {
    setFormData({ categoryId: categories[0]?.id ?? "", parentId: "", code: "", name: "", description: "", normalBalance: "DEBIT" });
    setShowAddModal(true);
  }

  // Filter accounts by selected category for parent select
  const categoryAccounts = accounts.filter((a) => a.categoryId === formData.categoryId && a.isActive);

  // Summary stats
  const totalAccounts = accounts.length;
  const categoryCounts = categories.map((c) => ({
    name: c.name,
    type: c.type,
    count: accounts.filter((a) => a.categoryId === c.id).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="Manage your institution's account structure and categories"
        actions={
          categories.length > 0 ? (
            <button
              onClick={resetAndOpenModal}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Account
            </button>
          ) : undefined
        }
      />

      {/* Summary Cards */}
      {categories.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Accounts</p>
            <p className="mt-1 text-2xl font-bold">{totalAccounts}</p>
          </div>
          {categoryCounts.map((cc) => (
            <div key={cc.name} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">{cc.name}</p>
              <p className="mt-1 text-2xl font-bold">{cc.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Seed Defaults or Tree View */}
      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <EmptyState
            title="No accounts configured"
            description="Get started by seeding the default Ghana-standard Chart of Accounts, or add categories and accounts manually."
          />
          <button
            onClick={handleSeedDefaults}
            disabled={isPending}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Seeding..." : "Seed Default Accounts"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className={`rounded-lg border border-border bg-card border-l-4 ${CATEGORY_COLORS[category.type] ?? "border-l-gray-500"}`}
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {expandedCategories.has(category.id) ? "\u25BC" : "\u25B6"}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{category.name}</h3>
                    <p className="text-xs text-muted-foreground">{category.type}</p>
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {category.accounts.length} accounts
                </span>
              </button>

              {/* Accounts Table */}
              {expandedCategories.has(category.id) && category.accounts.length > 0 && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Normal Balance</th>
                        <th className="px-4 py-3">Current Balance</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {category.accounts.map((account) => (
                        <>
                          <tr key={account.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3 text-sm font-mono font-medium">{account.code}</td>
                            <td className="px-4 py-3 text-sm">{account.name}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{category.type}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BALANCE_STYLES[account.normalBalance] ?? ""}`}>
                                {account.normalBalance}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">{formatCurrency(account.currentBalance)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${account.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                                {account.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleToggleActive(account.id, account.isActive)}
                                disabled={isPending}
                                className={`text-xs hover:underline ${account.isActive ? "text-red-600" : "text-green-600"}`}
                              >
                                {account.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </td>
                          </tr>
                          {/* Child accounts */}
                          {account.children?.map((child) => (
                            <tr key={child.id} className="hover:bg-muted/50 bg-muted/20">
                              <td className="px-4 py-3 text-sm font-mono pl-8">{child.code}</td>
                              <td className="px-4 py-3 text-sm pl-8">
                                <span className="text-muted-foreground mr-1">&mdash;</span>
                                {child.name}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{category.type}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BALANCE_STYLES[child.normalBalance] ?? ""}`}>
                                  {child.normalBalance}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">{formatCurrency(child.currentBalance)}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${child.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                                  {child.isActive ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleToggleActive(child.id, child.isActive)}
                                  disabled={isPending}
                                  className={`text-xs hover:underline ${child.isActive ? "text-red-600" : "text-green-600"}`}
                                >
                                  {child.isActive ? "Deactivate" : "Activate"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {expandedCategories.has(category.id) && category.accounts.length === 0 && (
                <div className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  No accounts in this category
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Account</h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, parentId: "" })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parent Account</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">None (top-level account)</option>
                  {categoryAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Account Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="e.g., 1050"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Normal Balance *</label>
                  <select
                    value={formData.normalBalance}
                    onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value })}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="e.g., Petty Cash"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
