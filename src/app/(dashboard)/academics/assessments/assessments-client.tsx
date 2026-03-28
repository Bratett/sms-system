"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getAssessmentTypesAction,
  createAssessmentTypeAction,
  updateAssessmentTypeAction,
  deleteAssessmentTypeAction,
} from "@/modules/academics/actions/assessment.action";

// ─── Types ──────────────────────────────────────────────────────────

interface AssessmentType {
  id: string;
  name: string;
  code: string | null;
  category: string;
  weight: number;
  maxScore: number;
  termId: string | null;
  markCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Term {
  id: string;
  name: string;
  termNumber: number;
  academicYearId: string;
  academicYearName: string;
  isCurrent: boolean;
}

interface FormData {
  name: string;
  code: string;
  category: string;
  weight: number;
  maxScore: number;
  termId: string;
}

const CATEGORIES = [
  { value: "CLASSWORK", label: "Classwork" },
  { value: "HOMEWORK", label: "Homework" },
  { value: "PROJECT", label: "Project" },
  { value: "MIDTERM", label: "Midterm" },
  { value: "END_OF_TERM", label: "End of Term" },
];

const CATEGORY_COLORS: Record<string, string> = {
  CLASSWORK: "bg-blue-100 text-blue-700",
  HOMEWORK: "bg-purple-100 text-purple-700",
  PROJECT: "bg-amber-100 text-amber-700",
  MIDTERM: "bg-orange-100 text-orange-700",
  END_OF_TERM: "bg-red-100 text-red-700",
};

// ─── Component ──────────────────────────────────────────────────────

export function AssessmentsClient({
  initialAssessmentTypes,
  terms,
}: {
  initialAssessmentTypes: AssessmentType[];
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filter
  const currentTerm = terms.find((t) => t.isCurrent);
  const [selectedTermId, setSelectedTermId] = useState<string>(currentTerm?.id ?? "");
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>(initialAssessmentTypes);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AssessmentType | null>(null);
  const [form, setForm] = useState<FormData>({
    name: "",
    code: "",
    category: "CLASSWORK",
    weight: 10,
    maxScore: 100,
    termId: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Filter by term
  useEffect(() => {
    startTransition(async () => {
      const result = await getAssessmentTypesAction(selectedTermId || undefined);
      if (result.data) {
        setAssessmentTypes(result.data);
      }
    });
  }, [selectedTermId]);

  // ─── Weight calculations ──────────────────────────────────────────

  const totalWeight = assessmentTypes.reduce((sum, at) => sum + at.weight, 0);
  const remainingWeight = 100 - totalWeight;
  const weightExceeded = totalWeight > 100;

  // ─── CRUD Handlers ────────────────────────────────────────────────

  function handleCreate() {
    setEditing(null);
    setForm({
      name: "",
      code: "",
      category: "CLASSWORK",
      weight: 10,
      maxScore: 100,
      termId: selectedTermId,
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleEdit(at: AssessmentType) {
    setEditing(at);
    setForm({
      name: at.name,
      code: at.code ?? "",
      category: at.category,
      weight: at.weight,
      maxScore: at.maxScore,
      termId: at.termId ?? "",
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleDelete(at: AssessmentType) {
    if (!confirm(`Are you sure you want to delete assessment type "${at.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteAssessmentTypeAction(at.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Assessment type "${at.name}" deleted successfully.`);
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Assessment type name is required.");
      return;
    }
    if (form.weight <= 0) {
      setFormError("Weight must be greater than 0.");
      return;
    }
    if (form.maxScore <= 0) {
      setFormError("Max score must be greater than 0.");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      if (editing) {
        const result = await updateAssessmentTypeAction(editing.id, {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          category: form.category as "CLASSWORK" | "HOMEWORK" | "PROJECT" | "MIDTERM" | "END_OF_TERM",
          weight: form.weight,
          maxScore: form.maxScore,
          termId: form.termId || undefined,
        });
        if (result.error) {
          setFormError(result.error);
        } else {
          toast.success(`Assessment type "${form.name}" updated successfully.`);
          setShowModal(false);
          router.refresh();
        }
      } else {
        const result = await createAssessmentTypeAction({
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          category: form.category as "CLASSWORK" | "HOMEWORK" | "PROJECT" | "MIDTERM" | "END_OF_TERM",
          weight: form.weight,
          maxScore: form.maxScore,
          termId: form.termId || undefined,
        });
        if (result.error) {
          setFormError(result.error);
        } else {
          toast.success(`Assessment type "${form.name}" created successfully.`);
          setShowModal(false);
          router.refresh();
        }
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Term:</label>
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.academicYearName}) {t.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Assessment Type
        </button>
      </div>

      {/* Weight Summary Bar */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">
            Weight Distribution {selectedTermId ? "(for selected term)" : "(all terms)"}
          </h3>
          <span className={`text-sm font-medium ${weightExceeded ? "text-red-600" : "text-muted-foreground"}`}>
            {totalWeight}% / 100%
            {weightExceeded && " - EXCEEDS LIMIT"}
          </span>
        </div>
        <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              weightExceeded
                ? "bg-red-500"
                : totalWeight === 100
                  ? "bg-green-500"
                  : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(totalWeight, 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>Used: {totalWeight}%</span>
          <span>
            {weightExceeded
              ? `Over by ${totalWeight - 100}%`
              : `Remaining: ${remainingWeight}%`}
          </span>
        </div>
        {weightExceeded && (
          <p className="mt-2 text-xs text-red-600 font-medium">
            Warning: Total weight exceeds 100%. Adjust weights to ensure they add up to 100%.
          </p>
        )}
      </div>

      {/* Assessment Types Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-center font-medium">Weight %</th>
                <th className="px-4 py-3 text-center font-medium">Max Score</th>
                <th className="px-4 py-3 text-center font-medium">Marks Entered</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assessmentTypes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No assessment types found. Click &quot;Add Assessment Type&quot; to create one.
                  </td>
                </tr>
              ) : (
                assessmentTypes.map((at) => (
                  <tr
                    key={at.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{at.name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {at.code || "---"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          CATEGORY_COLORS[at.category] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {at.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{at.weight}%</td>
                    <td className="px-4 py-3 text-center">{at.maxScore}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={at.markCount > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                        {at.markCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleEdit(at)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          onClick={() => handleDelete(at)}
                          disabled={isPending}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editing ? `Edit: ${editing.name}` : "Add Assessment Type"}
              </h2>
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
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder='e.g. "Class Test 1", "End of Term Exam"'
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Code</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="e.g. CT1, MID, EoT"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Weight (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Current total: {totalWeight}% (remaining: {remainingWeight}%)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Max Score <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={form.maxScore}
                    onChange={(e) => setForm({ ...form, maxScore: parseInt(e.target.value) || 100 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Term</label>
                <select
                  value={form.termId}
                  onChange={(e) => setForm({ ...form, termId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No specific term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.academicYearName}) {t.isCurrent ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Weight warning */}
              {form.termId && (() => {
                const editingWeight = editing ? editing.weight : 0;
                const termTypes = assessmentTypes.filter(
                  (at) => at.termId === form.termId && at.id !== editing?.id,
                );
                const otherWeight = termTypes.reduce((sum, at) => sum + at.weight, 0);
                const projectedTotal = otherWeight + form.weight;
                if (projectedTotal > 100) {
                  return (
                    <div className="rounded-md p-3 text-sm bg-yellow-50 text-yellow-800 border border-yellow-200">
                      Warning: Adding this weight would bring the total to {projectedTotal}% for this term.
                      Weights should not exceed 100%.
                    </div>
                  );
                }
                return null;
              })()}

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
                  {isPending
                    ? "Saving..."
                    : editing
                      ? "Update Assessment Type"
                      : "Create Assessment Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
