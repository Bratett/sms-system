import * as XLSX from "xlsx";
import Papa from "papaparse";

/**
 * Export Infrastructure
 * Generates CSV and Excel files from structured data.
 */

export type ExportFormat = "csv" | "xlsx";

interface ExportColumn {
  key: string;
  header: string;
  transform?: (value: unknown) => string;
}

interface ExportOptions {
  filename: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  format: ExportFormat;
  sheetName?: string;
}

// ─── Generate Export Buffer ────────────────────────────────────────

export function generateExport(opts: ExportOptions): Buffer {
  const rows = opts.data.map((row) =>
    opts.columns.reduce(
      (acc, col) => {
        const value = row[col.key];
        acc[col.header] = col.transform ? col.transform(value) : String(value ?? "");
        return acc;
      },
      {} as Record<string, string>,
    ),
  );

  switch (opts.format) {
    case "csv":
      return generateCsv(rows);
    case "xlsx":
      return generateExcel(rows, opts.sheetName || "Sheet1");
    default:
      throw new Error(`Unsupported export format: ${opts.format}`);
  }
}

function generateCsv(rows: Record<string, string>[]): Buffer {
  const csv = Papa.unparse(rows);
  return Buffer.from(csv, "utf-8");
}

function generateExcel(rows: Record<string, string>[], sheetName: string): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(key.length, ...rows.map((r) => String(r[key] || "").length)) + 2,
  }));
  worksheet["!cols"] = colWidths;

  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

// ─── Content Types ─────────────────────────────────────────────────

export function getExportContentType(format: ExportFormat): string {
  switch (format) {
    case "csv":
      return "text/csv";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
}

export function getExportExtension(format: ExportFormat): string {
  return format;
}
