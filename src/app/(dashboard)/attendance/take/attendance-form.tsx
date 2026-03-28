"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  openAttendanceRegisterAction,
  recordAttendanceAction,
  closeAttendanceRegisterAction,
} from "@/modules/attendance/actions/attendance.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ClassArmOption {
  id: string;
  name: string;
  className: string;
}

interface StudentInfo {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
}

interface AttendanceRecordEntry {
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "SICK";
  remarks: string;
}

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "SICK";

// ─── Component ──────────────────────────────────────────────────────

export function AttendanceForm({
  classArms,
}: {
  classArms: ClassArmOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Step 1: Selection
  const [selectedClassArmId, setSelectedClassArmId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  // Step 2: Attendance
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [registerStatus, setRegisterStatus] = useState<string>("OPEN");
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [records, setRecords] = useState<Map<string, AttendanceRecordEntry>>(new Map());
  const [isExisting, setIsExisting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  function handleOpenRegister() {
    if (!selectedClassArmId) {
      toast.error("Please select a class arm.");
      return;
    }
    if (!selectedDate) {
      toast.error("Please select a date.");
      return;
    }

    startTransition(async () => {
      const result = await openAttendanceRegisterAction({
        classArmId: selectedClassArmId,
        date: selectedDate,
        type: "DAILY",
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setRegisterId(result.data.register.id);
        setRegisterStatus(result.data.register.status);
        setStudents(result.data.students);
        setIsExisting(result.data.isExisting ?? false);

        // Initialize records
        const newRecords = new Map<string, AttendanceRecordEntry>();
        for (const student of result.data.students) {
          const existingRecord = result.data.records.find(
            (r) => r.studentId === student.id,
          );
          newRecords.set(student.id, {
            studentId: student.id,
            status: (existingRecord?.status as AttendanceStatus) ?? "PRESENT",
            remarks: existingRecord?.remarks ?? "",
          });
        }
        setRecords(newRecords);
        setStep(2);

        if (result.data.isExisting) {
          toast.info("Existing register found. You can update the attendance.");
        }
      }
    });
  }

  function updateStudentStatus(studentId: string, status: AttendanceStatus) {
    setRecords((prev) => {
      const next = new Map(prev);
      const existing = next.get(studentId);
      if (existing) {
        next.set(studentId, { ...existing, status });
      }
      return next;
    });
  }

  function updateStudentRemarks(studentId: string, remarks: string) {
    setRecords((prev) => {
      const next = new Map(prev);
      const existing = next.get(studentId);
      if (existing) {
        next.set(studentId, { ...existing, remarks });
      }
      return next;
    });
  }

  function handleMarkAllPresent() {
    setRecords((prev) => {
      const next = new Map(prev);
      for (const [key, entry] of next) {
        next.set(key, { ...entry, status: "PRESENT" });
      }
      return next;
    });
  }

  function handleSaveAttendance() {
    if (!registerId) return;

    const attendanceRecords = Array.from(records.values()).map((r) => ({
      studentId: r.studentId,
      status: r.status,
      remarks: r.remarks || undefined,
    }));

    startTransition(async () => {
      const result = await recordAttendanceAction(registerId, attendanceRecords);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Attendance saved successfully.");
        router.refresh();
      }
    });
  }

  function handleCloseRegister() {
    if (!registerId) return;
    if (!confirm("Close this register? No further edits will be allowed.")) return;

    startTransition(async () => {
      const result = await closeAttendanceRegisterAction(registerId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Register closed successfully.");
        setRegisterStatus("CLOSED");
        router.refresh();
      }
    });
  }

  // Count statuses
  const presentCount = Array.from(records.values()).filter((r) => r.status === "PRESENT").length;
  const absentCount = Array.from(records.values()).filter((r) => r.status === "ABSENT").length;
  const lateCount = Array.from(records.values()).filter((r) => r.status === "LATE").length;
  const excusedCount = Array.from(records.values()).filter(
    (r) => r.status === "EXCUSED" || r.status === "SICK",
  ).length;

  const statusOptions: { value: AttendanceStatus; label: string; color: string }[] = [
    { value: "PRESENT", label: "Present", color: "bg-green-100 text-green-700 border-green-300" },
    { value: "ABSENT", label: "Absent", color: "bg-red-100 text-red-700 border-red-300" },
    { value: "LATE", label: "Late", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
    { value: "EXCUSED", label: "Excused", color: "bg-blue-100 text-blue-700 border-blue-300" },
    { value: "SICK", label: "Sick", color: "bg-orange-100 text-orange-700 border-orange-300" },
  ];

  // ─── Render ───────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 max-w-lg">
        <h3 className="text-lg font-semibold mb-4">Step 1: Select Class and Date</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Class / Arm <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClassArmId}
              onChange={(e) => setSelectedClassArmId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a class arm</option>
              {classArms.map((ca) => (
                <option key={ca.id} value={ca.id}>
                  {ca.className} {ca.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={handleOpenRegister}
            disabled={isPending || !selectedClassArmId || !selectedDate}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Open Register"}
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Record attendance
  const selectedArm = classArms.find((ca) => ca.id === selectedClassArmId);
  const isClosed = registerStatus === "CLOSED";

  return (
    <>
      {/* Header info */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {selectedArm ? `${selectedArm.className} ${selectedArm.name}` : "Attendance"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {format(new Date(selectedDate), "EEEE, d MMMM yyyy")}
            {isExisting && " (Editing existing register)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep(1)}
            className="rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Change Class
          </button>
          {!isClosed && (
            <button
              onClick={handleMarkAllPresent}
              className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
            >
              Mark All Present
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-center">
          <p className="text-xs text-green-600">Present</p>
          <p className="text-xl font-bold text-green-700">{presentCount}</p>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center">
          <p className="text-xs text-red-600">Absent</p>
          <p className="text-xl font-bold text-red-700">{absentCount}</p>
        </div>
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-center">
          <p className="text-xs text-yellow-600">Late</p>
          <p className="text-xl font-bold text-yellow-700">{lateCount}</p>
        </div>
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-center">
          <p className="text-xs text-blue-600">Excused/Sick</p>
          <p className="text-xl font-bold text-blue-700">{excusedCount}</p>
        </div>
      </div>

      {/* Student List */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium w-10">#</th>
                <th className="px-4 py-3 text-left font-medium">Student</th>
                <th className="px-4 py-3 text-left font-medium">ID</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No enrolled students found for this class.
                  </td>
                </tr>
              ) : (
                students.map((student, index) => {
                  const record = records.get(student.id);
                  return (
                    <tr
                      key={student.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                            {student.firstName[0]}
                            {student.lastName[0]}
                          </div>
                          <span className="font-medium">
                            {student.firstName} {student.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {student.studentId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {statusOptions.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => updateStudentStatus(student.id, opt.value)}
                              disabled={isClosed}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium border transition-all disabled:opacity-50 ${
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
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={record?.remarks ?? ""}
                          onChange={(e) => updateStudentRemarks(student.id, e.target.value)}
                          disabled={isClosed}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
                          placeholder="Optional remarks"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      {students.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {students.length} student{students.length !== 1 ? "s" : ""} in register
          </p>
          <div className="flex items-center gap-2">
            {!isClosed && (
              <>
                <button
                  onClick={handleCloseRegister}
                  disabled={isPending}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Close Register
                </button>
                <button
                  onClick={handleSaveAttendance}
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Attendance"}
                </button>
              </>
            )}
            {isClosed && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                Register Closed
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
