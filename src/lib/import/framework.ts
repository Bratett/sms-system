import Papa from "papaparse";

/**
 * Generic Bulk Import Framework
 * Provides parse -> validate -> preview -> commit pipeline.
 */

export interface ImportColumn {
  key: string;
  header: string;
  required?: boolean;
  validate?: (value: string) => string | null; // returns error message or null
}

export interface ImportResult<T> {
  valid: T[];
  errors: ImportError[];
  totalRows: number;
  validCount: number;
  errorCount: number;
}

export interface ImportError {
  row: number;
  column?: string;
  value?: string;
  message: string;
}

/**
 * Parse a CSV string and validate each row against column definitions.
 * Returns validated rows and row-level errors for preview-before-commit.
 */
export function parseAndValidate<T extends Record<string, unknown>>(
  csvContent: string,
  columns: ImportColumn[],
): ImportResult<T> {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: ImportError[] = [];
  const valid: T[] = [];

  // Check for required headers
  const headers = parsed.meta.fields || [];
  for (const col of columns) {
    if (col.required && !headers.includes(col.header)) {
      errors.push({
        row: 0,
        column: col.header,
        message: `Missing required column: "${col.header}"`,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: [], errors, totalRows: 0, validCount: 0, errorCount: errors.length };
  }

  // Validate each row
  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, string>;
    const rowNum = i + 2; // 1-indexed + header row
    let rowValid = true;

    const mapped: Record<string, unknown> = {};

    for (const col of columns) {
      const value = (row[col.header] || "").trim();

      if (col.required && !value) {
        errors.push({ row: rowNum, column: col.header, message: `Required field is empty` });
        rowValid = false;
        continue;
      }

      if (value && col.validate) {
        const error = col.validate(value);
        if (error) {
          errors.push({ row: rowNum, column: col.header, value, message: error });
          rowValid = false;
          continue;
        }
      }

      mapped[col.key] = value || null;
    }

    if (rowValid) {
      valid.push(mapped as T);
    }
  }

  return {
    valid,
    errors,
    totalRows: parsed.data.length,
    validCount: valid.length,
    errorCount: errors.length,
  };
}

/**
 * Generate a CSV template from column definitions.
 */
export function generateTemplate(columns: ImportColumn[]): string {
  return columns.map((c) => c.header).join(",") + "\n";
}
