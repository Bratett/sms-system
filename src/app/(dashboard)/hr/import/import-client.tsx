"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Papa from "papaparse";
import { importStaffAction } from "@/modules/hr/actions/staff.action";

interface ParsedRow {
  firstName: string;
  lastName: string;
  otherNames?: string;
  gender: string;
  phone: string;
  email?: string;
  staffType: string;
  position: string;
  appointmentType?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

const REQUIRED_COLUMNS = ["firstName", "lastName", "gender", "phone", "position"];
const VALID_GENDERS = ["MALE", "FEMALE"];
const VALID_STAFF_TYPES = ["TEACHING", "NON_TEACHING"];
const VALID_APPOINTMENT_TYPES = ["PERMANENT", "CONTRACT", "NATIONAL_SERVICE", "VOLUNTEER"];

const SAMPLE_CSV = `firstName,lastName,otherNames,gender,phone,email,staffType,position,appointmentType
John,Doe,,MALE,0241234567,john@school.edu.gh,TEACHING,Mathematics Teacher,PERMANENT
Jane,Smith,,FEMALE,0551234567,jane@school.edu.gh,NON_TEACHING,Accountant,CONTRACT`;

export function ImportStaffClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [fileName, setFileName] = useState("");
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: { row: number; message: string }[];
  } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const parsed: ParsedRow[] = [];
        const validationErrors: ValidationError[] = [];

        for (let i = 0; i < results.data.length; i++) {
          const raw = results.data[i];
          const rowNum = i + 1;

          // Check required fields
          for (const col of REQUIRED_COLUMNS) {
            if (!raw[col]?.trim()) {
              validationErrors.push({ row: rowNum, field: col, message: `${col} is required` });
            }
          }

          const gender = (raw.gender || "").toUpperCase().trim();
          if (gender && !VALID_GENDERS.includes(gender)) {
            validationErrors.push({ row: rowNum, field: "gender", message: `Invalid gender "${raw.gender}". Must be MALE or FEMALE` });
          }

          const staffType = (raw.staffType || "TEACHING").toUpperCase().replace(/[\s-]/g, "_").trim();
          if (!VALID_STAFF_TYPES.includes(staffType)) {
            validationErrors.push({ row: rowNum, field: "staffType", message: `Invalid staff type "${raw.staffType}"` });
          }

          const appointmentType = (raw.appointmentType || "PERMANENT").toUpperCase().replace(/[\s-]/g, "_").trim();
          if (raw.appointmentType && !VALID_APPOINTMENT_TYPES.includes(appointmentType)) {
            validationErrors.push({ row: rowNum, field: "appointmentType", message: `Invalid appointment type "${raw.appointmentType}"` });
          }

          parsed.push({
            firstName: raw.firstName?.trim() || "",
            lastName: raw.lastName?.trim() || "",
            otherNames: raw.otherNames?.trim() || undefined,
            gender: gender || "",
            phone: raw.phone?.trim() || "",
            email: raw.email?.trim() || undefined,
            staffType: staffType || "TEACHING",
            position: raw.position?.trim() || "",
            appointmentType: appointmentType || "PERMANENT",
          });
        }

        setRows(parsed);
        setErrors(validationErrors);

        if (validationErrors.length > 0) {
          toast.error(`${validationErrors.length} validation error(s) found. Fix before importing.`);
        } else if (parsed.length > 0) {
          toast.success(`Parsed ${parsed.length} rows successfully.`);
        } else {
          toast.error("No data rows found in the CSV file.");
        }
      },
      error: (err) => {
        toast.error(`Failed to parse CSV: ${err.message}`);
      },
    });
  }

  function handleImport() {
    if (errors.length > 0) {
      toast.error("Please fix validation errors before importing.");
      return;
    }
    if (rows.length === 0) {
      toast.error("No rows to import.");
      return;
    }

    startTransition(async () => {
      const result = await importStaffAction(rows);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setImportResult(result);
        if (result.imported > 0) {
          toast.success(`Successfully imported ${result.imported} staff member(s).`);
        }
        if (result.errors.length > 0) {
          toast.error(`${result.errors.length} row(s) failed during import.`);
        }
      }
    });
  }

  function handleDownloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setRows([]);
    setErrors([]);
    setFileName("");
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const errorsByRow = new Map<number, ValidationError[]>();
  for (const err of errors) {
    const list = errorsByRow.get(err.row) || [];
    list.push(err);
    errorsByRow.set(err.row, list);
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Upload CSV File</h3>
          <button
            onClick={handleDownloadTemplate}
            className="text-xs text-primary hover:text-primary/80 font-medium"
          >
            Download Template
          </button>
        </div>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
            >
              {fileName ? (
                <span>
                  Selected: <span className="font-medium text-foreground">{fileName}</span> ({rows.length} rows)
                </span>
              ) : (
                <span>Click to select a CSV file or drag and drop</span>
              )}
            </label>
          </div>

          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Required columns:</p>
            <p>firstName, lastName, gender (MALE/FEMALE), phone, position</p>
            <p className="mt-1">Optional: otherNames, email, staffType (TEACHING/NON_TEACHING), appointmentType (PERMANENT/CONTRACT/NATIONAL_SERVICE/VOLUNTEER)</p>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4">
          <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
            Validation Errors ({errors.length})
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {errors.map((err, i) => (
              <div key={i} className="text-xs text-red-700 dark:text-red-300">
                Row {err.row}, {err.field}: {err.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Table */}
      {rows.length > 0 && !importResult && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">Preview ({rows.length} rows)</h3>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Clear
              </button>
              <button
                onClick={handleImport}
                disabled={isPending || errors.length > 0}
                className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Importing..." : `Import ${rows.length} Staff`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium w-10">#</th>
                  <th className="px-3 py-2 text-left font-medium">First Name</th>
                  <th className="px-3 py-2 text-left font-medium">Last Name</th>
                  <th className="px-3 py-2 text-left font-medium">Gender</th>
                  <th className="px-3 py-2 text-left font-medium">Phone</th>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Staff Type</th>
                  <th className="px-3 py-2 text-left font-medium">Position</th>
                  <th className="px-3 py-2 text-left font-medium">Appt. Type</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const rowErrors = errorsByRow.get(i + 1);
                  const hasError = !!rowErrors;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-border last:border-0 ${hasError ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                    >
                      <td className="px-3 py-2 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-3 py-2">{row.firstName || <MissingField />}</td>
                      <td className="px-3 py-2">{row.lastName || <MissingField />}</td>
                      <td className="px-3 py-2">{row.gender || <MissingField />}</td>
                      <td className="px-3 py-2">{row.phone || <MissingField />}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{row.email || "---"}</td>
                      <td className="px-3 py-2 text-xs">{row.staffType}</td>
                      <td className="px-3 py-2">{row.position || <MissingField />}</td>
                      <td className="px-3 py-2 text-xs">{row.appointmentType || "PERMANENT"}</td>
                      <td className="px-3 py-2 text-center">
                        {hasError ? (
                          <span className="text-xs text-red-600" title={rowErrors.map(e => e.message).join(", ")}>
                            Error
                          </span>
                        ) : (
                          <span className="text-xs text-green-600">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold">Import Results</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4 text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{importResult.imported}</p>
              <p className="text-xs text-green-600 dark:text-green-400">Successfully imported</p>
            </div>
            <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4 text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{importResult.errors.length}</p>
              <p className="text-xs text-red-600 dark:text-red-400">Failed rows</p>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {importResult.errors.map((err, i) => (
                <div key={i} className="text-xs text-red-600">
                  Row {err.row}: {err.message}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Import More
            </button>
            <button
              onClick={() => router.push("/hr/staff")}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View Staff Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MissingField() {
  return <span className="text-xs text-red-500 italic">missing</span>;
}
