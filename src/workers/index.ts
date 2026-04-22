/**
 * Worker Entry Point
 *
 * Starts all background workers and scheduled tasks.
 * Run with: npx tsx src/workers/index.ts
 *
 * Workers:
 * - SMS delivery (BullMQ)
 * - Email delivery (BullMQ)
 * - WhatsApp delivery (BullMQ) — mock when Meta credentials are absent
 * - Finance penalty calculation (BullMQ)
 * - Finance payment reminders (BullMQ)
 * - Contract expiry checks (daily interval)
 * - Inventory alerts (daily interval)
 */

import { logger } from "@/lib/logger";
import { startSmsWorker } from "./sms.worker";
import { startEmailWorker } from "./email.worker";
import { startWhatsAppWorker } from "./whatsapp.worker";
import { startFinancePenaltyWorker } from "./finance-penalty.worker";
import { startFinanceReminderWorker } from "./finance-reminder.worker";
import { startContractExpirySchedule } from "./contract-expiry.worker";
import { runInventoryAlerts } from "./inventory-alerts.worker";
import { startCampaignDispatchSchedule } from "./campaign-dispatch.worker";
import { startLicenceExpirySchedule } from "./licence-expiry.worker";
import { startDunningSchedule } from "./dunning.worker";
import { startAdmissionsSchedule } from "./admissions-schedule.worker";
import { startPdfBatchWorker } from "./pdf-batch.worker";

const log = logger.child({ component: "workers" });

log.info("Starting all background workers");

// ─── BullMQ Queue Workers ────────────────────────────────────────

startSmsWorker();
log.info("SMS delivery worker started");

startEmailWorker();
log.info("Email delivery worker started");

startWhatsAppWorker();
log.info("WhatsApp delivery worker started");

startFinancePenaltyWorker();
log.info("Finance penalty worker started");

startFinanceReminderWorker();
log.info("Finance reminder worker started");

startPdfBatchWorker();
log.info("PDF batch worker started");

// ─── Scheduled Tasks ─────────────────────────────────────────────

startContractExpirySchedule();
log.info("Contract expiry schedule started", { interval: "daily" });

startLicenceExpirySchedule();
log.info("Teacher licence expiry scheduler started", { interval: "daily" });

startCampaignDispatchSchedule();
log.info("Campaign dispatch scheduler started", { interval: "1 minute" });

startDunningSchedule();
log.info("Dunning scheduler started", { interval: "daily" });

startAdmissionsSchedule();
log.info("Admissions schedule sweep started", { interval: "hourly" });

// Inventory alerts — run on startup + daily
runInventoryAlerts().catch((err) =>
  log.error("Initial inventory alerts run failed", { error: err }),
);

const DAILY_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  runInventoryAlerts().catch((err) =>
    log.error("Inventory alerts run failed", { error: err }),
  );
}, DAILY_MS);
log.info("Inventory alerts schedule started", { interval: "daily" });

log.info("All workers started successfully");
