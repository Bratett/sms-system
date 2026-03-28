"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getStockLevelReportAction,
  getStockMovementReportAction,
} from "@/modules/inventory/actions/inventory-report.action";

// ─── Types ──────────────────────────────────────────────────────────

interface StockLevelRow {
  id: string;
  name: string;
  code: string | null;
  storeName: string;
  storeId: string;
  categoryName: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  totalValue: number;
  status: string;
}

interface MovementSummaryRow {
  itemId: string;
  itemName: string;
  storeName: string;
  categoryName: string;
  unit: string;
  totalIn: number;
  totalOut: number;
  adjustments: number;
  damaged: number;
  netChange: number;
}

interface StoreOption {
  id: string;
  name: string;
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusBadge: Record<string, string> = {
  IN_STOCK: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  LOW_STOCK: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
  OUT_OF_STOCK: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

// ─── Component ──────────────────────────────────────────────────────

export function ReportsClient({
  stockLevels: initialStockLevels,
  movementSummary: initialMovementSummary,
  stores,
}: {
  stockLevels: StockLevelRow[];
  movementSummary: MovementSummaryRow[];
  stores: StoreOption[];
}) {
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"levels" | "movements">("levels");
  const [storeFilter, setStoreFilter] = useState("");

  const [stockLevels, setStockLevels] = useState<StockLevelRow[]>(initialStockLevels);
  const [movementSummary, setMovementSummary] = useState<MovementSummaryRow[]>(initialMovementSummary);

  // ─── Filter ─────────────────────────────────────────────────────

  function applyFilter() {
    startTransition(async () => {
      if (activeTab === "levels") {
        const result = await getStockLevelReportAction(storeFilter || undefined);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setStockLevels(result.data ?? []);
      } else {
        const result = await getStockMovementReportAction({
          storeId: storeFilter || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setMovementSummary(result.data ?? []);
      }
    });
  }

  // Totals for stock levels
  const totalValue = stockLevels.reduce((sum, item) => sum + item.totalValue, 0);

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        <button
          onClick={() => setActiveTab("levels")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "levels"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Stock Levels
        </button>
        <button
          onClick={() => setActiveTab("movements")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "movements"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Movement Summary
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Store</label>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={applyFilter}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        <div className="ml-auto">
          <button
            disabled
            className="rounded-md border px-4 py-2 text-sm text-muted-foreground"
            title="Export coming soon"
          >
            Export
          </button>
        </div>
      </div>

      {/* ─── Stock Levels Tab ──────────────────────────────────────── */}
      {activeTab === "levels" && (
        <>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Total Stock Value: <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
              {" | "}
              Items: <span className="font-semibold text-foreground">{stockLevels.length}</span>
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Store</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Unit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Reorder</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Unit Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-card">
                {stockLevels.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.code ?? "-"}</td>
                    <td className="px-4 py-3 text-sm">{item.storeName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.categoryName}</td>
                    <td className={`px-4 py-3 text-right text-sm font-medium ${
                      item.status === "OUT_OF_STOCK" || item.status === "LOW_STOCK" ? "text-red-600" : ""
                    }`}>
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm">{item.unit}</td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground">{item.reorderLevel}</td>
                    <td className="px-4 py-3 text-right text-sm">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(item.totalValue)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[item.status] ?? ""}`}>
                        {item.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
                {stockLevels.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── Movement Summary Tab ──────────────────────────────────── */}
      {activeTab === "movements" && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Store</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Total In</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Total Out</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Adjustments</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Damaged/Expired</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Net Change</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-card">
              {movementSummary.map((row) => (
                <tr key={row.itemId}>
                  <td className="px-4 py-3 text-sm font-medium">{row.itemName}</td>
                  <td className="px-4 py-3 text-sm">{row.storeName}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{row.categoryName}</td>
                  <td className="px-4 py-3 text-right text-sm text-green-600">+{row.totalIn}</td>
                  <td className="px-4 py-3 text-right text-sm text-red-600">-{row.totalOut}</td>
                  <td className="px-4 py-3 text-right text-sm text-blue-600">{row.adjustments}</td>
                  <td className="px-4 py-3 text-right text-sm text-orange-600">{row.damaged}</td>
                  <td className={`px-4 py-3 text-right text-sm font-medium ${
                    row.netChange >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {row.netChange >= 0 ? "+" : ""}{row.netChange}
                  </td>
                </tr>
              ))}
              {movementSummary.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No movement data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
