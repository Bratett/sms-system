"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getChildResultsAction } from "@/modules/portal/actions/parent.action";

interface ChildData {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
}

interface SubjectResultData {
  id: string;
  subjectName: string;
  subjectCode: string | null;
  classScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  grade: string | null;
  interpretation: string | null;
  position: number | null;
}

interface ResultData {
  id: string;
  totalScore: number | null;
  averageScore: number | null;
  classPosition: number | null;
  overallGrade: string | null;
  teacherRemarks: string | null;
  headmasterRemarks: string | null;
  promotionStatus: string | null;
  subjectResults: SubjectResultData[];
}

interface TermOption {
  id: string;
  name: string;
  termNumber: number;
  academicYearName: string;
}

interface ResultsResponse {
  terms: TermOption[];
  result: ResultData | null;
  student: { id: string; studentId: string; fullName: string } | null;
}

interface ResultsClientProps {
  students: ChildData[];
}

export function ResultsClient({ students }: ResultsClientProps) {
  const searchParams = useSearchParams();
  const initialStudentId = searchParams.get("studentId") || students[0]?.id || "";

  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [resultsData, setResultsData] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedStudentId) return;
    let cancelled = false;
    setLoading(true);
    getChildResultsAction(selectedStudentId, selectedTermId || undefined)
      .then((res) => {
        if (cancelled) return;
        if ("data" in res && res.data) {
          setResultsData(res.data as unknown as ResultsResponse);
          if (!selectedTermId && res.data.terms.length > 0) {
            setSelectedTermId(res.data.terms[0].id);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId, selectedTermId]);

  const gradeColorClass = (grade: string | null) => {
    if (!grade) return "bg-gray-100 text-gray-700";
    switch (grade) {
      case "A1":
      case "A":
        return "bg-green-100 text-green-700";
      case "B2":
      case "B3":
      case "B":
        return "bg-blue-100 text-blue-700";
      case "C4":
      case "C5":
      case "C6":
      case "C":
        return "bg-yellow-100 text-yellow-700";
      case "D7":
      case "D":
        return "bg-orange-100 text-orange-700";
      case "E8":
      case "F9":
      case "E":
      case "F":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Results"
        description="View your children's academic results and report cards."
      />

      {/* Selectors */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row">
        {students.length > 1 && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Select Child</label>
            <select
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                setSelectedTermId("");
              }}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {students.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.firstName} {child.lastName} ({child.studentId})
                </option>
              ))}
            </select>
          </div>
        )}

        {resultsData && resultsData.terms.length > 0 && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Select Term</label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {resultsData.terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.academicYearName} - {term.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : resultsData?.result ? (
        <>
          {/* Summary Card */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-cyan-50 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                Report Summary
                {resultsData.student && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    - {resultsData.student.fullName}
                  </span>
                )}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-xs text-gray-500">Average Score</p>
                <p className="mt-1 text-2xl font-bold text-teal-600">
                  {resultsData.result.averageScore?.toFixed(1) ?? "N/A"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Overall Grade</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {resultsData.result.overallGrade ?? "N/A"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Class Position</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {resultsData.result.classPosition
                    ? `${resultsData.result.classPosition}${getOrdinalSuffix(resultsData.result.classPosition)}`
                    : "N/A"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Total Score</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {resultsData.result.totalScore?.toFixed(1) ?? "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Subject Results Table */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">Subject Results</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3">Subject</th>
                    <th className="px-5 py-3 text-center">Class Score</th>
                    <th className="px-5 py-3 text-center">Exam Score</th>
                    <th className="px-5 py-3 text-center">Total</th>
                    <th className="px-5 py-3 text-center">Grade</th>
                    <th className="px-5 py-3">Interpretation</th>
                    <th className="px-5 py-3 text-center">Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resultsData.result.subjectResults.map((sr) => (
                    <tr key={sr.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {sr.subjectName}
                        {sr.subjectCode && (
                          <span className="ml-1 text-xs text-gray-400">({sr.subjectCode})</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">{sr.classScore?.toFixed(1) ?? "-"}</td>
                      <td className="px-5 py-3 text-center">{sr.examScore?.toFixed(1) ?? "-"}</td>
                      <td className="px-5 py-3 text-center font-semibold">
                        {sr.totalScore?.toFixed(1) ?? "-"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${gradeColorClass(sr.grade)}`}
                        >
                          {sr.grade ?? "-"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{sr.interpretation ?? "-"}</td>
                      <td className="px-5 py-3 text-center">
                        {sr.position ? `${sr.position}${getOrdinalSuffix(sr.position)}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks */}
          {(resultsData.result.teacherRemarks || resultsData.result.headmasterRemarks) && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="mb-3 text-base font-semibold text-gray-900">Remarks</h3>
              <div className="space-y-3">
                {resultsData.result.teacherRemarks && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">Class Teacher</p>
                    <p className="mt-0.5 text-sm text-gray-700 italic">
                      &ldquo;{resultsData.result.teacherRemarks}&rdquo;
                    </p>
                  </div>
                )}
                {resultsData.result.headmasterRemarks && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">Headmaster</p>
                    <p className="mt-0.5 text-sm text-gray-700 italic">
                      &ldquo;{resultsData.result.headmasterRemarks}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">No Results Available</h3>
          <p className="mt-1 text-sm text-gray-500">
            {students.length === 0
              ? "No children are linked to your account."
              : "No results have been published for the selected term."}
          </p>
        </div>
      )}
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
