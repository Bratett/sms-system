import type { ReactElement } from "react";

/**
 * Code-side registry of React-PDF components that `DocumentTemplate` rows
 * can reference by `componentKey`. Keeping this registry tiny and explicit
 * prevents arbitrary imports at render time — callers can only produce PDFs
 * from components the app has opted into.
 *
 * Existing templates under `src/lib/pdf/templates/` are deliberately NOT
 * mass-registered here yet because each takes a bespoke data shape. Add
 * them one at a time as callers need them through the template registry
 * (versioned, auditable) rather than ad-hoc imports.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = any;
type PdfComponent = (props: AnyProps) => ReactElement;

const registry: Record<string, PdfComponent> = {};

export function registerReactPdfComponent(key: string, component: PdfComponent): void {
  if (registry[key]) {
    throw new Error(`React-PDF component '${key}' is already registered.`);
  }
  registry[key] = component;
}

export function getReactPdfComponent(key: string): PdfComponent | undefined {
  return registry[key];
}

export function listRegisteredReactPdfComponents(): string[] {
  return Object.keys(registry);
}

// ─── Built-in registrations ─────────────────────────────────────────
// Seeded at module load so these PDFs are immediately callable from both
// the document-template pipeline and any direct API route that renders
// one of them. Each key matches the `componentKey` on the global
// DocumentTemplate rows created by `prisma/seed/index.ts`.

import { ItemBankPaperPdf } from "@/lib/pdf/templates/item-bank-paper";
import { Payslip } from "@/lib/pdf/templates/payslip";
import { ReportCard } from "@/lib/pdf/templates/report-card";
import { Broadsheet } from "@/lib/pdf/templates/broadsheet";
import { Receipt } from "@/lib/pdf/templates/receipt";

const BUILTINS: Array<[string, PdfComponent]> = [
  ["item-bank-paper", ItemBankPaperPdf as PdfComponent],
  ["payslip", Payslip as PdfComponent],
  ["report-card", ReportCard as PdfComponent],
  ["broadsheet", Broadsheet as PdfComponent],
  ["receipt", Receipt as PdfComponent],
];

for (const [key, component] of BUILTINS) {
  if (!registry[key]) registerReactPdfComponent(key, component);
}
