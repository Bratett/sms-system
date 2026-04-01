import { createWorker, getQueue, QUEUE_NAMES, type FinanceReminderJobData, type SmsJobData } from "@/lib/queue";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * Finance Reminder Worker
 * Sends SMS/email reminders for upcoming and overdue fee payments.
 */
export function startFinanceReminderWorker() {
  const worker = createWorker<FinanceReminderJobData>(
    QUEUE_NAMES.FINANCE_REMINDERS,
    async (job) => {
      const { schoolId, type, daysThreshold, channels } = job.data;

      const now = new Date();
      let bills;

      switch (type) {
        case "upcoming_due": {
          // Bills due within X days from now
          const targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() + daysThreshold);
          bills = await db.studentBill.findMany({
            where: {
              feeStructure: { schoolId },
              status: { in: ["UNPAID", "PARTIAL"] },
              dueDate: { gte: now, lte: targetDate },
            },
            include: {
              feeStructure: { select: { name: true } },
            },
          });
          break;
        }
        case "overdue": {
          // Bills overdue by more than X days
          const cutoffDate = new Date(now);
          cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);
          bills = await db.studentBill.findMany({
            where: {
              feeStructure: { schoolId },
              status: { in: ["UNPAID", "PARTIAL"] },
              dueDate: { lt: cutoffDate },
            },
            include: {
              feeStructure: { select: { name: true } },
            },
          });
          break;
        }
        case "installment_due": {
          // Installments due within X days
          const targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() + daysThreshold);
          const installments = await db.studentInstallment.findMany({
            where: {
              status: "PENDING",
              dueDate: { gte: now, lte: targetDate },
              studentBill: { feeStructure: { schoolId } },
            },
            include: {
              studentBill: { select: { studentId: true } },
            },
          });

          // Convert to bill-like format for unified processing
          bills = installments.map((inst) => ({
            studentId: inst.studentBill.studentId,
            balanceAmount: inst.amount - inst.paidAmount,
            dueDate: inst.dueDate,
            feeStructure: { name: `Installment ${inst.installmentNumber}` },
          }));
          break;
        }
      }

      if (!bills || bills.length === 0) {
        console.log(`[Reminder Worker] No ${type} bills found`);
        return;
      }

      // Get student contact info via guardians
      const studentIds = [...new Set(bills.map((b) => b.studentId))];
      // Get student contact info via StudentGuardian -> Guardian
      const students = await db.student.findMany({
        where: { id: { in: studentIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          guardians: {
            where: { isPrimary: true },
            select: {
              guardian: {
                select: { phone: true, email: true, firstName: true },
              },
            },
            take: 1,
          },
        },
      });

      const studentMap = new Map(students.map((s) => [s.id, s]));
      const smsQueue = getQueue<SmsJobData>(QUEUE_NAMES.SMS);
      let sentCount = 0;

      for (const bill of bills) {
        const student = studentMap.get(bill.studentId);
        if (!student) continue;

        const guardianLink = student.guardians[0];
        if (!guardianLink) continue;
        const guardian = guardianLink.guardian;

        const studentName = `${student.firstName} ${student.lastName}`;
        const amount = `GHS ${bill.balanceAmount.toFixed(2)}`;
        const dueDate = bill.dueDate ? new Date(bill.dueDate).toLocaleDateString("en-GH") : "N/A";
        const feeName = "feeStructure" in bill ? (bill.feeStructure as { name: string }).name : "";

        let message = "";
        switch (type) {
          case "upcoming_due":
            message = `Dear ${guardian.firstName}, this is a reminder that ${studentName}'s fees for ${feeName} (${amount}) is due on ${dueDate}. Please make payment before the due date to avoid penalties.`;
            break;
          case "overdue":
            message = `Dear ${guardian.firstName}, ${studentName}'s fees for ${feeName} (${amount}) was due on ${dueDate} and is now overdue. Please make payment immediately to avoid further penalties.`;
            break;
          case "installment_due":
            message = `Dear ${guardian.firstName}, ${studentName}'s ${feeName} payment of ${amount} is due on ${dueDate}. Please ensure timely payment.`;
            break;
        }

        if (channels.includes("sms") && guardian.phone) {
          // Create SMS log entry and queue for delivery
          const smsLog = await db.smsLog.create({
            data: {
              schoolId,
              recipientPhone: guardian.phone,
              message,
              status: "QUEUED",
            },
          });

          await smsQueue.add("send-sms", {
            smsLogId: smsLog.id,
            phone: guardian.phone,
            message,
          });

          sentCount++;
        }
      }

      console.log(`[Reminder Worker] Sent ${sentCount} ${type} reminders for ${bills.length} bills`);
    },
    { concurrency: 1 },
  );

  worker.on("completed", (job) => {
    console.log(`[Reminder Worker] Job completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Reminder Worker] Job failed: ${job?.id}`, err.message);
  });

  return worker;
}
