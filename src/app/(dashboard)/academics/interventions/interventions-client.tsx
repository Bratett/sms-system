"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createInterventionAction,
  updateInterventionAction,
  deleteInterventionAction,
  addInterventionNoteAction,
} from "@/modules/academics/actions/intervention.action";

// ─── Types ──────────────────────────────────────────────────────────

interface InterventionItem {
  id: string;
  studentId: string;
  studentName: string;
  type: string;
  title: string;
  description: string | null;
  targetArea: string | null;
  status: string;
  startDate: Date | string;
  endDate: Date | string | null;
  assignedTo: string | null;
  academicYearId: string;
  termId: string;
  notes: any;
  createdAt: Date | string;
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

interface FormData {
  studentId: string;
  type: string;
  title: string;
  description: string;
  targetArea: string;
  startDate: string;
  endDate: string;
  assignedTo: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const INTERVENTION_TYPES = [
  "ACADEMIC_SUPPORT",
  "TUTORING",
  "COUNSELING",
  "PARENT_CONFERENCE",
  "MENTORING",
  "REMEDIAL_CLASS",
  "OTHER_INTERVENTION",
] as const;

const TYPE_LABELS: Record<string, string> = {
  ACADEMIC_SUPPORT: "Academic Support",
  TUTORING: "Tutoring",
  COUNSELING: "Counseling",
  PARENT_CONFERENCE: "Parent Conference",
  MENTORING: "Mentoring",
  REMEDIAL_CLASS: "Remedial Class",
  OTHER_INTERVENTION: "Other",
};

// ─── Helpers ────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    COMPLETED: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-gray-100 text-gray-700",
    ON_HOLD: "bg-amber-100 text-amber-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

function getTypeBadge(type: string) {
  const map: Record<string, string> = {
    ACADEMIC_SUPPORT: "bg-blue-100 text-blue-700",
    TUTORING: "bg-purple-100 text-purple-700",
    COUNSELING: "bg-teal-100 text-teal-700",
    PARENT_CONFERENCE: "bg-amber-100 text-amber-700",
    MENTORING: "bg-emerald-100 text-emerald-700",
    REMEDIAL_CLASS: "bg-rose-100 text-rose-700",
    OTHER_INTERVENTION: "bg-gray-100 text-gray-700",
  };
  return map[type] || "bg-gray-100 text-gray-700";
}

function formatDate(dateStr: Date | string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const emptyForm: FormData = {
  studentId: "",
  type: "ACADEMIC_SUPPORT",
  title: "",
  description: "",
  targetArea: "",
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
  assignedTo: "",
};

// ─── Component ──────────────────────────────────────────────────────

export function InterventionsClient({
  initialInterventions,
  terms,
  academicYears,
}: {
  initialInterventions: InterventionItem[];
  terms: Term[];
  academicYears: AcademicYear[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [interventions] = useState<InterventionItem[]>(initialInterventions);

  // Filters
  const [filterYear, setFilterYear] = useState("");
  const [filterTerm, setFilterTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InterventionItem | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  // Note modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTargetId, setNoteTargetId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  // ─── Filtered terms by year ───────────────────────────────────────

  const filteredTerms = filterYear
    ? terms.filter((t) => t.academicYearId === filterYear)
    : terms;

  // ─── Filter logic ─────────────────────────────────────────────────

  const filtered = interventions.filter((i) => {
    if (filterYear && i.academicYearId !== filterYear) return false;
    if (filterTerm && i.termId !== filterTerm) return false;
    if (filterStatus && i.status !== filterStatus) return false;
    if (filterType && i.type !== filterType) return false;
    return true;
  });

  // ─── CRUD Handlers ────────────────────────────────────────────────

  function handleCreate() {
    setEditingItem(null);
    setFormData(emptyForm);
    setShowModal(true);
  }

  function handleEdit(item: InterventionItem) {
    setEditingItem(item);
    setFormData({
      studentId: item.studentId,
      type: item.type,
      title: item.title,
      description: item.description ?? "",
      targetArea: item.targetArea ?? "",
      startDate: new Date(item.startDate).toISOString().split("T")[0],
      endDate: item.endDate
        ? new Date(item.endDate).toISOString().split("T")[0]
        : "",
      assignedTo: item.assignedTo ?? "",
    });
    setShowModal(true);
  }

  function handleDelete(item: InterventionItem) {
    if (!confirm(`Delete intervention "${item.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteInterventionAction(item.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Intervention deleted.");
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!formData.studentId.trim()) {
      toast.error("Student ID is required.");
      return;
    }

    const currentYear = academicYears.find((y) => y.isCurrent);
    const currentTerm = terms.find((t) => t.isCurrent);

    startTransition(async () => {
      if (editingItem) {
        const result = await updateInterventionAction(editingItem.id, {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          targetArea: formData.targetArea.trim() || undefined,
          endDate: formData.endDate ? new Date(formData.endDate) : undefined,
          assignedTo: formData.assignedTo.trim() || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Intervention updated.");
          setShowModal(false);
          router.refresh();
        }
      } else {
        const result = await createInterventionAction({
          studentId: formData.studentId.trim(),
          academicYearId: filterYear || currentYear?.id || "",
          termId: filterTerm || currentTerm?.id || "",
          type: formData.type,
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          targetArea: formData.targetArea.trim() || undefined,
          startDate: new Date(formData.startDate),
          endDate: formData.endDate ? new Date(formData.endDate) : undefined,
          assignedTo: formData.assignedTo.trim() || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Intervention created.");
          setShowModal(false);
          router.refresh();
        }
      }
    });
  }

  // ─── Note Handlers ────────────────────────────────────────────────

  function openNoteModal(id: string) {
    setNoteTargetId(id);
    setNoteText("");
    setShowNoteModal(true);
  }

  function handleAddNote() {
    if (!noteTargetId || !noteText.trim()) {
      toast.error("Note text is required.");
      return;
    }
    startTransition(async () => {
      const result = await addInterventionNoteAction(noteTargetId!, {
        text: noteText.trim(),
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Note added.");
        setShowNoteModal(false);
        router.refresh();
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterYear}
            onChange={(e) => {
              setFilterYear(e.target.value);
              setFilterTerm("");
            }}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Years</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
          <select
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Terms</option>
            {filteredTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ON_HOLD">On Hold</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Types</option>
            {INTERVENTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Intervention
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Student</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Target Area</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Start Date</th>
                <th className="px-4 py-3 text-left font-medium">Assigned To</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No interventions found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      {item.studentName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTypeBadge(item.type)}`}
                      >
                        {TYPE_LABELS[item.type] || item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.targetArea || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(item.status)}`}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(item.startDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.assignedTo || "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openNoteModal(item.id)}
                          className="text-xs font-medium text-teal-600 hover:text-teal-800"
                        >
                          Note
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          disabled={isPending}
                          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
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

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {interventions.length} interventions
      </p>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingItem ? "Edit Intervention" : "New Intervention"}
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
              {!editingItem && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Student ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.studentId}
                    onChange={(e) =>
                      setFormData({ ...formData, studentId: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Enter student ID"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {INTERVENTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
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
                    placeholder="Intervention title"
                    required
                  />
                </div>
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
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Describe the intervention..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Target Area
                </label>
                <input
                  type="text"
                  value={formData.targetArea}
                  onChange={(e) =>
                    setFormData({ ...formData, targetArea: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Mathematics, Reading"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Assigned To
                </label>
                <input
                  type="text"
                  value={formData.assignedTo}
                  onChange={(e) =>
                    setFormData({ ...formData, assignedTo: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Staff name or ID"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending
                    ? "Saving..."
                    : editingItem
                      ? "Update Intervention"
                      : "Create Intervention"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Add Note</h2>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={4}
                  placeholder="Add a progress note..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Adding..." : "Add Note"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
