"use client";

import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────

interface StoreRow {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  totalValue: number;
  lowStockCount: number;
}

interface LowStockAlert {
  storeId: string;
  storeName: string;
  items: Array<{
    id: string;
    name: string;
    code: string | null;
    quantity: number;
    reorderLevel: number;
    unit: string;
  }>;
}

interface ValuationRow {
  storeId: string;
  storeName: string;
  itemCount: number;
  totalValue: number;
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const quickLinks = [
  { title: "Stores", description: "Manage stores and locations", href: "/inventory/stores" },
  { title: "Items", description: "Item catalog and inventory", href: "/inventory/items" },
  { title: "Stock Movement", description: "Track stock in/out and adjustments", href: "/inventory/stock-movement" },
  { title: "Suppliers", description: "Supplier directory", href: "/inventory/suppliers" },
  { title: "Procurement", description: "Purchase requests and orders", href: "/inventory/procurement" },
  { title: "Reports", description: "Inventory reports and analytics", href: "/inventory/reports" },
];

// ─── Component ──────────────────────────────────────────────────────

export function InventoryDashboardClient({
  stores,
  lowStockAlerts,
  valuation,
  grandTotal,
}: {
  stores: StoreRow[];
  lowStockAlerts: LowStockAlert[];
  valuation: ValuationRow[];
  grandTotal: number;
}) {
  const totalItems = stores.reduce((sum, s) => sum + s.itemCount, 0);
  const totalLowStock = lowStockAlerts.reduce((sum, a) => sum + a.items.length, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Total Stores</p>
          <p className="mt-2 text-3xl font-bold">{stores.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Total Items</p>
          <p className="mt-2 text-3xl font-bold">{totalItems}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Total Stock Value</p>
          <p className="mt-2 text-3xl font-bold">{formatCurrency(grandTotal)}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Low Stock Alerts</p>
          <p className={`mt-2 text-3xl font-bold ${totalLowStock > 0 ? "text-red-600" : ""}`}>
            {totalLowStock}
          </p>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockAlerts.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold text-red-600">Low Stock Alerts</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {lowStockAlerts.map((alert) => (
                <div key={alert.storeId}>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                    {alert.storeName}
                  </h3>
                  <div className="space-y-1">
                    {alert.items.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded bg-red-50 px-3 py-2 text-sm dark:bg-red-950/20"
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-red-600">
                          {item.quantity} / {item.reorderLevel} {item.unit}
                        </span>
                      </div>
                    ))}
                    {alert.items.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{alert.items.length - 5} more items
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Store Summary */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Store Summary</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <Link
                key={store.id}
                href={`/inventory/items?storeId=${store.id}`}
                className="rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <h3 className="font-semibold">{store.name}</h3>
                {store.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{store.description}</p>
                )}
                <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{store.itemCount} items</span>
                  <span>{formatCurrency(store.totalValue)}</span>
                </div>
                {store.lowStockCount > 0 && (
                  <span className="mt-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                    {store.lowStockCount} low stock
                  </span>
                )}
              </Link>
            ))}
            {stores.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">
                No stores configured. Create a store to get started.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <h3 className="font-medium">{link.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{link.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
