"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { getMyResultsAction } from "@/modules/portal/actions/student-portal.action";

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
}

interface MyResultsClientProps {
  initialData: ResultsResponse | null;
  error: string | null;
}

export function MyResultsClient({ initialData, error }: MyResultsClientProps) {
  const [data, setData] = useState<ResultsResponse | null>(initialData);
  const [selectedTermId, setSelectedTermId] = useState(
    initialData?.terms?.[0]?.id ?? "",
  );
  const [loading, setLoading] = useState(false);

  const handleTermChange = async (termId: string) => {
    setSelectedTermId(termId);
    setLoading(true);
    try {
      const result = await getMyResultsAction(termId);
      if ("data" in result && result.data) {
        setData(result.data as unknown as ResultsResponse);
      }
    } finally {
      setLoading(false);
    }
  };

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

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Results" />
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">Unable to Load Results</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Results"
        description="View your academic results by term."
      />

      {/* Term Selector */}
      {data && data.terms.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <label className="block text-sm font-medium text-gray-700">Select Term</label>
          <select
            value={selectedTermId}
            onChange={(e) => handleTermChange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:max-w-xs"
          >
            {data.terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.academicYearName} - {term.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : data?.result ? (
        <>
          {/* Summary */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gradient-to-r from-teal-50 to-cyan-50 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">Results Summary</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-xs text-gray-500">Average Score</p>
                <p className="mt-1 text-2xl font-bold text-teal-600">
                  {data.result.averageScore?.toFixed(1) ?? "N/A"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Overall Grade</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {data.result.overallGrade ?? "N/A"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Class Position</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {data.result.classPosition
                    ? `${data.result.classPosition}${getOrdinalSuffix(data.result.classPosition)}`
                    : "N/A"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Total Score</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {data.result.totalScore?.toFixed(1) ?? "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Subject Results */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">Subject Results</h3>
            </div>

            {/* Mobile view: Cards */}
            <div className="divide-y divide-gray-100 sm:hidden">
              {data.result.subjectResults.map((sr) => (
                <div key={sr.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{sr.subjectName}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${gradeColorClass(sr.grade)}`}
                    >
                      {sr.grade ?? "-"}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-gray-500">
                    <span>CA: {sr.classScore?.toFixed(1) ?? "-"}</span>
                    <span>Exam: {sr.examScore?.toFixed(1) ?? "-"}</span>
                    <span className="font-medium text-gray-700">
                      Total: {sr.totalScore?.toFixed(1) ?? "-"}
                    </span>
                    {sr.position && <span>Pos: {sr.position}{getOrdinalSuffix(sr.position)}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop view: Table */}
            <div className="hidden overflow-x-auto sm:block">
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
                  {data.result.subjectResults.map((sr) => (
                    <tr key={sr.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {sr.subjectName}
                        {sr.subjectCode && (
                          <span className="ml-1 text-xs text-gray-400">({sr.subjectCode})</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {sr.classScore?.toFixed(1) ?? "-"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {sr.examScore?.toFixed(1) ?? "-"}
                      </td>
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
                        {sr.position
                          ? `${sr.position}${getOrdinalSuffix(sr.position)}`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks */}
          {(data.result.teacherRemarks || data.result.headmasterRemarks) && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="mb-3 text-base font-semibold text-gray-900">Remarks</h3>
              <div className="space-y-3">
                {data.result.teacherRemarks && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">Class Teacher</p>
                    <p className="mt-0.5 text-sm text-gray-700 italic">
                      &ldquo;{data.result.teacherRemarks}&rdquo;
                    </p>
                  </div>
                )}
                {data.result.headmasterRemarks && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">Headmaster</p>
                    <p className="mt-0.5 text-sm text-gray-700 italic">
                      &ldquo;{data.result.headmasterRemarks}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Promotion Status */}
          {data.result.promotionStatus && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="mb-2 text-base font-semibold text-gray-900">Promotion Status</h3>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                  data.result.promotionStatus === "PROMOTED"
                    ? "bg-green-100 text-green-700"
                    : data.result.promotionStatus === "RETAINED"
                      ? "bg-red-100 text-red-700"
                      : data.result.promotionStatus === "GRADUATED"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {data.result.promotionStatus}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">No Results Available</h3>
          <p className="mt-1 text-sm text-gray-500">
            No results have been published for the selected term yet.
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
