import { Prisma } from "@prisma/client";

/**
 * Convert a Prisma Decimal (or number/null/undefined) to a plain JS number.
 * Use at read boundaries when Prisma returns Decimal objects for monetary fields.
 */
export function toNum(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}
