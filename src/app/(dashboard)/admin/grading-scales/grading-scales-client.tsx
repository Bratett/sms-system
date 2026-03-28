"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createGradingScaleAction,
  updateGradingScaleAction,
  deleteGradingScaleAction,
  setDefaultGradingScaleAction,
} from "@/modules/school/actions/grading-scale.action";

interface GradeDefinition {
  id: string;
  grade: string;
  minScore: number;
  maxScore: number;
  interpretation: string;
  gradePoint: number;
}

interface GradingScale {
  id: string;
  name: string;
  isDefault: boolean;
  gradeCount: number;
  gradeDefinitions: GradeDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

interface GradeRow {
  grade: string;
  minScore: number;
  maxScore: number;
  interpretation: string;
  gradePoint: number;
}

interface FormData {
  name: string;
  isDefault: boolean;
  grades: GradeRow[];
}

const EMPTY_GRADE: GradeRow = {
  grade: "",
  minScore: 0,
  maxScore: 0,
  interpretation: "",
  gradePoint: 0,
};

export function GradingScalesClient({
  gradingScales,
}: {
  gradingScales: GradingScale[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingScale, setEditingScale] = useState<GradingScale | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    isDefault: false,
    grades: [{ ...EMPTY_GRADE }],
  });
  const [formError, setFormError] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  function handleCreate() {
    setEditingScale(null);
    setFormData({
      name: "",
      isDefault: false,
      grades: [{ ...EMPTY_GRADE }],
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleEdit(scale: GradingScale) {
    setEditingScale(scale);
    setFormData({
      name: scale.name,
      isDefault: scale.isDefault,
      grades: scale.gradeDefinitions.map((gd) => ({
        grade: gd.grade,
        minScore: gd.minScore,
        maxScore: gd.maxScore,
        interpretation: gd.interpretation,
        gradePoint: gd.gradePoint,
      })),
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleClose() {
    setShowModal(false);
    setEditingScale(null);
    setFormError(null);
  }

  function handleDelete(scale: GradingScale) {
    if (scale.isDefault) {
      toast.error("Cannot delete the default grading scale.");
      return;
    }
    if (!confirm(`Are you sure you want to delete grading scale "${scale.name}"?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteGradingScaleAction(scale.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Grading scale "${scale.name}" deleted successfully.`);
        router.refresh();
      }
    });
  }

  function handleSetDefault(scale: GradingScale) {
    if (scale.isDefault) return;
    startTransition(async () => {
      const result = await setDefaultGradingScaleAction(scale.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`"${scale.name}" set as the default grading scale.`);
        router.refresh();
      }
    });
  }

  function addGradeRow() {
    setFormData({
      ...formData,
      grades: [...formData.grades, { ...EMPTY_GRADE }],
    });
  }

  function removeGradeRow(index: number) {
    if (formData.grades.length <= 1) return;
    const updated = formData.grades.filter((_, i) => i !== index);
    setFormData({ ...formData, grades: updated });
  }

  function updateGradeRow(index: number, field: keyof GradeRow, value: string | number) {
    const updated = [...formData.grades];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, grades: updated });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Scale name is required.");
      return;
    }

    // Validate grade rows
    const validGrades = formData.grades.filter((g) => g.grade.trim() !== "");
    if (validGrades.length === 0) {
      setFormError("At least one grade definition is required.");
      return;
    }

    for (const g of validGrades) {
      if (g.minScore > g.maxScore) {
        setFormError(`Grade "${g.grade}": min score cannot be greater than max score.`);
        return;
      }
    }

    setFormError(null);

    startTransition(async () => {
      const grades = validGrades.map((g) => ({
        grade: g.grade.trim(),
        minScore: Number(g.minScore),
        maxScore: Number(g.maxScore),
        interpretation: g.interpretation.trim(),
        gradePoint: Number(g.gradePoint),
      }));

      if (editingScale) {
        const result = await updateGradingScaleAction(editingScale.id, {
          name: formData.name.trim(),
          isDefault: formData.isDefault,
          grades,
        });
        if (result.error) {
          setFormError(result.error);
        } else {
          toast.success(`Grading scale "${formData.name}" updated successfully.`);
          handleClose();
          router.refresh();
        }
      } else {
        const result = await createGradingScaleAction({
          name: formData.name.trim(),
          isDefault: formData.isDefault,
          grades,
        });
        if (result.error) {
          setFormError(result.error);
        } else {
          toast.success(`Grading scale "${formData.name}" created successfully.`);
          handleClose();
          router.refresh();
        }
      }
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Grading Scale
        </button>
      </div>

      {gradingScales.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No grading scales found. Click &quot;Add Grading Scale&quot; to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {gradingScales.map((scale) => (
            <div
              key={scale.id}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              {/* Card header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/30"
                onClick={() => toggleExpand(scale.id)}
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      expandedId === scale.id ? "rotate-90" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{scale.name}</h3>
                      {scale.isDefault && (
                        <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {scale.gradeCount} grade{scale.gradeCount !== 1 ? "s" : ""} defined
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {!scale.isDefault && (
                    <button
                      className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                      onClick={() => handleSetDefault(scale)}
                      disabled={isPending}
                    >
                      Set as Default
                    </button>
                  )}
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    onClick={() => handleEdit(scale)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    onClick={() => handleDelete(scale)}
                    disabled={isPending || scale.isDefault}
                    title={scale.isDefault ? "Cannot delete the default scale" : "Delete scale"}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Expanded grade definitions table */}
              {expandedId === scale.id && (
                <div className="border-t border-border px-5 pb-4">
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">Grade</th>
                          <th className="px-3 py-2 text-center font-medium">Min Score</th>
                          <th className="px-3 py-2 text-center font-medium">Max Score</th>
                          <th className="px-3 py-2 text-left font-medium">Interpretation</th>
                          <th className="px-3 py-2 text-center font-medium">Grade Point</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scale.gradeDefinitions.map((gd) => (
                          <tr
                            key={gd.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-3 py-2 font-medium">{gd.grade}</td>
                            <td className="px-3 py-2 text-center">{gd.minScore}</td>
                            <td className="px-3 py-2 text-center">{gd.maxScore}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {gd.interpretation}
                            </td>
                            <td className="px-3 py-2 text-center">{gd.gradePoint}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal for creating/editing grading scales */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingScale
                  ? `Edit Grading Scale: ${editingScale.name}`
                  : "Add Grading Scale"}
              </h2>
              <button
                type="button"
                onClick={handleClose}
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

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Scale Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="e.g. Ghana SHS Grading Scale"
                    required
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) =>
                        setFormData({ ...formData, isDefault: e.target.checked })
                      }
                      className="rounded border-input"
                    />
                    Set as default grading scale
                  </label>
                </div>
              </div>

              {/* Grade definitions table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">
                    Grade Definitions ({formData.grades.length})
                  </label>
                  <button
                    type="button"
                    onClick={addGradeRow}
                    className="rounded-md border border-input px-3 py-1 text-xs font-medium hover:bg-muted"
                  >
                    + Add Grade
                  </button>
                </div>

                <div className="overflow-x-auto rounded-md border border-input">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">Grade</th>
                        <th className="px-3 py-2 text-left font-medium">Min Score</th>
                        <th className="px-3 py-2 text-left font-medium">Max Score</th>
                        <th className="px-3 py-2 text-left font-medium">Interpretation</th>
                        <th className="px-3 py-2 text-left font-medium">Grade Point</th>
                        <th className="px-3 py-2 text-center font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.grades.map((row, index) => (
                        <tr key={index} className="border-b border-border last:border-0">
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={row.grade}
                              onChange={(e) => updateGradeRow(index, "grade", e.target.value)}
                              className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                              placeholder="A1"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.1"
                              value={row.minScore}
                              onChange={(e) =>
                                updateGradeRow(index, "minScore", parseFloat(e.target.value) || 0)
                              }
                              className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.1"
                              value={row.maxScore}
                              onChange={(e) =>
                                updateGradeRow(index, "maxScore", parseFloat(e.target.value) || 0)
                              }
                              className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={row.interpretation}
                              onChange={(e) =>
                                updateGradeRow(index, "interpretation", e.target.value)
                              }
                              className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                              placeholder="Excellent"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.1"
                              value={row.gradePoint}
                              onChange={(e) =>
                                updateGradeRow(
                                  index,
                                  "gradePoint",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeGradeRow(index)}
                              className="text-red-500 hover:text-red-700 disabled:opacity-30"
                              disabled={formData.grades.length <= 1}
                              title="Remove grade"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={handleClose}
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
                    : editingScale
                      ? "Update Grading Scale"
                      : "Create Grading Scale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
