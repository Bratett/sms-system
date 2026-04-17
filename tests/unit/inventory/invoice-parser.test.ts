import { describe, it, expect } from "vitest";
import { parseInvoiceText } from "@/lib/inventory/invoice-parser";

const SAMPLE = `
PENTACORP SUPPLIES GHANA LTD
From: Pentacorp Supplies

Invoice No: INV-00123
Date: 2026-04-12
TIN: GH-1234567890
Due: 2026-05-12

Description                Qty   Unit    Total
Exercise books              50   12.00   600.00
Chalk (box)                 20    5.00   100.00

Subtotal:                              700.00
VAT 15%:                               105.00
Grand Total: GHS                       805.00
`;

describe("invoice parser", () => {
  it("extracts invoice number + date + totals", () => {
    const parsed = parseInvoiceText(SAMPLE);
    expect(parsed.invoiceNumber).toBe("INV-00123");
    expect(parsed.invoiceDate?.toISOString().slice(0, 10)).toBe("2026-04-12");
    expect(parsed.dueDate?.toISOString().slice(0, 10)).toBe("2026-05-12");
    expect(parsed.totalAmount).toBe(805);
    expect(parsed.subTotal).toBe(700);
    expect(parsed.taxAmount).toBe(105);
    expect(parsed.supplierTin).toBe("GH-1234567890");
    expect(parsed.currency).toBe("GHS");
  });

  it("extracts line items", () => {
    const parsed = parseInvoiceText(SAMPLE);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].description).toMatch(/Exercise books/);
    expect(parsed.items[0].quantity).toBe(50);
    expect(parsed.items[0].unitPrice).toBe(12);
    expect(parsed.items[0].lineTotal).toBe(600);
  });

  it("flags a warning when subtotal disagrees with line sum", () => {
    const bad = SAMPLE.replace("Subtotal:                              700.00", "Subtotal:                              999.00");
    const parsed = parseInvoiceText(bad);
    expect(parsed.warnings.some((w) => /subtotal/i.test(w))).toBe(true);
  });

  it("parses ISO dates", () => {
    const txt = "Invoice No: X-1\nDate: 2026-01-02\nTotal: 100.00";
    const parsed = parseInvoiceText(txt);
    expect(parsed.invoiceDate?.toISOString().slice(0, 10)).toBe("2026-01-02");
  });

  it("parses named-month dates", () => {
    const txt = "Invoice No: X-1\nDate: 12 April 2026\nTotal: 50.00";
    const parsed = parseInvoiceText(txt);
    expect(parsed.invoiceDate?.toISOString().slice(0, 10)).toBe("2026-04-12");
  });

  it("emits a warning when no line items present", () => {
    const parsed = parseInvoiceText("Invoice No: X\nDate: 2026-01-01\nTotal: 5.00");
    expect(parsed.items).toHaveLength(0);
    expect(parsed.warnings.some((w) => /line items/i.test(w))).toBe(true);
  });

  it("returns a low confidence when fields are missing", () => {
    const parsed = parseInvoiceText("Random text with no invoice number or date.");
    expect(parsed.confidence).toBeLessThan(0.3);
    expect(parsed.invoiceNumber).toBeNull();
  });
});
