"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { searchGraduationEligibleStudentsAction } from "@/modules/graduation/actions/graduation.action";
import { checkGraduationEligibilityAction } from "@/modules/graduation/actions/eligibility.action";

// ─── Types ──────────────────────────────────────────────────────────

interface StudentResult {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
}

interface EligibilityResult {
  studentId: string;
  studentName: string;
  isEligible: boolean;
  issues: string[];
}

// ─── Component ──────────────────────────────────────────────────────

export function EligibilityClient() {
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [checkedStudentId, setCheckedStudentId] = useState<string | null>(null);

  function handleSearch() {
    if (!searchTerm.trim()) {
      toast.error("Please enter a student name to search.");
      return;
    }

    startTransition(async () => {
      const result = await searchGraduationEligibleStudentsAction(searchTerm.trim());
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setStudents("data" in result ? result.data : []);
        setEligibility(null);
        setCheckedStudentId(null);
      }
    });
  }

  function handleCheckEligibility(student: StudentResult) {
    startTransition(async () => {
      const result = await checkGraduationEligibilityAction(student.id);
      if ("error" in result) {
        toast.error(result.error);
      } else if ("data" in result && result.data) {
        setEligibility(result.data);
        setCheckedStudentId(student.id);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search student by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="w-80 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={handleSearch}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Student Results */}
      {students.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Student ID</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-b border-border last:border-0 ${
                      checkedStudentId === s.id ? "bg-muted/30" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-muted-foreground">{s.studentId}</td>
                    <td className="px-4 py-3 font-medium">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleCheckEligibility(s)}
                        disabled={isPending}
                        className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                      >
                        Check Eligibility
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {students.length === 0 && searchTerm && !isPending && (
        <p className="text-sm text-muted-foreground">No students found. Try a different search term.</p>
      )}

      {/* Eligibility Result */}
      {eligibility && (
        <div
          className={`rounded-lg border p-4 ${
            eligibility.isEligible
              ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
              : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold">{eligibility.studentName}</h3>
            {eligibility.isEligible ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                Eligible
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                Not Eligible
              </span>
            )}
          </div>

          {!eligibility.isEligible && eligibility.issues.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Issues:</p>
              <ul className="list-disc list-inside space-y-1">
                {eligibility.issues.map((issue, idx) => (
                  <li key={idx} className="text-sm text-red-600 dark:text-red-400">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {eligibility.isEligible && (
            <p className="text-sm text-green-700 dark:text-green-300">
              This student meets all graduation requirements.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
