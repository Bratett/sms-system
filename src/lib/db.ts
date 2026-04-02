import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * Execute a callback with Row-Level Security tenant context set.
 * Sets `app.current_school_id` as a PostgreSQL session variable,
 * scoped to the transaction so it auto-clears.
 *
 * Usage:
 * ```ts
 * const students = await withTenant(schoolId, async (tx) => {
 *   return tx.student.findMany(); // RLS automatically filters by schoolId
 * });
 * ```
 */
export async function withTenant<T>(
  schoolId: string,
  fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL "app.current_school_id" = '${schoolId.replace(/'/g, "''")}'`,
    );
    return fn(tx);
  });
}
