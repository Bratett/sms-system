"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createExamScheduleAction,
  updateExamScheduleAction,
  deleteExamScheduleAction,
} from "@/modules/timetable/actions/exam-schedule.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ExamRow {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  notes: string | null;
  subject: { id: string; name: string; code: string | null };
  class: { id: string; name: string };
  room: { id: string; name: string; building: string | null } | null;
  invigilator: { id: string; name: string } | null;
  term: { id: string; name: string };
  academicYear: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

// ─── Component ──────────────────────────────────────────────────────

export function ExamScheduleClient({
  exams,
  filters: _filters,
}: {
  exams: ExamRow[];
  filters: { termId?: string; classId?: string; subjectId?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamRow | null>(null);
  const [examForm, setExamForm] = useState({
    academicYearId: "",
    termId: "",
    subjectId: "",
    classId: "",
    date: "",
    startTime: "",
    endTime: "",
    roomId: "",
    invigilatorId: "",
    notes: "",
  });

  // ─── CRUD ───────────────────────────────────────────────────────

  function openForm(exam?: ExamRow) {
    if (exam) {
      setEditingExam(exam);
      const dateStr = new Date(exam.date).toISOString().split("T")[0];
      setExamForm({
        academicYearId: exam.academicYear.id,
        termId: exam.term.id,
        subjectId: exam.subject.id,
        classId: exam.class.id,
        date: dateStr,
        startTime: exam.startTime,
        endTime: exam.endTime,
        roomId: exam.room?.id ?? "",
        invigilatorId: exam.invigilator?.id ?? "",
        notes: exam.notes ?? "",
      });
    } else {
      setEditingExam(null);
      setExamForm({
        academicYearId: "",
        termId: "",
        subjectId: "",
        classId: "",
        date: "",
        startTime: "",
        endTime: "",
        roomId: "",
        invigilatorId: "",
        notes: "",
      });
    }
    setShowForm(true);
  }

  function handleSave() {
    if (!examForm.subjectId || !examForm.classId || !examForm.date || !examForm.startTime || !examForm.endTime) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!examForm.academicYearId || !examForm.termId) {
      toast.error("Academic year and term are required.");
      return;
    }

    startTransition(async () => {
      if (editingExam) {
        const result = await updateExamScheduleAction(editingExam.id, {
          subjectId: examForm.subjectId,
          classId: examForm.classId,
          date: new Date(examForm.date),
          startTime: examForm.startTime,
          endTime: examForm.endTime,
          roomId: examForm.roomId || null,
          invigilatorId: examForm.invigilatorId || null,
          notes: examForm.notes || null,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Exam schedule updated successfully.");
      } else {
        const result = await createExamScheduleAction({
          academicYearId: examForm.academicYearId,
          termId: examForm.termId,
          subjectId: examForm.subjectId,
          classId: examForm.classId,
          date: new Date(examForm.date),
          startTime: examForm.startTime,
          endTime: examForm.endTime,
          roomId: examForm.roomId || undefined,
          invigilatorId: examForm.invigilatorId || undefined,
          notes: examForm.notes || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Exam schedule created successfully.");
      }
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(exam: ExamRow) {
    if (!confirm(`Delete exam schedule for "${exam.subject.name}"? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deleteExamScheduleAction(exam.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Exam schedule deleted successfully.");
      router.refresh();
    });
  }

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-end rounded-lg border bg-card p-4">
        <button
          onClick={() => openForm()}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Exam
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Class</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Start</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">End</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Room</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Invigilator</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Notes</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {exams.map((exam) => (
              <tr key={exam.id}>
                <td className="px-4 py-3 text-sm font-medium">{exam.subject.name}</td>
                <td className="px-4 py-3 text-sm">{exam.class.name}</td>
                <td className="px-4 py-3 text-sm">{formatDate(exam.date)}</td>
                <td className="px-4 py-3 text-sm">{exam.startTime}</td>
                <td className="px-4 py-3 text-sm">{exam.endTime}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{exam.room?.name ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{exam.invigilator?.name ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                  {exam.notes ?? "-"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openForm(exam)}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(exam)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {exams.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No exam schedules found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Exam Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editingExam ? "Edit Exam Schedule" : "New Exam Schedule"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Academic Year ID *</label>
                <input
                  type="text"
                  value={examForm.academicYearId}
                  onChange={(e) => setExamForm({ ...examForm, academicYearId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Academic year ID"
                  disabled={!!editingExam}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Term ID *</label>
                <input
                  type="text"
                  value={examForm.termId}
                  onChange={(e) => setExamForm({ ...examForm, termId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Term ID"
                  disabled={!!editingExam}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Subject ID *</label>
                <input
                  type="text"
                  value={examForm.subjectId}
                  onChange={(e) => setExamForm({ ...examForm, subjectId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Subject ID"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Class ID *</label>
                <input
                  type="text"
                  value={examForm.classId}
                  onChange={(e) => setExamForm({ ...examForm, classId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Class ID"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Date *</label>
                <input
                  type="date"
                  value={examForm.date}
                  onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Start Time *</label>
                <input
                  type="text"
                  value={examForm.startTime}
                  onChange={(e) => setExamForm({ ...examForm, startTime: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="09:00"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">End Time *</label>
                <input
                  type="text"
                  value={examForm.endTime}
                  onChange={(e) => setExamForm({ ...examForm, endTime: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="11:00"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Room ID</label>
                <input
                  type="text"
                  value={examForm.roomId}
                  onChange={(e) => setExamForm({ ...examForm, roomId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Room ID (optional)"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Invigilator ID</label>
                <input
                  type="text"
                  value={examForm.invigilatorId}
                  onChange={(e) => setExamForm({ ...examForm, invigilatorId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Invigilator ID (optional)"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea
                  value={examForm.notes}
                  onChange={(e) => setExamForm({ ...examForm, notes: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Optional notes"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : editingExam ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
