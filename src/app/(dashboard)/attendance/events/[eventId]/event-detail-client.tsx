"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordEventAttendanceAction } from "@/modules/attendance/actions/event-attendance.action";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "SICK";

interface StudentInfo {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  className: string;
}

interface ExistingRecord {
  id: string;
  studentId: string;
  status: string;
  remarks: string | null;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "PRESENT", label: "Present", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "ABSENT", label: "Absent", color: "bg-red-100 text-red-700 border-red-300" },
  { value: "LATE", label: "Late", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "EXCUSED", label: "Excused", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "SICK", label: "Sick", color: "bg-orange-100 text-orange-700 border-orange-300" },
];

export function EventDetailClient({
  eventId,
  students,
  existingRecords,
}: {
  eventId: string;
  students: StudentInfo[];
  existingRecords: ExistingRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  // Build records map from existing data
  const [records, setRecords] = useState<Map<string, { status: AttendanceStatus; remarks: string }>>(() => {
    const map = new Map<string, { status: AttendanceStatus; remarks: string }>();
    for (const r of existingRecords) {
      map.set(r.studentId, { status: r.status as AttendanceStatus, remarks: r.remarks ?? "" });
    }
    return map;
  });

  const filteredStudents = search
    ? students.filter(
        (s) =>
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
          s.studentId.toLowerCase().includes(search.toLowerCase()) ||
          s.className.toLowerCase().includes(search.toLowerCase()),
      )
    : students;

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords((prev) => {
      const next = new Map(prev);
      const existing = next.get(studentId);
      next.set(studentId, { status, remarks: existing?.remarks ?? "" });
      return next;
    });
  }

  function markAllPresent() {
    setRecords((prev) => {
      const next = new Map(prev);
      for (const s of filteredStudents) {
        const existing = next.get(s.id);
        next.set(s.id, { status: "PRESENT", remarks: existing?.remarks ?? "" });
      }
      return next;
    });
  }

  function handleSave() {
    const entries = Array.from(records.entries()).map(([studentId, data]) => ({
      studentId,
      status: data.status,
      remarks: data.remarks || undefined,
    }));

    if (entries.length === 0) {
      toast.error("No attendance records to save.");
      return;
    }

    startTransition(async () => {
      const result = await recordEventAttendanceAction({ eventId, records: entries });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Saved attendance for ${result.data?.saved} students.`);
        router.refresh();
      }
    });
  }

  const presentCount = Array.from(records.values()).filter((r) => r.status === "PRESENT").length;
  const absentCount = Array.from(records.values()).filter((r) => r.status === "ABSENT").length;
  const totalMarked = records.size;

  return (
    <>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students..."
          className="rounded-md border px-3 py-2 text-sm min-w-[200px]"
        />
        <button
          onClick={markAllPresent}
          className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
        >
          Mark All Present
        </button>
        <div className="ml-auto flex gap-3 text-sm text-muted-foreground">
          <span>Marked: {totalMarked}/{students.length}</span>
          <span className="text-green-600">P: {presentCount}</span>
          <span className="text-red-600">A: {absentCount}</span>
        </div>
      </div>

      {/* Student Grid */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium w-10">#</th>
              <th className="px-4 py-3 text-left font-medium">Student</th>
              <th className="px-4 py-3 text-left font-medium">Class</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No students found.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, i) => {
                const record = records.get(student.id);
                return (
                  <tr key={student.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{student.firstName} {student.lastName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{student.studentId}</div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{student.className}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setStatus(student.id, opt.value)}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium border transition-all ${
                              record?.status === opt.value
                                ? opt.color + " ring-2 ring-offset-1 ring-current"
                                : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isPending || records.size === 0}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : `Save Attendance (${records.size} students)`}
        </button>
      </div>
    </>
  );
}
