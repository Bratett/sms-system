/**
 * Client-safe monetary type.
 *
 * Prisma Decimal objects are returned from server actions for monetary fields.
 * This type is safe to import in "use client" components (no @prisma/client dep).
 *
 * Use `Number(value)` to convert before arithmetic or display.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Monetary = number | { toNumber(): number; toString(): string; [key: string]: any };
