"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  createHomeworkAction,
  deleteHomeworkAction,
  getHomeworkListAction,
  getHomeworkSubmissionsAction,
} from "@/modules/academics/actions/homework.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ClassArm {
  id: string;
  name: string;
  className: string;
}

interface Term {
  id: string;
  name: string;
  termNumber: number;
  academicYearId: string;
  academicYearName: string;
  isCurrent: boolean;
}

interface Subject {
  id: string;
  name: string;
  code: string | null;
  type: string;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface HomeworkItem {
  id: string;
  title: string;
  description: string | null;
  subjectName: string;
  subjectCode: string | null;
  dueDate: Date | string;
  maxScore: number | null;
  status: string;
  submissionCount: number;
  gradedCount: number;
  createdAt: Date | string;
}

interface Submission {
  id: string;
  studentId: string;
  content: string | null;
  fileUrl: string | null;
  score: number | null;
  feedback: string | null;
  status: string;
  submittedAt: Date | string;
  gradedAt: Date | string | null;
}

interface CreateFormData {
  title: string;
  description: string;
  subjectId: string;
  classArmId: string;
  termId: string;
  dueDate: string;
  maxScore: string;
}

const EMPTY_FORM: CreateFormData = {
  title: "",
  description: "",
  subjectId: "",
  classArmId: "",
  termId: "",
  dueDate: "",
  maxScore: "100",
};

// ─── Component ──────────────────────────────────────────────────────

export function HomeworkClient({
  classArms,
  terms,
  subjects,
  academicYears,
}: {
  classArms: ClassArm[];
  terms: Term[];
  subjects: Subject[];
  academicYears: AcademicYear[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const currentYear = academicYears.find((ay) => ay.isCurrent);
  const [selectedYearId, setSelectedYearId] = useState<string>(
    currentYear?.id ?? "",
  );
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [selectedClassArmId, setSelectedClassArmId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  // Data
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<CreateFormData>(EMPTY_FORM);

  // Submissions modal
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [viewingHomeworkTitle, setViewingHomeworkTitle] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter terms by academic year
  const filteredTerms = terms.filter(
    (t) => t.academicYearId === selectedYearId,
  );

  // ─── Load Homework ────────────────────────────────────────────────

  function handleLoadHomework() {
    if (!selectedClassArmId || !selectedTermId) {
      toast.error("Please select a class arm and term.");
      return;
    }

    startTransition(async () => {
      const result = await getHomeworkListAction(
        selectedClassArmId,
        selectedTermId,
        selectedSubjectId || undefined,
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if ("data" in result) {
        setHomeworkList(result.data);
        setIsLoaded(true);
        toast.success(`Loaded ${result.data.length} homework item(s).`);
      }
    });
  }

  // ─── Create Homework ──────────────────────────────────────────────

  function handleCreate() {
    if (!formData.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!formData.subjectId) {
      toast.error("Please select a subject.");
      return;
    }
    if (!formData.classArmId) {
      toast.error("Please select a class arm.");
      return;
    }
    if (!formData.termId) {
      toast.error("Please select a term.");
      return;
    }
    if (!formData.dueDate) {
      toast.error("Due date is required.");
      return;
    }

    const selectedTerm = terms.find((t) => t.id === formData.termId);
    const academicYearId = selectedTerm?.academicYearId ?? selectedYearId;

    startTransition(async () => {
      const result = await createHomeworkAction({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        subjectId: formData.subjectId,
        classArmId: formData.classArmId,
        termId: formData.termId,
        academicYearId,
        dueDate: new Date(formData.dueDate),
        maxScore: formData.maxScore ? parseInt(formData.maxScore) : undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Homework created successfully.");
      setShowCreateModal(false);
      setFormData(EMPTY_FORM);
      router.refresh();

      // Reload list if filters match
      if (
        selectedClassArmId === formData.classArmId &&
        selectedTermId === formData.termId
      ) {
        handleLoadHomework();
      }
    });
  }

  // ─── Delete Homework ──────────────────────────────────────────────

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteHomeworkAction(id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Homework deleted.");
      setDeletingId(null);
      setHomeworkList((prev) => prev.filter((h) => h.id !== id));
      router.refresh();
    });
  }

  // ─── View Submissions ─────────────────────────────────────────────

  function handleViewSubmissions(homeworkId: string, title: string) {
    startTransition(async () => {
      const result = await getHomeworkSubmissionsAction(homeworkId);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if ("data" in result) {
        setSubmissions(result.data);
        setViewingHomeworkTitle(title);
        setShowSubmissionsModal(true);
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
                setHomeworkList([]);
                setIsLoaded(false);
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
              Term
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => {
                setSelectedTermId(e.target.value);
                setHomeworkList([]);
                setIsLoaded(false);
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

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Class Arm
            </label>
            <select
              value={selectedClassArmId}
              onChange={(e) => {
                setSelectedClassArmId(e.target.value);
                setHomeworkList([]);
                setIsLoaded(false);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Class Arm</option>
              {classArms.map((ca) => (
                <option key={ca.id} value={ca.id}>
                  {ca.className} {ca.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Subject (Optional)
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleLoadHomework}
            disabled={isPending || !selectedClassArmId || !selectedTermId}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load Homework"}
          </button>
        </div>

        <button
          onClick={() => {
            setFormData({
              ...EMPTY_FORM,
              classArmId: selectedClassArmId,
              termId: selectedTermId,
            });
            setShowCreateModal(true);
          }}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          + Create Homework
        </button>
      </div>

      {/* Homework Table */}
      {isLoaded && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Subject</th>
                  <th className="px-4 py-3 text-center font-medium">Due Date</th>
                  <th className="px-4 py-3 text-center font-medium">Max Score</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Submissions</th>
                  <th className="px-4 py-3 text-center font-medium">Graded</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {homeworkList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No homework found for this selection.
                    </td>
                  </tr>
                ) : (
                  homeworkList.map((hw) => (
                    <tr
                      key={hw.id}
                      className="border-b border-border last:border-0 hover:bg-muted/10"
                    >
                      <td className="px-4 py-3 font-medium">{hw.title}</td>
                      <td className="px-4 py-3">
                        {hw.subjectName}
                        {hw.subjectCode && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({hw.subjectCode})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {new Date(hw.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hw.maxScore ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={hw.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hw.submissionCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hw.gradedCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() =>
                              handleViewSubmissions(hw.id, hw.title)
                            }
                            disabled={isPending}
                            className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                          >
                            Submissions
                          </button>
                          {deletingId === hw.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(hw.id)}
                                disabled={isPending}
                                className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-muted"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(hw.id)}
                              disabled={isPending}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Homework Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Create Homework</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter homework title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  placeholder="Enter homework description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.subjectId}
                    onChange={(e) =>
                      setFormData({ ...formData, subjectId: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.code ? `(${s.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Class Arm <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.classArmId}
                    onChange={(e) =>
                      setFormData({ ...formData, classArmId: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select Class Arm</option>
                    {classArms.map((ca) => (
                      <option key={ca.id} value={ca.id}>
                        {ca.className} {ca.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Term <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.termId}
                    onChange={(e) =>
                      setFormData({ ...formData, termId: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select Term</option>
                    {terms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Max Score
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.maxScore}
                    onChange={(e) =>
                      setFormData({ ...formData, maxScore: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="100"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData(EMPTY_FORM);
                }}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Homework"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submissions Modal */}
      {showSubmissionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[80vh] rounded-xl border border-border bg-card shadow-lg flex flex-col">
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Submissions: {viewingHomeworkTitle}
              </h3>
              <button
                onClick={() => {
                  setShowSubmissionsModal(false);
                  setSubmissions([]);
                }}
                className="rounded-md border border-input px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {submissions.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No submissions yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Student ID
                      </th>
                      <th className="px-3 py-2 text-center font-medium">
                        Status
                      </th>
                      <th className="px-3 py-2 text-center font-medium">
                        Score
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Submitted At
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub, idx) => (
                      <tr
                        key={sub.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-3 py-2 text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {sub.studentId}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <StatusBadge status={sub.status} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {sub.score !== null ? sub.score : "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(sub.submittedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
