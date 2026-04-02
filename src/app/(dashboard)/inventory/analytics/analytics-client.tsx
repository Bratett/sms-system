"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

// ─── Colors ──────────────────────────────────────────────────────────

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

// ─── Types ───────────────────────────────────────────────────────────

interface Overview {
  totalStores: number;
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  pendingPOs: number;
  totalAssets: number;
  monthlySpend: number;
}

interface TrendEntry {
  month: string;
  stockIn: number;
  stockOut: number;
  adjustments: number;
  damaged: number;
}

interface ABCItem {
  id: string;
  name: string;
  storeName: string;
  categoryName: string;
  unit: string;
  unitPrice: number;
  annualConsumptionQty: number;
  annualConsumptionValue: number;
  classification: "A" | "B" | "C";
}

interface ABCSummary {
  totalAnnualValue: number;
  classA: { count: number; value: number };
  classB: { count: number; value: number };
  classC: { count: number; value: number };
}

interface CategoryItem {
  name: string;
  itemCount: number;
  totalValue: number;
}

interface AgingItem {
  id: string;
  name: string;
  storeName: string;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  lastMovementDate: Date | string | null;
  daysSinceLastMovement: number | null;
  agingBucket: string;
}

interface AgingSummary {
  bucket: string;
  itemCount: number;
  totalValue: number;
}

interface ReorderItem {
  id: string;
  name: string;
  code: string | null;
  storeName: string;
  categoryName: string;
  unit: string;
  currentQuantity: number;
  reorderLevel: number;
  deficit: number;
  suggestedOrderQty: number;
  estimatedCost: number;
  unitPrice: number;
  isOutOfStock: boolean;
}

interface ReorderSummary {
  totalItemsNeedingReorder: number;
  outOfStockCount: number;
  lowStockCount: number;
  totalEstimatedCost: number;
}

interface ProcurementData {
  totalOrders: number;
  totalSpend: number;
  avgApprovalTimeDays: number;
  fulfillmentRate: number;
  statusCounts: Record<string, number>;
  spendTrend: { month: string; amount: number }[];
  topSuppliers: { name: string; totalSpend: number; orderCount: number }[];
  topItems: { name: string; totalQty: number }[];
}

interface SupplierRow {
  id: string;
  name: string;
  contactPerson: string | null;
  totalOrders: number;
  completedOrders: number;
  totalSpend: number;
  qualityRate: number;
  avgRating: number | null;
  ratingCount: number;
}

interface AssetData {
  totalAssets: number;
  activeAssets: number;
  totalPurchaseValue: number;
  totalCurrentValue: number;
  totalDepreciation: number;
  depreciationRate: number;
  maintenanceCosts: number;
  valueByCategory: { name: string; purchaseValue: number; currentValue: number; count: number }[];
  conditionCounts: Record<string, number>;
  statusCounts: Record<string, number>;
}

interface AnalyticsClientProps {
  overview: Overview | null;
  trends: TrendEntry[];
  abcAnalysis: { data: ABCItem[]; summary: ABCSummary | null };
  categoryDistribution: CategoryItem[];
  stockAging: { data: AgingItem[]; summary: AgingSummary[] };
  reorderAnalytics: { data: ReorderItem[]; summary: ReorderSummary | null };
  procurementAnalytics: ProcurementData | null;
  supplierPerformance: SupplierRow[];
  assetAnalytics: AssetData | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `GHS ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `GHS ${(amount / 1_000).toFixed(1)}K`;
  return formatCurrency(amount);
}

const classificationBadge: Record<string, string> = {
  A: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  B: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
  C: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

const agingBucketLabel: Record<string, string> = {
  "0-30": "0-30 days",
  "31-60": "31-60 days",
  "61-90": "61-90 days",
  "91-180": "91-180 days",
  "180+": "180+ days",
  "no-movement": "No movement",
};

// ─── Tabs ────────────────────────────────────────────────────────────

type TabKey = "overview" | "stock" | "procurement" | "assets";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "stock", label: "Stock Analysis" },
  { key: "procurement", label: "Procurement" },
  { key: "assets", label: "Assets" },
];

// ─── Component ───────────────────────────────────────────────────────

export function AnalyticsClient({
  overview,
  trends,
  abcAnalysis,
  categoryDistribution,
  stockAging,
  reorderAnalytics,
  procurementAnalytics,
  supplierPerformance,
  assetAnalytics,
}: AnalyticsClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // ─── KPI Cards ────────────────────────────────────────────────────

  const kpis = overview
    ? [
        { label: "Total Items", value: overview.totalItems.toLocaleString(), color: "text-blue-600" },
        { label: "Total Value", value: formatCompact(overview.totalValue), color: "text-green-600" },
        { label: "Low Stock", value: overview.lowStockItems.toLocaleString(), color: "text-yellow-600" },
        { label: "Out of Stock", value: overview.outOfStockItems.toLocaleString(), color: "text-red-600" },
        { label: "Pending POs", value: overview.pendingPOs.toLocaleString(), color: "text-purple-600" },
        { label: "Total Assets", value: overview.totalAssets.toLocaleString(), color: "text-cyan-600" },
        { label: "Monthly Spend", value: formatCompact(overview.monthlySpend), color: "text-orange-600" },
        {
          label: "Reorder Needed",
          value: reorderAnalytics.summary?.totalItemsNeedingReorder.toLocaleString() ?? "0",
          color: "text-pink-600",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab trends={trends} categoryDistribution={categoryDistribution} />
      )}
      {activeTab === "stock" && (
        <StockAnalysisTab
          abcAnalysis={abcAnalysis}
          stockAging={stockAging}
          reorderAnalytics={reorderAnalytics}
        />
      )}
      {activeTab === "procurement" && (
        <ProcurementTab
          procurementAnalytics={procurementAnalytics}
          supplierPerformance={supplierPerformance}
        />
      )}
      {activeTab === "assets" && <AssetsTab assetAnalytics={assetAnalytics} />}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────

function OverviewTab({
  trends,
  categoryDistribution,
}: {
  trends: TrendEntry[];
  categoryDistribution: CategoryItem[];
}) {
  return (
    <div className="space-y-6">
      {/* Stock Movement Trends */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Stock Movement Trends</h3>
        {trends.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="stockIn" name="Stock In" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                <Area type="monotone" dataKey="stockOut" name="Stock Out" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
                <Area type="monotone" dataKey="adjustments" name="Adjustments" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                <Area type="monotone" dataKey="damaged" name="Damaged/Expired" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">No stock movement data available.</p>
        )}
      </div>

      {/* Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Category Distribution</h3>
          {categoryDistribution.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    dataKey="totalValue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  >
                    {categoryDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No category data available.</p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
          {categoryDistribution.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categoryDistribution.map((cat) => (
                    <tr key={cat.name} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium">{cat.name}</td>
                      <td className="px-4 py-3 text-sm text-right">{cat.itemCount}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(cat.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No category data available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stock Analysis Tab ──────────────────────────────────────────────

function StockAnalysisTab({
  abcAnalysis,
  stockAging,
  reorderAnalytics,
}: {
  abcAnalysis: { data: ABCItem[]; summary: ABCSummary | null };
  stockAging: { data: AgingItem[]; summary: AgingSummary[] };
  reorderAnalytics: { data: ReorderItem[]; summary: ReorderSummary | null };
}) {
  return (
    <div className="space-y-6">
      {/* ABC Summary */}
      {abcAnalysis.summary && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">ABC Analysis Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {(["A", "B", "C"] as const).map((cls) => {
              const d = abcAnalysis.summary![`class${cls}`];
              const pct =
                abcAnalysis.summary!.totalAnnualValue > 0
                  ? ((d.value / abcAnalysis.summary!.totalAnnualValue) * 100).toFixed(1)
                  : "0";
              return (
                <div key={cls} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${classificationBadge[cls]}`}>
                      Class {cls}
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{d.count} items</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(d.value)} ({pct}%)
                  </p>
                </div>
              );
            })}
          </div>

          {/* ABC Table */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="sticky top-0">
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Store</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Annual Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Annual Value</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Class</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {abcAnalysis.data.slice(0, 50).map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.storeName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.categoryName}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-sm text-right">{item.annualConsumptionQty}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.annualConsumptionValue)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${classificationBadge[item.classification]}`}>
                        {item.classification}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Aging Summary */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Stock Aging Analysis</h3>
        {stockAging.summary.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {stockAging.summary.map((bucket) => (
                <div key={bucket.bucket} className="rounded-lg border bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{agingBucketLabel[bucket.bucket] ?? bucket.bucket}</p>
                  <p className="text-xl font-bold">{bucket.itemCount}</p>
                  <p className="text-xs text-muted-foreground">{formatCompact(bucket.totalValue)}</p>
                </div>
              ))}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockAging.summary}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="bucket" className="text-xs" tickFormatter={(v) => agingBucketLabel[v] ?? v} />
                  <YAxis className="text-xs" />
                  <Tooltip
                    labelFormatter={(v) => agingBucketLabel[v] ?? v}
                    formatter={(value, name) =>
                      name === "totalValue" ? formatCurrency(Number(value)) : value
                    }
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="itemCount" name="Items" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">No aging data available.</p>
        )}
      </div>

      {/* Reorder Analytics */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Reorder Analytics</h3>
        {reorderAnalytics.summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Items to Reorder</p>
              <p className="text-2xl font-bold">{reorderAnalytics.summary.totalItemsNeedingReorder}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{reorderAnalytics.summary.outOfStockCount}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600">{reorderAnalytics.summary.lowStockCount}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Est. Reorder Cost</p>
              <p className="text-2xl font-bold text-blue-600">{formatCompact(reorderAnalytics.summary.totalEstimatedCost)}</p>
            </div>
          </div>
        )}

        {reorderAnalytics.data.length > 0 ? (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="sticky top-0">
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Store</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Current</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Reorder Lvl</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Deficit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Suggested Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Est. Cost</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reorderAnalytics.data.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.storeName}</td>
                    <td className="px-4 py-3 text-sm text-right">{item.currentQuantity} {item.unit}</td>
                    <td className="px-4 py-3 text-sm text-right">{item.reorderLevel}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">{item.deficit}</td>
                    <td className="px-4 py-3 text-sm text-right">{item.suggestedOrderQty}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.estimatedCost)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          item.isOutOfStock
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                        }`}
                      >
                        {item.isOutOfStock ? "Out of Stock" : "Low Stock"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">All items are sufficiently stocked.</p>
        )}
      </div>
    </div>
  );
}

// ─── Procurement Tab ─────────────────────────────────────────────────

function ProcurementTab({
  procurementAnalytics,
  supplierPerformance,
}: {
  procurementAnalytics: ProcurementData | null;
  supplierPerformance: SupplierRow[];
}) {
  if (!procurementAnalytics) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No procurement data available.</p>;
  }

  const poStatusData = Object.entries(procurementAnalytics.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  return (
    <div className="space-y-6">
      {/* Procurement KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Orders</p>
          <p className="text-2xl font-bold">{procurementAnalytics.totalOrders}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Spend</p>
          <p className="text-2xl font-bold text-blue-600">{formatCompact(procurementAnalytics.totalSpend)}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Avg. Approval Time</p>
          <p className="text-2xl font-bold">{procurementAnalytics.avgApprovalTimeDays} days</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Fulfillment Rate</p>
          <p className="text-2xl font-bold text-green-600">{procurementAnalytics.fulfillmentRate}%</p>
        </div>
      </div>

      {/* Spend Trend + PO Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Monthly Spend Trend</h3>
          {procurementAnalytics.spendTrend.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={procurementAnalytics.spendTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Area type="monotone" dataKey="amount" name="Spend" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No spend data available.</p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">PO Status Distribution</h3>
          {poStatusData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={poStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {poStatusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No purchase orders found.</p>
          )}
        </div>
      </div>

      {/* Top Suppliers */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Top Suppliers by Spend</h3>
        {procurementAnalytics.topSuppliers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Supplier</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Orders</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {procurementAnalytics.topSuppliers.map((supplier) => (
                  <tr key={supplier.name} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{supplier.name}</td>
                    <td className="px-4 py-3 text-sm text-right">{supplier.orderCount}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(supplier.totalSpend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">No supplier data available.</p>
        )}
      </div>

      {/* Supplier Performance */}
      {supplierPerformance.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Supplier Performance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Supplier</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Orders</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Spend</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Quality</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {supplierPerformance.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-right">{s.totalOrders}</td>
                    <td className="px-4 py-3 text-sm text-right">{s.completedOrders}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(s.totalSpend)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          s.qualityRate >= 95
                            ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                            : s.qualityRate >= 80
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                        }`}
                      >
                        {s.qualityRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {s.avgRating !== null ? `${s.avgRating}/5` : "N/A"}
                    </td>
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

// ─── Assets Tab ──────────────────────────────────────────────────────

function AssetsTab({ assetAnalytics }: { assetAnalytics: AssetData | null }) {
  if (!assetAnalytics) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No asset data available.</p>;
  }

  const conditionData = Object.entries(assetAnalytics.conditionCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const statusData = Object.entries(assetAnalytics.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  return (
    <div className="space-y-6">
      {/* Asset KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Assets</p>
          <p className="text-2xl font-bold">{assetAnalytics.totalAssets}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Purchase Value</p>
          <p className="text-2xl font-bold">{formatCompact(assetAnalytics.totalPurchaseValue)}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Current Value</p>
          <p className="text-2xl font-bold text-green-600">{formatCompact(assetAnalytics.totalCurrentValue)}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Depreciation Rate</p>
          <p className="text-2xl font-bold text-red-600">{assetAnalytics.depreciationRate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Depreciation</p>
          <p className="text-2xl font-bold text-orange-600">{formatCompact(assetAnalytics.totalDepreciation)}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Maintenance Costs</p>
          <p className="text-2xl font-bold text-purple-600">{formatCompact(assetAnalytics.maintenanceCosts)}</p>
        </div>
      </div>

      {/* Value by Category */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Asset Value by Category</h3>
        {assetAnalytics.valueByCategory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Count</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Purchase Value</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Value</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Depreciation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assetAnalytics.valueByCategory.map((cat) => (
                  <tr key={cat.name} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{cat.name}</td>
                    <td className="px-4 py-3 text-sm text-right">{cat.count}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(cat.purchaseValue)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(cat.currentValue)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">
                      {formatCurrency(cat.purchaseValue - cat.currentValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">No asset categories found.</p>
        )}
      </div>

      {/* Condition + Status Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Asset Condition Distribution</h3>
          {conditionData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conditionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {conditionData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No condition data available.</p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Asset Status Distribution</h3>
          {statusData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Bar dataKey="value" name="Count" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No status data available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
