"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import { importStudentsAction } from "@/modules/student/actions/import.action";

interface ImportError {
  row: number;
  message: string;
}

const CSV_TEMPLATE_HEADERS = [
  "firstName",
  "lastName",
  "otherNames",
  "dateOfBirth",
  "gender",
  "boardingStatus",
  "classArm",
  "guardianName",
  "guardianPhone",
  "guardianEmail",
  "guardianRelationship",
  "guardianAddress",
  "guardianOccupation",
];

const SAMPLE_ROW = [
  "Kwame",
  "Asante",
  "Kofi",
  "2008-03-15",
  "MALE",
  "BOARDING",
  "SHS 1 Science - A",
  "Ama Asante",
  "0241234567",
  "ama@example.com",
  "Mother",
  "Accra, Greater Accra",
  "Teacher",
];

export function ImportClient() {
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: ImportError[];
  } | null>(null);

  function downloadTemplate() {
    const csvContent = [
      CSV_TEMPLATE_HEADERS.join(","),
      SAMPLE_ROW.join(","),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file.");
      return;
    }

    setFileName(file.name);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        if (rows.length === 0) {
          toast.error("CSV file is empty or has no data rows.");
          return;
        }
        const fileHeaders = results.meta.fields || [];
        setHeaders(fileHeaders);
        setParsedRows(rows);
        toast.success(`Parsed ${rows.length} rows from CSV.`);
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
      },
    });
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleImport() {
    if (parsedRows.length === 0) {
      toast.error("No data to import.");
      return;
    }

    startTransition(async () => {
      const result = await importStudentsAction(parsedRows);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setImportResult(result.data);
        if (result.data.imported > 0) {
          toast.success(`Successfully imported ${result.data.imported} students.`);
        }
        if (result.data.errors.length > 0) {
          toast.error(`${result.data.errors.length} rows had errors.`);
        }
      }
    });
  }

  function handleClear() {
    setFileName("");
    setParsedRows([]);
    setHeaders([]);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const previewRows = parsedRows.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Template Download & Upload */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upload CSV File</h2>
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Download Template
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Upload a CSV file with student data. Required columns: firstName, lastName,
          dateOfBirth, gender. Optional: otherNames, boardingStatus, classArm,
          guardianName, guardianPhone, guardianEmail, guardianRelationship,
          guardianAddress, guardianOccupation.
        </p>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <svg
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          {fileName ? (
            <p className="text-sm font-medium">{fileName}</p>
          ) : (
            <>
              <p className="text-sm font-medium">
                Drag and drop a CSV file here, or click to select
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Only .csv files are accepted
              </p>
            </>
          )}
        </div>
      </div>

      {/* Preview Table */}
      {parsedRows.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Preview ({parsedRows.length} rows total, showing first{" "}
              {Math.min(5, parsedRows.length)})
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Importing..." : `Import ${parsedRows.length} Students`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-xs">#</th>
                  {headers.map((header) => (
                    <th key={header} className="px-3 py-2 text-left font-medium text-xs">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {index + 1}
                    </td>
                    {headers.map((header) => (
                      <td key={header} className="px-3 py-2 text-xs">
                        {row[header] || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > 5 && (
            <p className="mt-2 text-xs text-muted-foreground">
              ... and {parsedRows.length - 5} more rows
            </p>
          )}
        </div>
      )}

      {/* Import Results */}
      {importResult && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Import Results</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">
                {importResult.imported}
              </p>
              <p className="text-sm text-green-600">Successfully Imported</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">
                {importResult.errors.length}
              </p>
              <p className="text-sm text-red-600">Errors</p>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Error Details</h3>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-xs">Row</th>
                      <th className="px-3 py-2 text-left font-medium text-xs">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((err, index) => (
                      <tr
                        key={index}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-3 py-2 text-xs font-mono">{err.row}</td>
                        <td className="px-3 py-2 text-xs text-red-600">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
