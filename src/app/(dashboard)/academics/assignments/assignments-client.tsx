"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getTeacherAssignmentsAction,
  createTeacherAssignmentAction,
  deleteTeacherAssignmentAction,
} from "@/modules/academics/actions/assignment.action";

// ─── Types ──────────────────────────────────────────────────────────

interface AssignmentItem {
  id: string;
  staffId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  classArmId: string;
  classArmName: string;
  academicYearId: string;
  termId: string | null;
  createdAt: Date;
}

interface Teacher {
  id: string;
  name: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

interface ClassArmOption {
  id: string;
  name: string;
  className: string;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface TermOption {
  id: string;
  name: string;
  academicYearId: string;
}

interface AssignmentFormData {
  staffId: string;
  subjectId: string;
  classArmId: string;
  academicYearId: string;
  termId: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function AssignmentsClient({
  initialAssignments,
  teachers,
  subjects,
  classArms,
  academicYears,
  terms,
}: {
  initialAssignments: AssignmentItem[];
  teachers: Teacher[];
  subjects: SubjectOption[];
  classArms: ClassArmOption[];
  academicYears: AcademicYear[];
  terms: TermOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const currentYear = academicYears.find((ay) => ay.isCurrent);
  const [filterYearId, setFilterYearId] = useState<string>(currentYear?.id ?? "");
  const [filterTermId, setFilterTermId] = useState<string>("");
  const [assignments, setAssignments] = useState<AssignmentItem[]>(initialAssignments);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<AssignmentFormData>({
    staffId: "",
    subjectId: "",
    classArmId: "",
    academicYearId: currentYear?.id ?? "",
    termId: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Filter terms by selected academic year
  const filteredTerms = terms.filter(
    (t) => !filterYearId || t.academicYearId === filterYearId,
  );
  const modalTerms = terms.filter(
    (t) => !formData.academicYearId || t.academicYearId === formData.academicYearId,
  );

  // Reload assignments when filter changes
  useEffect(() => {
    startTransition(async () => {
      const result = await getTeacherAssignmentsAction(
        filterYearId || undefined,
        filterTermId || undefined,
      );
      if (result.data) {
        setAssignments(result.data);
      }
    });
  }, [filterYearId, filterTermId]);

  // Group assignments by teacher for workload summary
  const teacherWorkload = new Map<string, { name: string; count: number }>();
  for (const a of assignments) {
    const existing = teacherWorkload.get(a.staffId);
    if (existing) {
      existing.count++;
    } else {
      teacherWorkload.set(a.staffId, { name: a.teacherName, count: 1 });
    }
  }

  function handleCreate() {
    setFormData({
      staffId: "",
      subjectId: "",
      classArmId: "",
      academicYearId: currentYear?.id ?? "",
      termId: "",
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleDelete(assignment: AssignmentItem) {
    if (
      !confirm(
        `Remove assignment: ${assignment.teacherName} - ${assignment.subjectName} - ${assignment.classArmName}?`,
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteTeacherAssignmentAction(assignment.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Assignment removed successfully.");
        router.refresh();
        const refreshed = await getTeacherAssignmentsAction(
          filterYearId || undefined,
          filterTermId || undefined,
        );
        if (refreshed.data) setAssignments(refreshed.data);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.staffId) {
      setFormError("Please select a teacher.");
      return;
    }
    if (!formData.subjectId) {
      setFormError("Please select a subject.");
      return;
    }
    if (!formData.classArmId) {
      setFormError("Please select a class arm.");
      return;
    }
    if (!formData.academicYearId) {
      setFormError("Please select an academic year.");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      const result = await createTeacherAssignmentAction({
        staffId: formData.staffId,
        subjectId: formData.subjectId,
        classArmId: formData.classArmId,
        academicYearId: formData.academicYearId,
        termId: formData.termId || undefined,
      });
      if (result.error) {
        setFormError(result.error);
      } else {
        toast.success("Teacher assignment created successfully.");
        setShowModal(false);
        router.refresh();
        const refreshed = await getTeacherAssignmentsAction(
          filterYearId || undefined,
          filterTermId || undefined,
        );
        if (refreshed.data) setAssignments(refreshed.data);
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium">Academic Year:</label>
          <select
            value={filterYearId}
            onChange={(e) => {
              setFilterYearId(e.target.value);
              setFilterTermId("");
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Years</option>
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>

          <label className="text-sm font-medium">Term:</label>
          <select
            value={filterTermId}
            onChange={(e) => setFilterTermId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Terms</option>
            {filteredTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Assignment
        </button>
      </div>

      {/* Workload Summary */}
      {teacherWorkload.size > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Teacher Workload Summary</h3>
          <div className="flex flex-wrap gap-3">
            {Array.from(teacherWorkload.entries()).map(([staffId, info]) => (
              <div
                key={staffId}
                className="rounded-md border border-border px-3 py-2 text-sm bg-muted/30"
              >
                <span className="font-medium">{info.name}</span>
                <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {info.count} {info.count === 1 ? "class" : "classes"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assignments Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Teacher</th>
                <th className="px-4 py-3 text-left font-medium">Subject</th>
                <th className="px-4 py-3 text-left font-medium">Class / Arm</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No assignments found. Click &quot;Add Assignment&quot; to create one.
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => (
                  <tr
                    key={assignment.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{assignment.teacherName}</td>
                    <td className="px-4 py-3">
                      {assignment.subjectName}
                      {assignment.subjectCode && (
                        <span className="ml-1 text-xs text-muted-foreground font-mono">
                          ({assignment.subjectCode})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {assignment.classArmName}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                        onClick={() => handleDelete(assignment)}
                        disabled={isPending}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Add Teacher Assignment</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Teacher <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select a teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select a subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Class / Arm <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.classArmId}
                  onChange={(e) => setFormData({ ...formData, classArmId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select a class arm</option>
                  {classArms.map((ca) => (
                    <option key={ca.id} value={ca.id}>
                      {ca.className} {ca.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Academic Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.academicYearId}
                    onChange={(e) =>
                      setFormData({ ...formData, academicYearId: e.target.value, termId: "" })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select year</option>
                    {academicYears.map((ay) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name} {ay.isCurrent ? "(Current)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Term</label>
                  <select
                    value={formData.termId}
                    onChange={(e) => setFormData({ ...formData, termId: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">All terms</option>
                    {modalTerms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Create Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
