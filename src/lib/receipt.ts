import type { PrismaClient } from "@prisma/client";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Generate a unique online receipt number inside a Prisma transaction.
 * Uses findFirst + orderBy desc to avoid the race condition of count-based generation.
 */
export async function generateOnlineReceiptNumber(
  tx: TransactionClient,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RCP/${year}/ON/`;

  const lastReceipt = await tx.receipt.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
  });

  let nextNumber = 1;
  if (lastReceipt) {
    const parts = lastReceipt.receiptNumber.split("/");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}
