/**
 * Worker Entry Point
 *
 * Starts all background workers and scheduled tasks.
 * Run with: npx tsx src/workers/index.ts
 *
 * Workers:
 * - SMS delivery (BullMQ)
 * - Email delivery (BullMQ)
 * - Finance penalty calculation (BullMQ)
 * - Finance payment reminders (BullMQ)
 * - Contract expiry checks (daily interval)
 * - Inventory alerts (daily interval)
 */

import { startSmsWorker } from "./sms.worker";
import { startEmailWorker } from "./email.worker";
import { startFinancePenaltyWorker } from "./finance-penalty.worker";
import { startFinanceReminderWorker } from "./finance-reminder.worker";
import { startContractExpirySchedule } from "./contract-expiry.worker";
import { runInventoryAlerts } from "./inventory-alerts.worker";

console.log("[workers] Starting all background workers...");

// ─── BullMQ Queue Workers ────────────────────────────────────────

startSmsWorker();
console.log("[workers] SMS delivery worker started");

startEmailWorker();
console.log("[workers] Email delivery worker started");

startFinancePenaltyWorker();
console.log("[workers] Finance penalty worker started");

startFinanceReminderWorker();
console.log("[workers] Finance reminder worker started");

// ─── Scheduled Tasks ─────────────────────────────────────────────

startContractExpirySchedule();
console.log("[workers] Contract expiry schedule started (daily)");

// Inventory alerts — run on startup + daily
runInventoryAlerts().catch((err) =>
  console.error("[workers] Initial inventory alerts run failed:", err),
);

const DAILY_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  runInventoryAlerts().catch((err) =>
    console.error("[workers] Inventory alerts run failed:", err),
  );
}, DAILY_MS);
console.log("[workers] Inventory alerts schedule started (daily)");

console.log("[workers] All workers started successfully.");
