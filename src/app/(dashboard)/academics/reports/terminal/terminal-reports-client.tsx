"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import {
  generateReportCardDataAction,
  generateClassReportCardsAction,
} from "@/modules/academics/actions/report-card.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ClassArm {
  id: string;
  name: string;
  className: string;
  programmeName: string;
}

interface Term {
  id: string;
  name: string;
  termNumber: number;
  academicYearId: string;
  academicYearName: string;
  isCurrent: boolean;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface SubjectResultData {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  subjectType: string;
  classScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  grade: string | null;
  interpretation: string | null;
  position: number | null;
}

interface ReportCardData {
  school: {
    name: string;
    motto: string;
    address: string;
    logoUrl: string;
    phone: string;
    email: string;
  };
  student: {
    id: string;
    studentId: string;
    name: string;
    firstName: string;
    lastName: string;
    gender: string;
    class: string;
    programme: string;
    house: string;
  };
  term: {
    id: string;
    name: string;
    termNumber: number;
    academicYear: string;
    startDate: string | Date;
    endDate: string | Date;
  };
  subjectResults: SubjectResultData[];
  overall: {
    totalScore: number | null;
    averageScore: number | null;
    position: number | null;
    classSize: number;
    overallGrade: string | null;
  };
  remarks: {
    teacherRemarks: string;
    headmasterRemarks: string;
  };
  attendance: {
    present: number;
    absent: number;
    late: number;
  };
}

// ─── Component ──────────────────────────────────────────────────────

export function TerminalReportsClient({
  classArms,
  terms,
  academicYears,
}: {
  classArms: ClassArm[];
  terms: Term[];
  academicYears: AcademicYear[];
}) {
  const [isPending, startTransition] = useTransition();
  const printRef = useRef<HTMLDivElement>(null);

  // Filters
  const currentYear = academicYears.find((ay) => ay.isCurrent);
  const [selectedYearId, setSelectedYearId] = useState<string>(
    currentYear?.id ?? "",
  );
  const [selectedClassArmId, setSelectedClassArmId] = useState<string>("");
  const [selectedTermId, setSelectedTermId] = useState<string>("");

  // Data
  const [reportCards, setReportCards] = useState<ReportCardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter terms by academic year
  const filteredTerms = terms.filter(
    (t) => t.academicYearId === selectedYearId,
  );

  const currentCard = reportCards[currentIndex] ?? null;

  // ─── Generate Report Cards ────────────────────────────────────────

  function handleGenerateReportCards() {
    if (!selectedClassArmId || !selectedTermId) {
      toast.error("Please select a class arm and term.");
      return;
    }

    startTransition(async () => {
      const result = await generateClassReportCardsAction(
        selectedClassArmId,
        selectedTermId,
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data && result.data.length > 0) {
        setReportCards(result.data);
        setCurrentIndex(0);
        toast.success(`Generated ${result.data.length} report card(s).`);
      } else {
        toast.warning("No report cards generated.");
        setReportCards([]);
      }

      if (result.errors && result.errors.length > 0) {
        for (const err of result.errors) {
          toast.warning(err);
        }
      }
    });
  }

  // ─── Print ────────────────────────────────────────────────────────

  function handlePrintCurrent() {
    window.print();
  }

  function handlePrintAll() {
    // Set to show all cards, then print
    window.print();
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Academic Year
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => {
                setSelectedYearId(e.target.value);
                setSelectedTermId("");
                setReportCards([]);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Year</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Class Arm
            </label>
            <select
              value={selectedClassArmId}
              onChange={(e) => {
                setSelectedClassArmId(e.target.value);
                setReportCards([]);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Class Arm</option>
              {classArms.map((ca) => (
                <option key={ca.id} value={ca.id}>
                  {ca.className} {ca.name} ({ca.programmeName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Term
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => {
                setSelectedTermId(e.target.value);
                setReportCards([]);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Term</option>
              {filteredTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerateReportCards}
            disabled={
              isPending || !selectedClassArmId || !selectedTermId
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Generating..." : "Generate Report Cards"}
          </button>
        </div>

        {reportCards.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintCurrent}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Print Current
            </button>
            <button
              onClick={handlePrintAll}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Print All
            </button>
          </div>
        )}
      </div>

      {/* Student Selector */}
      {reportCards.length > 0 && (
        <div className="flex items-center gap-3 print:hidden">
          <label className="text-sm font-medium">Student:</label>
          <select
            value={currentIndex}
            onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {reportCards.map((rc, i) => (
              <option key={rc.student.id} value={i}>
                {rc.student.name} ({rc.student.studentId})
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} of {reportCards.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() =>
                setCurrentIndex(Math.max(0, currentIndex - 1))
              }
              disabled={currentIndex === 0}
              className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() =>
                setCurrentIndex(
                  Math.min(reportCards.length - 1, currentIndex + 1),
                )
              }
              disabled={currentIndex === reportCards.length - 1}
              className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Report Card Preview (screen + print) */}
      {currentCard && (
        <div ref={printRef}>
          {/* For screen: show single card. For print: show all */}
          <div className="print:hidden">
            <ReportCard data={currentCard} />
          </div>
          <div className="hidden print:block">
            {reportCards.map((rc, i) => (
              <div
                key={rc.student.id}
                className={i < reportCards.length - 1 ? "break-after-page" : ""}
              >
                <ReportCard data={rc} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block,
          .print\\:block * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            margin: 10mm;
            size: A4 portrait;
          }
        }
      `}</style>
    </>
  );
}

// ─── Report Card Component ──────────────────────────────────────────

function ReportCard({ data }: { data: ReportCardData }) {
  return (
    <div className="mx-auto max-w-[210mm] border border-border bg-white p-8 shadow-sm print:border-0 print:shadow-none">
      {/* School Header */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
        {data.school.logoUrl && (
          <div className="flex justify-center mb-2">
            <img
              src={data.school.logoUrl}
              alt="School Logo"
              className="h-16 w-16 object-contain"
            />
          </div>
        )}
        <h1 className="text-xl font-bold uppercase tracking-wide text-gray-900">
          {data.school.name}
        </h1>
        {data.school.motto && (
          <p className="text-xs italic text-gray-600 mt-0.5">
            &ldquo;{data.school.motto}&rdquo;
          </p>
        )}
        {data.school.address && (
          <p className="text-xs text-gray-600">{data.school.address}</p>
        )}
        {(data.school.phone || data.school.email) && (
          <p className="text-xs text-gray-600">
            {data.school.phone}
            {data.school.phone && data.school.email ? " | " : ""}
            {data.school.email}
          </p>
        )}
        <div className="mt-2 inline-block rounded bg-gray-800 px-4 py-1">
          <span className="text-sm font-semibold text-white uppercase tracking-wider">
            Terminal Report Card
          </span>
        </div>
      </div>

      {/* Student Info */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4 border-b border-gray-300 pb-3">
        <div className="flex">
          <span className="font-semibold w-28 shrink-0">Name:</span>
          <span className="uppercase">{data.student.name}</span>
        </div>
        <div className="flex">
          <span className="font-semibold w-28 shrink-0">Student ID:</span>
          <span className="font-mono">{data.student.studentId}</span>
        </div>
        <div className="flex">
          <span className="font-semibold w-28 shrink-0">Class:</span>
          <span>{data.student.class}</span>
        </div>
        <div className="flex">
          <span className="font-semibold w-28 shrink-0">Programme:</span>
          <span>{data.student.programme}</span>
        </div>
        <div className="flex">
          <span className="font-semibold w-28 shrink-0">Term:</span>
          <span>{data.term.name}</span>
        </div>
        <div className="flex">
          <span className="font-semibold w-28 shrink-0">Academic Year:</span>
          <span>{data.term.academicYear}</span>
        </div>
        {data.student.house && (
          <div className="flex">
            <span className="font-semibold w-28 shrink-0">House:</span>
            <span>{data.student.house}</span>
          </div>
        )}
        <div className="flex">
          <span className="font-semibold w-28 shrink-0">Gender:</span>
          <span className="capitalize">{data.student.gender.toLowerCase()}</span>
        </div>
      </div>

      {/* Results Table */}
      <table className="w-full text-sm border-collapse mb-4">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="border border-gray-600 px-3 py-2 text-left font-medium">
              Subject
            </th>
            <th className="border border-gray-600 px-2 py-2 text-center font-medium w-20">
              Class Score (50%)
            </th>
            <th className="border border-gray-600 px-2 py-2 text-center font-medium w-20">
              Exam Score (50%)
            </th>
            <th className="border border-gray-600 px-2 py-2 text-center font-medium w-20">
              Total (100%)
            </th>
            <th className="border border-gray-600 px-2 py-2 text-center font-medium w-14">
              Grade
            </th>
            <th className="border border-gray-600 px-2 py-2 text-center font-medium">
              Interpretation
            </th>
            <th className="border border-gray-600 px-2 py-2 text-center font-medium w-14">
              Pos
            </th>
          </tr>
        </thead>
        <tbody>
          {data.subjectResults.map((sr, i) => (
            <tr
              key={sr.subjectId}
              className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              <td className="border border-gray-300 px-3 py-1.5 font-medium">
                {sr.subjectName}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-center">
                {sr.classScore?.toFixed(1) ?? "-"}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-center">
                {sr.examScore?.toFixed(1) ?? "-"}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-center font-semibold">
                {sr.totalScore?.toFixed(1) ?? "-"}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-center font-bold">
                {sr.grade ?? "-"}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-center text-xs">
                {sr.interpretation ?? "-"}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-center">
                {sr.position ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Section */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded border border-gray-300 p-3">
          <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">
            Overall Summary
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Overall Average:</span>
              <span className="font-bold">
                {data.overall.averageScore?.toFixed(1) ?? "-"}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Position in Class:</span>
              <span className="font-bold">
                {data.overall.position ?? "-"} out of{" "}
                {data.overall.classSize}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Overall Grade:</span>
              <span className="font-bold">
                {data.overall.overallGrade ?? "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded border border-gray-300 p-3">
          <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">
            Attendance Summary
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Days Present:</span>
              <span className="font-bold">{data.attendance.present}</span>
            </div>
            <div className="flex justify-between">
              <span>Days Absent:</span>
              <span className="font-bold">{data.attendance.absent}</span>
            </div>
            <div className="flex justify-between">
              <span>Days Late:</span>
              <span className="font-bold">{data.attendance.late}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Remarks Section */}
      <div className="space-y-3 mb-6">
        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
            Class Teacher&apos;s Remarks
          </p>
          <p className="text-sm min-h-[24px] italic">
            {data.remarks.teacherRemarks || "---"}
          </p>
          <div className="mt-3 flex items-end justify-between border-t border-gray-200 pt-2">
            <div>
              <span className="text-xs text-gray-500">Signature:</span>
              <span className="inline-block w-40 border-b border-gray-400 ml-2">
                &nbsp;
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500">Date:</span>
              <span className="inline-block w-28 border-b border-gray-400 ml-2">
                &nbsp;
              </span>
            </div>
          </div>
        </div>

        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
            Headmaster&apos;s Remarks
          </p>
          <p className="text-sm min-h-[24px] italic">
            {data.remarks.headmasterRemarks || "---"}
          </p>
          <div className="mt-3 flex items-end justify-between border-t border-gray-200 pt-2">
            <div>
              <span className="text-xs text-gray-500">Signature:</span>
              <span className="inline-block w-40 border-b border-gray-400 ml-2">
                &nbsp;
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500">Date:</span>
              <span className="inline-block w-28 border-b border-gray-400 ml-2">
                &nbsp;
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 border-t border-gray-200 pt-2">
        This is a computer-generated report card. | {data.school.name}
      </div>
    </div>
  );
}
