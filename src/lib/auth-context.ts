import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import type { Session } from "next-auth";
import type { PrismaClient } from "@prisma/client";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Require an authenticated session. Returns the session or an error object.
 *
 * Usage in server actions:
 * ```ts
 * const ctx = await requireAuth();
 * if ("error" in ctx) return ctx;
 * // ctx.session is guaranteed to have a user
 * ```
 */
export async function requireAuth(): Promise<
  { session: Session } | { error: string }
> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }
  return { session };
}

/**
 * Require an authenticated session with an active school context.
 * Returns the session, schoolId, and a tenant-scoped transaction helper.
 *
 * This replaces the two-step pattern:
 *   const session = await auth();
 *   const school = await db.school.findFirst();
 *
 * Usage in server actions:
 * ```ts
 * const ctx = await requireSchoolContext();
 * if ("error" in ctx) return ctx;
 * // ctx.session, ctx.schoolId are guaranteed
 *
 * // For RLS-scoped transactions (defense-in-depth):
 * const result = await ctx.withTenant(async (tx) => {
 *   return tx.student.findMany(); // RLS filters by schoolId automatically
 * });
 * ```
 */
export async function requireSchoolContext(): Promise<
  {
    session: Session;
    schoolId: string;
    withTenant: <T>(fn: (tx: TransactionClient) => Promise<T>) => Promise<T>;
  } | { error: string }
> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }
  const schoolId = session.user.schoolId;
  if (!schoolId) {
    return { error: "No school context. Please select an active school." };
  }
  return {
    session,
    schoolId,
    withTenant: <T>(fn: (tx: TransactionClient) => Promise<T>) => withTenant(schoolId, fn),
  };
}
