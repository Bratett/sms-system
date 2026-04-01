"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createFixedAssetAction,
  createAssetCategoryAction,
  updateFixedAssetAction,
  disposeAssetAction,
} from "@/modules/inventory/actions/fixed-asset.action";
import { recordMaintenanceAction } from "@/modules/inventory/actions/asset-maintenance.action";

interface Asset {
  id: string; assetNumber: string; name: string; description: string | null;
  categoryName: string; location: string | null; purchasePrice: number;
  currentValue: number; accumulatedDepreciation: number; condition: string;
  status: string; depreciationMethod: string; createdAt: Date | string;
}

interface Category { id: string; name: string; code: string | null; assetCount: number; }
interface Summary { totalAssets: number; activeCount: number; totalPurchaseValue: number; totalCurrentValue: number; totalDepreciation: number; }
interface Pagination { page: number; pageSize: number; total: number; totalPages: number; }

type AssetCondition = "NEW" | "GOOD" | "FAIR" | "POOR" | "UNSERVICEABLE";

const CONDITION_STYLES: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700", GOOD: "bg-green-100 text-green-700",
  FAIR: "bg-yellow-100 text-yellow-700", POOR: "bg-orange-100 text-orange-700",
  UNSERVICEABLE: "bg-red-100 text-red-700",
};

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FixedAssetsClient({
  assets, pagination, categories, summary,
}: { assets: Asset[]; pagination: Pagination; categories: Category[]; summary: Summary | null; }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [formData, setFormData] = useState({
    name: "", description: "", categoryId: "", location: "", serialNumber: "",
    model: "", manufacturer: "", purchaseDate: "", purchasePrice: 0,
    usefulLifeYears: "", salvageValue: 0, depreciationMethod: "STRAIGHT_LINE",
    condition: "NEW" as AssetCondition,
  });

  const [maintenanceData, setMaintenanceData] = useState({
    date: new Date().toISOString().split("T")[0], type: "SERVICE" as string,
    description: "", cost: "", performedBy: "", nextDueDate: "",
  });

  function handleSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createFixedAssetAction({
        name: formData.name, description: formData.description || undefined,
        categoryId: formData.categoryId, location: formData.location || undefined,
        serialNumber: formData.serialNumber || undefined, model: formData.model || undefined,
        manufacturer: formData.manufacturer || undefined,
        purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate) : undefined,
        purchasePrice: formData.purchasePrice,
        usefulLifeYears: formData.usefulLifeYears ? parseInt(formData.usefulLifeYears) : undefined,
        salvageValue: formData.salvageValue,
        depreciationMethod: formData.depreciationMethod as "STRAIGHT_LINE" | "REDUCING_BALANCE" | "NONE",
        condition: formData.condition,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success(`Asset registered: ${result.data!.assetNumber}`);
      setShowCreateModal(false);
      router.refresh();
    });
  }

  function handleDispose(asset: Asset) {
    startTransition(async () => {
      const result = await disposeAssetAction({ assetId: asset.id, disposalMethod: "WRITTEN_OFF", disposalAmount: 0 });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Asset disposed");
      router.refresh();
    });
  }

  function handleOpenMaintenance(asset: Asset) {
    setSelectedAsset(asset);
    setMaintenanceData({ date: new Date().toISOString().split("T")[0], type: "SERVICE", description: "", cost: "", performedBy: "", nextDueDate: "" });
    setShowMaintenanceModal(true);
  }

  function handleSubmitMaintenance(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    startTransition(async () => {
      const result = await recordMaintenanceAction({
        fixedAssetId: selectedAsset.id, date: new Date(maintenanceData.date),
        type: maintenanceData.type as "REPAIR" | "SERVICE" | "UPGRADE" | "INSPECTION",
        description: maintenanceData.description,
        cost: maintenanceData.cost ? parseFloat(maintenanceData.cost) : undefined,
        performedBy: maintenanceData.performedBy || undefined,
        nextDueDate: maintenanceData.nextDueDate ? new Date(maintenanceData.nextDueDate) : undefined,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Maintenance recorded");
      setShowMaintenanceModal(false);
      router.refresh();
    });
  }

  const filtered = assets.filter((a) => {
    if (filterCategory && !a.categoryName.includes(filterCategory)) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Fixed Assets" description="Register and track school fixed assets, equipment, and property"
        actions={<button onClick={() => setShowCreateModal(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Register Asset</button>}
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Assets</p>
            <p className="text-2xl font-bold">{summary.totalAssets}</p>
            <p className="text-xs text-muted-foreground">{summary.activeCount} active</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Purchase Value</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalPurchaseValue)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Current Value</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCurrentValue)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Acc. Depreciation</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalDepreciation)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Categories</p>
            <p className="text-2xl font-bold">{categories.length}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="">All Categories</option>
          {categories.map((c) => (<option key={c.id} value={c.name}>{c.name} ({c.assetCount})</option>))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="UNDER_MAINTENANCE">Under Maintenance</option>
          <option value="DISPOSED">Disposed</option>
          <option value="WRITTEN_OFF">Written Off</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No assets found" description="Register fixed assets to track school property and equipment." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Asset #</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Purchase Value</th>
                  <th className="px-4 py-3">Current Value</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((asset) => (
                  <tr key={asset.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-mono">{asset.assetNumber}</td>
                    <td className="px-4 py-3 text-sm font-medium">{asset.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{asset.categoryName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{asset.location ?? "—"}</td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(asset.purchasePrice)}</td>
                    <td className="px-4 py-3 text-sm text-green-600">{formatCurrency(asset.currentValue)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_STYLES[asset.condition] ?? ""}`}>
                        {asset.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={asset.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {asset.status === "ACTIVE" && (
                          <>
                            <button onClick={() => handleOpenMaintenance(asset)} className="text-xs text-blue-600 hover:underline">Maintain</button>
                            <ConfirmDialog title="Dispose Asset" description={`Write off "${asset.name}" (${asset.assetNumber})?`} onConfirm={() => handleDispose(asset)} variant="destructive"
                              trigger={<button className="text-xs text-red-500 hover:text-red-700">Dispose</button>}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Register Fixed Asset</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Asset Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., Dell Latitude Laptop" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category *</label>
                  <select value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select Category</option>
                    {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., ICT Lab" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Serial Number</label>
                  <input type="text" value={formData.serialNumber} onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Manufacturer</label>
                  <input type="text" value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Price (GHS) *</label>
                  <input type="number" value={formData.purchasePrice} onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })} required min="0" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Date</label>
                  <input type="date" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Condition</label>
                  <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value as AssetCondition })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="NEW">New</option><option value="GOOD">Good</option><option value="FAIR">Fair</option><option value="POOR">Poor</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Useful Life (years)</label>
                  <input type="number" value={formData.usefulLifeYears} onChange={(e) => setFormData({ ...formData, usefulLifeYears: e.target.value })} min="1" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Salvage Value (GHS)</label>
                  <input type="number" value={formData.salvageValue} onChange={(e) => setFormData({ ...formData, salvageValue: parseFloat(e.target.value) || 0 })} min="0" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Depreciation Method</label>
                  <select value={formData.depreciationMethod} onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="STRAIGHT_LINE">Straight Line</option>
                    <option value="REDUCING_BALANCE">Reducing Balance</option>
                    <option value="NONE">None</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Registering..." : "Register Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance Modal */}
      {showMaintenanceModal && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Record Maintenance</h2>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{selectedAsset.name} ({selectedAsset.assetNumber})</p>
            <form onSubmit={handleSubmitMaintenance} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Type *</label>
                  <select value={maintenanceData.type} onChange={(e) => setMaintenanceData({ ...maintenanceData, type: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="REPAIR">Repair</option><option value="SERVICE">Service</option>
                    <option value="UPGRADE">Upgrade</option><option value="INSPECTION">Inspection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input type="date" value={maintenanceData.date} onChange={(e) => setMaintenanceData({ ...maintenanceData, date: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <textarea value={maintenanceData.description} onChange={(e) => setMaintenanceData({ ...maintenanceData, description: e.target.value })} required rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Cost (GHS)</label>
                  <input type="number" value={maintenanceData.cost} onChange={(e) => setMaintenanceData({ ...maintenanceData, cost: e.target.value })} min="0" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Next Due Date</label>
                  <input type="date" value={maintenanceData.nextDueDate} onChange={(e) => setMaintenanceData({ ...maintenanceData, nextDueDate: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowMaintenanceModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Recording..." : "Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
