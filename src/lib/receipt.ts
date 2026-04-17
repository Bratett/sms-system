import type { PrismaClient } from "@prisma/client";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Generate a unique online receipt number using a PostgreSQL sequence.
 * Sequences are atomic and immune to race conditions under concurrent load.
 *
 * Each school+year gets its own sequence, created on first use.
 */
export async function generateOnlineReceiptNumber(
  tx: TransactionClient,
  schoolId?: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RCP/${year}/ON/`;

  // Use a safe sequence name derived from schoolId and year
  const suffix = schoolId ? schoolId.replace(/[^a-zA-Z0-9]/g, "_") : "global";
  const seqName = `receipt_seq_${suffix}_${year}`;

  // Create sequence if it doesn't exist (idempotent)
  await tx.$executeRawUnsafe(
    `CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1`,
  );

  // Fetch the next value atomically
  const result: Array<{ nextval: bigint }> = await tx.$queryRawUnsafe(
    `SELECT nextval('"${seqName}"')`,
  );

  const nextNumber = Number(result[0].nextval);
  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}
