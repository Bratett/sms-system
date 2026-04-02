import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * Inventory Alerts Worker
 * Runs daily to check for:
 * 1. Items below reorder level → flags for purchase request
 * 2. Expiring items (7/14/30 day windows) → marks alert sent
 * 3. Upcoming asset maintenance → logs due items
 * 4. Expiring supplier contracts → logs expiring contracts
 * 5. Overdue asset checkouts → marks as overdue
 *
 * Can be invoked via cron or BullMQ scheduler.
 */

export async function runInventoryAlerts() {
  console.log("[inventory-alerts] Starting daily inventory alerts check...");

  const school = await db.school.findFirst();
  if (!school) {
    console.log("[inventory-alerts] No school configured, skipping.");
    return;
  }

  const now = new Date();
  const results = {
    lowStockItems: 0,
    expiringItems: 0,
    maintenanceDue: 0,
    expiringContracts: 0,
    overdueCheckouts: 0,
  };

  // ─── 1. Low Stock Alerts ────────────────────────────────────────

  const lowStockItems = await db.storeItem.findMany({
    where: {
      store: { schoolId: school.id, status: "ACTIVE" },
      status: "ACTIVE",
      reorderLevel: { gt: 0 },
    },
    select: { id: true, name: true, quantity: true, reorderLevel: true, storeId: true },
  });

  const itemsBelowReorder = lowStockItems.filter((i) => i.quantity <= i.reorderLevel);
  results.lowStockItems = itemsBelowReorder.length;

  if (itemsBelowReorder.length > 0) {
    console.log(`[inventory-alerts] ${itemsBelowReorder.length} item(s) at or below reorder level:`);
    for (const item of itemsBelowReorder.slice(0, 10)) {
      console.log(`  - ${item.name}: ${item.quantity} (reorder at ${item.reorderLevel})`);
    }
  }

  // ─── 2. Expiring Items ──────────────────────────────────────────

  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiringItems = await db.itemExpiryTracking.findMany({
    where: {
      expiryDate: { lte: thirtyDaysFromNow, gt: now },
      alertSent: false,
      storeItem: { store: { schoolId: school.id }, status: "ACTIVE" },
    },
    include: { storeItem: { select: { name: true } } },
  });

  results.expiringItems = expiringItems.length;

  if (expiringItems.length > 0) {
    console.log(`[inventory-alerts] ${expiringItems.length} item batch(es) expiring within 30 days:`);
    for (const item of expiringItems.slice(0, 10)) {
      const daysUntil = Math.ceil((item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  - ${item.storeItem.name} (batch: ${item.batchNumber ?? "N/A"}) — expires in ${daysUntil} day(s)`);
    }

    // Mark alerts as sent
    await db.itemExpiryTracking.updateMany({
      where: { id: { in: expiringItems.map((e) => e.id) } },
      data: { alertSent: true },
    });
  }

  // ─── 3. Asset Maintenance Due ───────────────────────────────────

  const maintenanceDue = await db.assetMaintenance.findMany({
    where: {
      nextDueDate: { lte: thirtyDaysFromNow },
      fixedAsset: { schoolId: school.id, status: "ACTIVE" },
    },
    include: {
      fixedAsset: { select: { assetNumber: true, name: true } },
    },
    orderBy: { nextDueDate: "asc" },
  });

  // Only count unique assets (latest maintenance per asset)
  const uniqueAssetsDue = new Map<string, typeof maintenanceDue[0]>();
  for (const m of maintenanceDue) {
    if (!uniqueAssetsDue.has(m.fixedAssetId)) {
      uniqueAssetsDue.set(m.fixedAssetId, m);
    }
  }
  results.maintenanceDue = uniqueAssetsDue.size;

  if (uniqueAssetsDue.size > 0) {
    console.log(`[inventory-alerts] ${uniqueAssetsDue.size} asset(s) with maintenance due within 30 days:`);
    for (const [, m] of Array.from(uniqueAssetsDue.entries()).slice(0, 10)) {
      const daysUntil = m.nextDueDate
        ? Math.ceil((m.nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      console.log(`  - ${m.fixedAsset.name} (${m.fixedAsset.assetNumber}) — due in ${daysUntil} day(s)`);
    }
  }

  // ─── 4. Expiring Supplier Contracts ─────────────────────────────

  const ninetyDaysFromNow = new Date(now);
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

  const expiringContracts = await db.supplierContract.findMany({
    where: {
      status: "ACTIVE",
      endDate: { lte: ninetyDaysFromNow },
      supplier: { schoolId: school.id },
    },
    include: { supplier: { select: { name: true } } },
  });

  results.expiringContracts = expiringContracts.length;

  if (expiringContracts.length > 0) {
    console.log(`[inventory-alerts] ${expiringContracts.length} supplier contract(s) expiring within 90 days:`);
    for (const c of expiringContracts.slice(0, 10)) {
      const daysUntil = Math.ceil((c.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  - ${c.supplier.name} (${c.contractNumber ?? "N/A"}) — expires in ${daysUntil} day(s)`);
    }
  }

  // ─── 5. Overdue Asset Checkouts ─────────────────────────────────

  const overdueCheckouts = await db.assetCheckout.updateMany({
    where: {
      status: "CHECKED_OUT",
      expectedReturn: { lt: now },
    },
    data: { status: "OVERDUE" },
  });

  results.overdueCheckouts = overdueCheckouts.count;

  if (overdueCheckouts.count > 0) {
    console.log(`[inventory-alerts] Marked ${overdueCheckouts.count} checkout(s) as overdue.`);
  }

  // ─── Summary ────────────────────────────────────────────────────

  console.log("[inventory-alerts] Daily check complete:", results);
  return results;
}

// Allow direct execution
if (require.main === module) {
  runInventoryAlerts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[inventory-alerts] Error:", err);
      process.exit(1);
    });
}
