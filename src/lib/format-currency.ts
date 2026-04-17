import type { Monetary } from "./monetary";

export function formatCurrency(amount: Monetary | null | undefined, currency = "GHS"): string {
  const n = Number(amount ?? 0);
  return `${currency} ${n.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
