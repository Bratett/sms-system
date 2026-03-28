"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  conductRollCallAction,
  getRollCallHistoryAction,
  getBoardingStudentsAction,
} from "@/modules/boarding/actions/roll-call.action";

// ─── Types ──────────────────────────────────────────────────────────

interface HostelOption {
  id: string;
  name: string;
  gender: string;
}

interface StudentRow {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  dormitory: string;
  bed: string;
}

interface RollCallHistoryRow {
  id: string;
  hostelId: string;
  date: Date;
  type: string;
  conductedBy: string;
  conductedAt: Date;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  exeatCount: number;
  sickBayCount: number;
}

type RollCallStatus = "PRESENT" | "ABSENT" | "EXEAT" | "SICK_BAY";

// ─── Component ──────────────────────────────────────────────────────

export function RollCallClient({ hostels }: { hostels: HostelOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedHostel, setSelectedHostel] = useState("");
  const [rollCallType, setRollCallType] = useState<"MORNING" | "EVENING">("EVENING");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, RollCallStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [studentsLoaded, setStudentsLoaded] = useState(false);

  // History
  const [history, setHistory] = useState<RollCallHistoryRow[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // ─── Load Students ──────────────────────────────────────────────

  function handleLoadStudents() {
    if (!selectedHostel) {
      toast.error("Please select a hostel.");
      return;
    }

    startTransition(async () => {
      const result = await getBoardingStudentsAction(selectedHostel);
      if (result.data) {
        setStudents(result.data);
        // Default all to PRESENT
        const defaultStatuses: Record<string, RollCallStatus> = {};
        result.data.forEach((s) => {
          defaultStatuses[s.id] = "PRESENT";
        });
        setStatuses(defaultStatuses);
        setNotes({});
        setStudentsLoaded(true);
      } else {
        toast.error("Failed to load students.");
      }

      // Also load history
      const historyResult = await getRollCallHistoryAction(selectedHostel, {
        page: 1,
        pageSize: 10,
      });
      if (historyResult.data) {
        setHistory(historyResult.data);
        setHistoryLoaded(true);
      }
    });
  }

  function handleMarkAllPresent() {
    const allPresent: Record<string, RollCallStatus> = {};
    students.forEach((s) => {
      allPresent[s.id] = "PRESENT";
    });
    setStatuses(allPresent);
  }

  function handleStatusChange(studentId: string, status: RollCallStatus) {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  function handleNotesChange(studentId: string, value: string) {
    setNotes((prev) => ({ ...prev, [studentId]: value }));
  }

  function handleSubmit() {
    if (students.length === 0) {
      toast.error("No students to record.");
      return;
    }

    const records = students.map((s) => ({
      studentId: s.id,
      status: statuses[s.id] || "PRESENT",
      notes: notes[s.id] || undefined,
    }));

    startTransition(async () => {
      const result = await conductRollCallAction({
        hostelId: selectedHostel,
        type: rollCallType,
        records,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        const msg = result.data?.isUpdate
          ? "Roll call updated successfully."
          : "Roll call recorded successfully.";
        toast.success(msg);
        router.refresh();

        // Reload history
        const historyResult = await getRollCallHistoryAction(selectedHostel, {
          page: 1,
          pageSize: 10,
        });
        if (historyResult.data) {
          setHistory(historyResult.data);
        }
      }
    });
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Counts
  const presentCount = Object.values(statuses).filter((s) => s === "PRESENT").length;
  const absentCount = Object.values(statuses).filter((s) => s === "ABSENT").length;
  const exeatCount = Object.values(statuses).filter((s) => s === "EXEAT").length;
  const sickBayCount = Object.values(statuses).filter((s) => s === "SICK_BAY").length;

  return (
    <div className="space-y-6">
      {/* Hostel & Type Selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Hostel</label>
          <select
            value={selectedHostel}
            onChange={(e) => {
              setSelectedHostel(e.target.value);
              setStudentsLoaded(false);
              setStudents([]);
              setHistoryLoaded(false);
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
          >
            <option value="">Select hostel</option>
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.gender})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={rollCallType}
            onChange={(e) => setRollCallType(e.target.value as "MORNING" | "EVENING")}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="MORNING">Morning</option>
            <option value="EVENING">Evening</option>
          </select>
        </div>
        <button
          onClick={handleLoadStudents}
          disabled={isPending || !selectedHostel}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Loading..." : "Load Students"}
        </button>
      </div>

      {/* Roll Call Form */}
      {studentsLoaded && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 bg-muted/30">
            <div className="flex items-center gap-4 text-sm">
              <span>
                Total: <strong>{students.length}</strong>
              </span>
              <span className="text-green-600">
                Present: <strong>{presentCount}</strong>
              </span>
              <span className="text-red-600">
                Absent: <strong>{absentCount}</strong>
              </span>
              <span className="text-blue-600">
                Exeat: <strong>{exeatCount}</strong>
              </span>
              <span className="text-yellow-600">
                Sick Bay: <strong>{sickBayCount}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAllPresent}
                className="rounded-md bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200"
              >
                Mark All Present
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Submitting..." : "Submit Roll Call"}
              </button>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No boarding students found in this hostel. Allocate students to beds first.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">#</th>
                    <th className="px-4 py-3 text-left font-medium">Student</th>
                    <th className="px-4 py-3 text-left font-medium">Dormitory / Bed</th>
                    <th className="px-4 py-3 text-center font-medium">Present</th>
                    <th className="px-4 py-3 text-center font-medium">Absent</th>
                    <th className="px-4 py-3 text-center font-medium">Exeat</th>
                    <th className="px-4 py-3 text-center font-medium">Sick Bay</th>
                    <th className="px-4 py-3 text-left font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => {
                    const currentStatus = statuses[student.id] || "PRESENT";
                    return (
                      <tr
                        key={student.id}
                        className={`border-b border-border last:border-0 ${
                          currentStatus === "ABSENT"
                            ? "bg-red-50"
                            : currentStatus === "EXEAT"
                            ? "bg-blue-50"
                            : currentStatus === "SICK_BAY"
                            ? "bg-yellow-50"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-2">
                          <p className="font-medium">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{student.studentId}</p>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {student.dormitory} / {student.bed}
                        </td>
                        {(["PRESENT", "ABSENT", "EXEAT", "SICK_BAY"] as const).map((status) => (
                          <td key={status} className="px-4 py-2 text-center">
                            <input
                              type="radio"
                              name={`status-${student.id}`}
                              checked={currentStatus === status}
                              onChange={() => handleStatusChange(student.id, status)}
                              className="h-4 w-4 accent-primary"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={notes[student.id] || ""}
                            onChange={(e) => handleNotesChange(student.id, e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                            placeholder="Optional"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recent Roll Calls */}
      {historyLoaded && history.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Recent Roll Calls</h3>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-center font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Conducted By</th>
                    <th className="px-4 py-3 text-center font-medium">Present</th>
                    <th className="px-4 py-3 text-center font-medium">Absent</th>
                    <th className="px-4 py-3 text-center font-medium">Exeat</th>
                    <th className="px-4 py-3 text-center font-medium">Sick Bay</th>
                    <th className="px-4 py-3 text-center font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((rc) => (
                    <tr key={rc.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(rc.date)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            rc.type === "MORNING"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-indigo-100 text-indigo-700"
                          }`}
                        >
                          {rc.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{rc.conductedBy}</td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">
                        {rc.presentCount}
                      </td>
                      <td className="px-4 py-3 text-center text-red-600 font-medium">
                        {rc.absentCount}
                      </td>
                      <td className="px-4 py-3 text-center text-blue-600 font-medium">
                        {rc.exeatCount}
                      </td>
                      <td className="px-4 py-3 text-center text-yellow-600 font-medium">
                        {rc.sickBayCount}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {rc.totalRecords}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
