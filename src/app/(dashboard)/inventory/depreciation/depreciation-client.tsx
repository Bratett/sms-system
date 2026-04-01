"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { runDepreciationAction } from "@/modules/inventory/actions/depreciation.action";

import type { Monetary } from "@/lib/monetary";
interface DepreciationAsset {
  id: string; assetNumber: string; name: string; categoryName: string;
  purchasePrice: Monetary; currentValue: Monetary; salvageValue: Monetary;
  accumulatedDepreciation: number; depreciationMethod: string;
  usefulLifeYears: number | null; lastDepreciationPeriod: string | null;
  percentDepreciated: number;
}

interface Summary { totalPurchaseValue: number; totalCurrentValue: number; totalAccumulated: number; assetCount: number; }

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DepreciationClient({ assets, summary }: { assets: DepreciationAsset[]; summary: Summary | null; }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState(`${new Date().getFullYear()}`);
  const [results, setResults] = useState<{ processed: number; skipped: number; total: number } | null>(null);

  function handleRunDepreciation() {
    startTransition(async () => {
      const result = await runDepreciationAction(period);
      if (result.error) { toast.error(result.error); return; }
      setResults(result.data!);
      toast.success(`Depreciation complete: ${result.data!.processed} assets processed`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Asset Depreciation" description="Calculate and track asset depreciation schedules"
        actions={
          <div className="flex items-center gap-3">
            <input type="text" value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-32" placeholder="e.g., 2026" />
            <ConfirmDialog title="Run Depreciation" description={`Calculate depreciation for period "${period}" across all active assets? This updates current values.`}
              onConfirm={handleRunDepreciation}
              trigger={<button disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{isPending ? "Running..." : "Run Depreciation"}</button>}
            />
          </div>
        }
      />

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Depreciable Assets</p>
            <p className="text-2xl font-bold">{summary.assetCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Original Value</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalPurchaseValue)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Net Book Value</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCurrentValue)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Accumulated Depreciation</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalAccumulated)}</p>
          </div>
        </div>
      )}

      {/* Results banner */}
      {results && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Depreciation run complete for period &quot;{period}&quot;: {results.processed} assets processed, {results.skipped} skipped (of {results.total} total).
          </p>
        </div>
      )}

      {/* Asset Depreciation Table */}
      {assets.length === 0 ? (
        <EmptyState title="No depreciable assets" description="Register fixed assets with depreciation methods to see them here." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Asset #</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Purchase Value</th>
                  <th className="px-4 py-3">Current Value</th>
                  <th className="px-4 py-3">Acc. Depreciation</th>
                  <th className="px-4 py-3">% Depreciated</th>
                  <th className="px-4 py-3">Last Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-mono">{asset.assetNumber}</td>
                    <td className="px-4 py-3 text-sm font-medium">{asset.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{asset.categoryName}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                        {asset.depreciationMethod === "STRAIGHT_LINE" ? "SL" : "RB"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(asset.purchasePrice)}</td>
                    <td className="px-4 py-3 text-sm text-green-600">{formatCurrency(asset.currentValue)}</td>
                    <td className="px-4 py-3 text-sm text-red-600">{formatCurrency(asset.accumulatedDepreciation)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-gray-200">
                          <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(asset.percentDepreciated, 100)}%` }} />
                        </div>
                        <span className="text-xs">{asset.percentDepreciated.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{asset.lastDepreciationPeriod ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
