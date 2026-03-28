"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getClassesAction,
  createClassAction,
  updateClassAction,
  deleteClassAction,
  createClassArmAction,
  updateClassArmAction,
  deleteClassArmAction,
} from "@/modules/academics/actions/class.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ClassArm {
  id: string;
  name: string;
  capacity: number;
  status: string;
  enrollmentCount: number;
}

interface ClassItem {
  id: string;
  name: string;
  code: string | null;
  yearGroup: number;
  maxCapacity: number;
  status: string;
  programmeId: string;
  programmeName: string;
  academicYearId: string;
  classArmCount: number;
  enrollmentCount: number;
  classArms: ClassArm[];
  createdAt: Date;
  updatedAt: Date;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface ProgrammeOption {
  id: string;
  name: string;
}

interface ClassFormData {
  name: string;
  code: string;
  programmeId: string;
  yearGroup: number;
  maxCapacity: number;
}

interface ArmFormData {
  name: string;
  capacity: number;
}

// ─── Component ──────────────────────────────────────────────────────

export function ClassesClient({
  initialClasses,
  academicYears,
  programmes,
}: {
  initialClasses: ClassItem[];
  academicYears: AcademicYear[];
  programmes: ProgrammeOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Academic year filter
  const currentYear = academicYears.find((ay) => ay.isCurrent);
  const [selectedYearId, setSelectedYearId] = useState<string>(currentYear?.id ?? "");
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Class modal
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [classForm, setClassForm] = useState<ClassFormData>({
    name: "",
    code: "",
    programmeId: "",
    yearGroup: 1,
    maxCapacity: 50,
  });
  const [classFormError, setClassFormError] = useState<string | null>(null);

  // Arm modal
  const [showArmModal, setShowArmModal] = useState(false);
  const [editingArm, setEditingArm] = useState<ClassArm | null>(null);
  const [armParentClassId, setArmParentClassId] = useState<string>("");
  const [armForm, setArmForm] = useState<ArmFormData>({ name: "", capacity: 50 });
  const [armFormError, setArmFormError] = useState<string | null>(null);

  // Filter classes by selected academic year
  useEffect(() => {
    if (!selectedYearId) {
      startTransition(() => setClasses(initialClasses));
      return;
    }
    startTransition(async () => {
      const result = await getClassesAction(selectedYearId);
      if (result.data) {
        setClasses(result.data);
      }
    });
  }, [selectedYearId, initialClasses]);

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ─── Class CRUD ─────────────────────────────────────────────────

  function handleCreateClass() {
    setEditingClass(null);
    setClassForm({
      name: "",
      code: "",
      programmeId: programmes[0]?.id ?? "",
      yearGroup: 1,
      maxCapacity: 50,
    });
    setClassFormError(null);
    setShowClassModal(true);
  }

  function handleEditClass(cls: ClassItem) {
    setEditingClass(cls);
    setClassForm({
      name: cls.name,
      code: cls.code ?? "",
      programmeId: cls.programmeId,
      yearGroup: cls.yearGroup,
      maxCapacity: cls.maxCapacity,
    });
    setClassFormError(null);
    setShowClassModal(true);
  }

  function handleDeleteClass(cls: ClassItem) {
    if (!confirm(`Are you sure you want to delete class "${cls.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteClassAction(cls.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Class "${cls.name}" deleted successfully.`);
        router.refresh();
      }
    });
  }

  function handleSubmitClass(e: React.FormEvent) {
    e.preventDefault();
    if (!classForm.name.trim()) {
      setClassFormError("Class name is required.");
      return;
    }
    if (!classForm.programmeId) {
      setClassFormError("Please select a programme.");
      return;
    }
    if (!selectedYearId && !editingClass) {
      setClassFormError("Please select an academic year first.");
      return;
    }
    setClassFormError(null);

    startTransition(async () => {
      if (editingClass) {
        const result = await updateClassAction(editingClass.id, {
          name: classForm.name.trim(),
          code: classForm.code.trim() || undefined,
          programmeId: classForm.programmeId,
          yearGroup: classForm.yearGroup,
          maxCapacity: classForm.maxCapacity,
        });
        if (result.error) {
          setClassFormError(result.error);
        } else {
          toast.success(`Class "${classForm.name}" updated successfully.`);
          setShowClassModal(false);
          router.refresh();
        }
      } else {
        const result = await createClassAction({
          programmeId: classForm.programmeId,
          academicYearId: selectedYearId,
          yearGroup: classForm.yearGroup,
          name: classForm.name.trim(),
          code: classForm.code.trim() || undefined,
          maxCapacity: classForm.maxCapacity,
        });
        if (result.error) {
          setClassFormError(result.error);
        } else {
          toast.success(`Class "${classForm.name}" created successfully.`);
          setShowClassModal(false);
          router.refresh();
        }
      }
    });
  }

  // ─── Arm CRUD ───────────────────────────────────────────────────

  function handleCreateArm(classId: string) {
    setArmParentClassId(classId);
    setEditingArm(null);
    setArmForm({ name: "", capacity: 50 });
    setArmFormError(null);
    setShowArmModal(true);
  }

  function handleEditArm(classId: string, arm: ClassArm) {
    setArmParentClassId(classId);
    setEditingArm(arm);
    setArmForm({ name: arm.name, capacity: arm.capacity });
    setArmFormError(null);
    setShowArmModal(true);
  }

  function handleDeleteArm(arm: ClassArm) {
    if (!confirm(`Are you sure you want to delete class arm "${arm.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteClassArmAction(arm.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Class arm "${arm.name}" deleted successfully.`);
        router.refresh();
      }
    });
  }

  function handleSubmitArm(e: React.FormEvent) {
    e.preventDefault();
    if (!armForm.name.trim()) {
      setArmFormError("Arm name is required.");
      return;
    }
    setArmFormError(null);

    startTransition(async () => {
      if (editingArm) {
        const result = await updateClassArmAction(editingArm.id, {
          name: armForm.name.trim(),
          capacity: armForm.capacity,
        });
        if (result.error) {
          setArmFormError(result.error);
        } else {
          toast.success(`Class arm "${armForm.name}" updated successfully.`);
          setShowArmModal(false);
          router.refresh();
        }
      } else {
        const result = await createClassArmAction({
          classId: armParentClassId,
          name: armForm.name.trim(),
          capacity: armForm.capacity,
        });
        if (result.error) {
          setArmFormError(result.error);
        } else {
          toast.success(`Class arm "${armForm.name}" created successfully.`);
          setShowArmModal(false);
          router.refresh();
        }
      }
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Academic Year:</label>
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Years</option>
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCreateClass}
          disabled={!selectedYearId}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Add Class
        </button>
      </div>

      {/* Classes Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-4 py-3"></th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Programme</th>
                <th className="px-4 py-3 text-center font-medium">Year Group</th>
                <th className="px-4 py-3 text-center font-medium">Arms</th>
                <th className="px-4 py-3 text-center font-medium">Enrolled</th>
                <th className="px-4 py-3 text-center font-medium">Capacity</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    {selectedYearId
                      ? 'No classes found for this academic year. Click "Add Class" to create one.'
                      : "Select an academic year to view classes."}
                  </td>
                </tr>
              ) : (
                classes.map((cls) => (
                  <>
                    {/* Class Row */}
                    <tr
                      key={cls.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleRow(cls.id)}
                          className="text-muted-foreground hover:text-foreground"
                          title={expandedRows.has(cls.id) ? "Collapse" : "Expand"}
                        >
                          {expandedRows.has(cls.id) ? "▼" : "▶"}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium">{cls.name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {cls.code || "---"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{cls.programmeName}</td>
                      <td className="px-4 py-3 text-center">SHS {cls.yearGroup}</td>
                      <td className="px-4 py-3 text-center">{cls.classArmCount}</td>
                      <td className="px-4 py-3 text-center">{cls.enrollmentCount}</td>
                      <td className="px-4 py-3 text-center">{cls.maxCapacity}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={cls.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            onClick={() => handleEditClass(cls)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            onClick={() => handleDeleteClass(cls)}
                            disabled={isPending}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Arms */}
                    {expandedRows.has(cls.id) && (
                      <tr key={`${cls.id}-arms`}>
                        <td colSpan={10} className="bg-muted/20 px-4 py-3">
                          <div className="ml-8">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-foreground">
                                Class Arms for {cls.name}
                              </h4>
                              <button
                                onClick={() => handleCreateArm(cls.id)}
                                className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                              >
                                + Add Arm
                              </button>
                            </div>
                            {cls.classArms.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">
                                No class arms yet. Click &quot;+ Add Arm&quot; to create one.
                              </p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="px-3 py-2 text-left font-medium">Arm Name</th>
                                    <th className="px-3 py-2 text-center font-medium">Enrolled</th>
                                    <th className="px-3 py-2 text-center font-medium">Capacity</th>
                                    <th className="px-3 py-2 text-center font-medium">Status</th>
                                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cls.classArms.map((arm) => (
                                    <tr
                                      key={arm.id}
                                      className="border-b border-border/50 last:border-0"
                                    >
                                      <td className="px-3 py-2 font-medium">
                                        {cls.name} {arm.name}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {arm.enrollmentCount}
                                      </td>
                                      <td className="px-3 py-2 text-center">{arm.capacity}</td>
                                      <td className="px-3 py-2 text-center">
                                        <StatusBadge status={arm.status} />
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                            onClick={() => handleEditArm(cls.id, arm)}
                                          >
                                            Edit
                                          </button>
                                          <button
                                            className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                                            onClick={() => handleDeleteArm(arm)}
                                            disabled={isPending}
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Class Modal */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingClass ? `Edit Class: ${editingClass.name}` : "Add Class"}
              </h2>
              <button
                type="button"
                onClick={() => setShowClassModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitClass} className="p-6 space-y-4">
              {classFormError && (
                <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                  {classFormError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Class Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. SHS 1 Science"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Code</label>
                  <input
                    type="text"
                    value={classForm.code}
                    onChange={(e) => setClassForm({ ...classForm, code: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="e.g. S1SCI"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Year Group <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={classForm.yearGroup}
                    onChange={(e) =>
                      setClassForm({ ...classForm, yearGroup: parseInt(e.target.value) })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value={1}>Year 1 (SHS 1)</option>
                    <option value={2}>Year 2 (SHS 2)</option>
                    <option value={3}>Year 3 (SHS 3)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Programme <span className="text-red-500">*</span>
                </label>
                <select
                  value={classForm.programmeId}
                  onChange={(e) => setClassForm({ ...classForm, programmeId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select a programme</option>
                  {programmes.map((prog) => (
                    <option key={prog.id} value={prog.id}>
                      {prog.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Max Capacity</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={classForm.maxCapacity}
                  onChange={(e) =>
                    setClassForm({ ...classForm, maxCapacity: parseInt(e.target.value) || 50 })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : editingClass ? "Update Class" : "Create Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Arm Modal */}
      {showArmModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingArm ? `Edit Arm: ${editingArm.name}` : "Add Class Arm"}
              </h2>
              <button
                type="button"
                onClick={() => setShowArmModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitArm} className="p-6 space-y-4">
              {armFormError && (
                <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                  {armFormError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Arm Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={armForm.name}
                  onChange={(e) => setArmForm({ ...armForm, name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. A, B, C"
                  required
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Suggestions:</span>
                  {["A", "B", "C", "D", "E"].map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setArmForm({ ...armForm, name })}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Capacity</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={armForm.capacity}
                  onChange={(e) =>
                    setArmForm({ ...armForm, capacity: parseInt(e.target.value) || 50 })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowArmModal(false)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : editingArm ? "Update Arm" : "Create Arm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
