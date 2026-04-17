/**
 * Supplier-invoice text parser.
 *
 * Operators in Ghana commonly receive PDFs from suppliers either as email
 * attachments or scanned images. This module handles the **text-extraction
 * to structured-invoice** half of that flow — full OCR (image → text) is
 * an optional plug-in that delegates to an external service (Tesseract,
 * AWS Textract, GCP DocAI). When the text is already machine-readable
 * (PDF-to-text via `pdf-parse` or a mail-forwarder that posts the email
 * body), this parser produces a draft SupplierInvoice payload that the
 * operator can review before committing.
 *
 * Design choices:
 *   • Deterministic regex heuristics rather than an LLM call — predictable,
 *     offline-friendly, and easy to unit-test.
 *   • Emits a `confidence` score per field so the UI can flag low-confidence
 *     extractions for manual correction.
 *   • Always returns a parse result (never throws) — callers decide whether
 *     the draft is good enough to persist.
 */

export interface ParsedInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  confidence: number; // 0..1
}

export interface ParsedInvoice {
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  dueDate: Date | null;
  supplierName: string | null;
  supplierTin: string | null;
  subTotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  currency: string;
  items: ParsedInvoiceLine[];
  warnings: string[];
  confidence: number; // overall 0..1
  raw: { charsExtracted: number; linesExtracted: number };
}

// Anchored with word boundaries so "inv" can't match inside "invoice"; the
// captured ID must contain at least one digit or dash so free-text words
// ("number", "or date") don't pass as invoice numbers.
const INVOICE_NUMBER_RE =
  /\b(?:invoice|inv|bill)\b(?:\s*(?:no\.?|number|#))?[\s.#:]*([A-Z0-9/-]*[0-9\-/][A-Z0-9/-]*)/i;
const TIN_RE = /(?:TIN|VAT[- ]?(?:ID|No))[\s.:]*([A-Z0-9-]{6,20})/i;
const CURRENCY_RE = /\b(GHS|USD|EUR|GBP|NGN)\b/;
const DATE_RE =
  /(?:date|invoice date|issued)[\s.:]*((?:\d{1,2}[-/. ]\d{1,2}[-/. ]\d{2,4})|(?:\d{4}-\d{2}-\d{2})|(?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}))/i;
const DUE_DATE_RE =
  /(?:due|payable|payment due)(?:\s+date)?[\s.:]*((?:\d{1,2}[-/. ]\d{1,2}[-/. ]\d{2,4})|(?:\d{4}-\d{2}-\d{2})|(?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}))/i;
const SUBTOTAL_RE =
  /\bsub[\s-]?total\b[\s.:]*(?:GHS|USD|EUR|GBP|NGN)?\s*([\d,]+(?:\.\d{1,2})?)/i;
const TAX_RE =
  /\b(?:VAT|TAX|NHIL|GETFund)\b(?:\s+\d+%)?[\s.:]*(?:GHS|USD|EUR|GBP|NGN)?\s*([\d,]+(?:\.\d{1,2})?)/i;
// Word-boundaried so "total" doesn't match inside "Subtotal".
const TOTAL_RE =
  /(?:\bgrand\s+)?\btotal\b(?:\s+due)?[\s.:]*(?:GHS|USD|EUR|GBP|NGN)?\s*([\d,]+(?:\.\d{1,2})?)/i;
const SUPPLIER_FROM_RE = /(?:from|supplier|vendor|issued by)[\s.:]*([^\n\r]{3,80})/i;
const LINE_ITEM_RE =
  /^\s*(.+?)\s{2,}(\d+(?:\.\d+)?)\s+(?:GHS|USD|EUR|GBP|NGN)?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:GHS|USD|EUR|GBP|NGN)?\s*([\d,]+(?:\.\d{1,2})?)\s*$/;

export function parseInvoiceText(raw: string): ParsedInvoice {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const warnings: string[] = [];
  const confidences: number[] = [];

  const take = (re: RegExp): string | null => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };
  const recordConf = (v: unknown, weight = 1) => confidences.push(v ? weight : 0);

  const invoiceNumber = take(INVOICE_NUMBER_RE);
  recordConf(invoiceNumber);

  const supplierTin = take(TIN_RE);
  recordConf(supplierTin, 0.5);

  const currencyMatch = text.match(CURRENCY_RE);
  const currency = currencyMatch ? currencyMatch[1] : "GHS";
  recordConf(currencyMatch, 0.5);

  const invoiceDate = parseDate(take(DATE_RE));
  recordConf(invoiceDate);

  const dueDate = parseDate(take(DUE_DATE_RE));
  // due date is optional — don't penalise if missing.

  const subTotal = parseMoney(take(SUBTOTAL_RE));
  recordConf(subTotal);

  const taxAmount = parseMoney(take(TAX_RE));
  // tax is optional.

  const totalAmount = parseMoney(take(TOTAL_RE));
  recordConf(totalAmount, 1.5);

  const supplierName = take(SUPPLIER_FROM_RE);
  recordConf(supplierName, 0.3);

  const items: ParsedInvoiceLine[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(LINE_ITEM_RE);
    if (!m) continue;
    const [, description, qtyStr, unitStr, totalStr] = m;
    const quantity = parseMoney(qtyStr) ?? 0;
    const unitPrice = parseMoney(unitStr) ?? 0;
    const lineTotal = parseMoney(totalStr) ?? 0;
    // sanity: quantity * unitPrice ≈ lineTotal within 1%
    const expected = quantity * unitPrice;
    const diff = expected === 0 ? 1 : Math.abs(expected - lineTotal) / Math.max(expected, 0.01);
    const confidence = diff < 0.02 ? 1 : diff < 0.1 ? 0.7 : 0.4;
    if (description.length >= 2 && quantity > 0 && unitPrice >= 0) {
      items.push({ description: description.trim(), quantity, unitPrice, lineTotal, confidence });
    }
  }

  if (items.length === 0) {
    warnings.push("No line items parsed — upload the machine-readable invoice body, not the scanned image.");
  }

  // Reconcile totals: if subTotal is known, sum(items) should agree.
  if (subTotal !== null && items.length > 0) {
    const lineSum = items.reduce((s, i) => s + i.lineTotal, 0);
    if (Math.abs(lineSum - subTotal) > 0.5) {
      warnings.push(
        `Sum of parsed line items (${lineSum.toFixed(2)}) disagrees with invoice subtotal (${subTotal.toFixed(2)}).`,
      );
    }
  }

  // Overall confidence: mean of individual confidences, capped 0..1
  const overall =
    confidences.length === 0
      ? 0
      : Math.min(1, confidences.reduce((a, b) => a + b, 0) / confidences.length);

  return {
    invoiceNumber,
    invoiceDate,
    dueDate,
    supplierName,
    supplierTin,
    subTotal,
    taxAmount,
    totalAmount,
    currency,
    items,
    warnings,
    confidence: Number(overall.toFixed(2)),
    raw: {
      charsExtracted: text.length,
      linesExtracted: text.split("\n").length,
    },
  };
}

function parseMoney(s: string | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const isoLike = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (isoLike) {
    const [, y, m, d] = isoLike;
    return toDate(+y, +m, +d);
  }
  const dmy = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    const fullYear = +y < 100 ? 2000 + +y : +y;
    return toDate(fullYear, +m, +d);
  }
  const named = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/.exec(s);
  if (named) {
    const [, d, monStr, y] = named;
    const mon = parseMonthName(monStr);
    if (mon === null) return null;
    const fullYear = +y < 100 ? 2000 + +y : +y;
    return toDate(fullYear, mon, +d);
  }
  return null;
}

function toDate(y: number, m: number, d: number): Date | null {
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};
function parseMonthName(s: string): number | null {
  return MONTHS[s.toLowerCase()] ?? null;
}
