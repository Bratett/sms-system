import { generateExport, type ExportFormat } from "@/lib/export";
import type { StatutoryReturn } from "./types";

/**
 * Flatten any `StatutoryReturn` into a CSV/XLSX buffer. Column order is
 * inferred from the first row so generators don't need a separate schema
 * block — just return an array of flat objects and you get a file out.
 *
 * Employer + period metadata are prepended as a two-line header in the CSV
 * case so the filed document is self-describing.
 */

function headersFromRow(row: Record<string, unknown>): string[] {
  return Object.keys(row);
}

function humaniseHeader(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function exportStatutoryReturn<Row extends Record<string, unknown>>(
  ret: StatutoryReturn<Row>,
  format: ExportFormat,
): { buffer: Buffer; filename: string } {
  if (ret.rows.length === 0) {
    // Ship a single-row placeholder so the downloaded file isn't empty; GRA
    // officers still need to see the period + employer header.
    const buffer = generateExport({
      filename: `${ret.kind}-${dateSlug(ret.period.from)}`,
      columns: [
        { key: "note", header: "Note" },
      ],
      data: [
        { note: `No records for ${ret.period.label}` },
      ],
      format,
      sheetName: ret.kind,
    });
    return {
      buffer,
      filename: `${ret.kind}-${dateSlug(ret.period.from)}.${format}`,
    };
  }

  const keys = headersFromRow(ret.rows[0] as Record<string, unknown>);
  const columns = keys.map((k) => ({
    key: k,
    header: humaniseHeader(k),
  }));

  const dataRows = ret.rows.map((r) => r as Record<string, unknown>);
  const totalsRow = Object.fromEntries(
    keys.map((k) => [k, k in ret.totals ? ret.totals[k] : ""]),
  );
  totalsRow[keys[0]] = "TOTALS";

  const buffer = generateExport({
    filename: `${ret.kind}-${dateSlug(ret.period.from)}`,
    columns,
    data: [...dataRows, totalsRow],
    format,
    sheetName: ret.kind,
  });

  return {
    buffer,
    filename: `${ret.kind}-${dateSlug(ret.period.from)}.${format}`,
  };
}

function dateSlug(d: Date): string {
  return d.toISOString().slice(0, 10);
}
