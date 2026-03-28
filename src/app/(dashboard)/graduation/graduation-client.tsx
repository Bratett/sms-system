"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createGraduationBatchAction,
  addGraduatesToBatchAction,
  confirmGraduateAction,
  completeBatchAction,
  searchGraduationEligibleStudentsAction,
} from "@/modules/graduation/actions/graduation.action";

// ─── Types ──────────────────────────────────────────────────────────

interface GraduationRecordRow {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  certificateNumber: string | null;
  honours: string | null;
  status: string;
}

interface BatchRow {
  id: string;
  name: string;
  academicYearId: string;
  academicYearName: string;
  ceremonyDate: Date | string | null;
  status: string;
  recordCount: number;
  confirmedCount: number;
  records: GraduationRecordRow[];
  createdAt: Date | string;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface StudentOption {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(dateStr: Date | string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────

export function GraduationClient({
  batches: initialBatches,
  academicYears,
}: {
  batches: BatchRow[];
  academicYears: AcademicYear[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [batches] = useState<BatchRow[]>(initialBatches);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  // Create batch modal
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    academicYearId: academicYears.find((y) => y.isCurrent)?.id ?? "",
    name: "",
    ceremonyDate: "",
  });

  // Add graduates modal
  const [showAddGraduates, setShowAddGraduates] = useState(false);
  const [addToBatchId, setAddToBatchId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<StudentOption[]>([]);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // Confirm graduate modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingRecord, setConfirmingRecord] = useState<GraduationRecordRow | null>(null);
  const [confirmForm, setConfirmForm] = useState({
    certificateNumber: "",
    honours: "",
  });

  // ─── Batch Handlers ───────────────────────────────────────────────

  function handleCreateBatch() {
    if (!createForm.name.trim()) {
      toast.error("Batch name is required.");
      return;
    }
    if (!createForm.academicYearId) {
      toast.error("Academic year is required.");
      return;
    }

    startTransition(async () => {
      const result = await createGraduationBatchAction({
        academicYearId: createForm.academicYearId,
        name: createForm.name,
        ceremonyDate: createForm.ceremonyDate || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Graduation batch created.");
      setShowCreateForm(false);
      router.refresh();
    });
  }

  function handleCompleteBatch(batchId: string) {
    if (!confirm("Mark this batch as completed? This action is final.")) return;

    startTransition(async () => {
      const result = await completeBatchAction(batchId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Batch marked as completed.");
      router.refresh();
    });
  }

  // ─── Add Graduates ────────────────────────────────────────────────

  function openAddGraduates(batchId: string) {
    setAddToBatchId(batchId);
    setSelectedStudents([]);
    setStudentSearch("");
    setStudentResults([]);
    setShowAddGraduates(true);
  }

  function handleStudentSearch(value: string) {
    setStudentSearch(value);
    if (value.length >= 2) {
      startTransition(async () => {
        const result = await searchGraduationEligibleStudentsAction(value);
        if (result.data) {
          setStudentResults(result.data);
          setShowStudentDropdown(true);
        }
      });
    } else {
      setStudentResults([]);
      setShowStudentDropdown(false);
    }
  }

  function selectStudent(student: StudentOption) {
    if (!selectedStudents.find((s) => s.id === student.id)) {
      setSelectedStudents([...selectedStudents, student]);
    }
    setStudentSearch("");
    setShowStudentDropdown(false);
  }

  function removeStudent(id: string) {
    setSelectedStudents(selectedStudents.filter((s) => s.id !== id));
  }

  function handleAddGraduates() {
    if (!addToBatchId || selectedStudents.length === 0) {
      toast.error("Select at least one student.");
      return;
    }

    startTransition(async () => {
      const result = await addGraduatesToBatchAction(
        addToBatchId,
        selectedStudents.map((s) => s.id),
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data?.added ?? 0} students added to batch.`);
      setShowAddGraduates(false);
      router.refresh();
    });
  }

  // ─── Confirm Graduate ─────────────────────────────────────────────

  function openConfirmModal(record: GraduationRecordRow) {
    setConfirmingRecord(record);
    setConfirmForm({
      certificateNumber: record.certificateNumber ?? "",
      honours: record.honours ?? "",
    });
    setShowConfirmModal(true);
  }

  function handleConfirmGraduate() {
    if (!confirmingRecord) return;

    startTransition(async () => {
      const result = await confirmGraduateAction(confirmingRecord.id, {
        certificateNumber: confirmForm.certificateNumber || undefined,
        honours: confirmForm.honours || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Graduate confirmed.");
      setShowConfirmModal(false);
      router.refresh();
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            setCreateForm({
              academicYearId: academicYears.find((y) => y.isCurrent)?.id ?? "",
              name: "",
              ceremonyDate: "",
            });
            setShowCreateForm(true);
          }}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Batch
        </button>
      </div>

      {/* Batches */}
      <div className="space-y-4">
        {batches.map((batch) => (
          <div key={batch.id} className="rounded-lg border bg-card">
            {/* Batch Header */}
            <div
              className="flex cursor-pointer items-center justify-between p-4"
              onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
            >
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{batch.name}</h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      batch.status === "COMPLETED"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {batch.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {batch.academicYearName} | {batch.recordCount} graduates ({batch.confirmedCount}{" "}
                  confirmed)
                  {batch.ceremonyDate && ` | Ceremony: ${formatDate(batch.ceremonyDate)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {batch.status === "PENDING" && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddGraduates(batch.id);
                      }}
                      disabled={isPending}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      Add Graduates
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompleteBatch(batch.id);
                      }}
                      disabled={isPending}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      Complete
                    </button>
                  </>
                )}
                <svg
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    expandedBatch === batch.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Expanded Records */}
            {expandedBatch === batch.id && batch.records.length > 0 && (
              <div className="border-t">
                <table className="min-w-full divide-y">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                        Student
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                        Student ID
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                        Certificate #
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                        Honours
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-card">
                    {batch.records.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-2 text-sm font-medium">{record.studentName}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {record.studentCode}
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {record.certificateNumber ?? "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {record.honours ?? "-"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              record.status === "CONFIRMED"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {record.status === "PENDING" && batch.status === "PENDING" && (
                            <button
                              onClick={() => openConfirmModal(record)}
                              disabled={isPending}
                              className="text-xs text-green-600 hover:underline"
                            >
                              Confirm
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expandedBatch === batch.id && batch.records.length === 0 && (
              <div className="border-t px-4 py-4 text-center text-sm text-muted-foreground">
                No graduates added yet. Click &quot;Add Graduates&quot; to begin.
              </div>
            )}
          </div>
        ))}

        {batches.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No graduation batches yet. Create one to get started.
          </p>
        )}
      </div>

      {/* Create Batch Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Graduation Batch</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Batch Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Class of 2026"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Academic Year *</label>
                <select
                  value={createForm.academicYearId}
                  onChange={(e) => setCreateForm({ ...createForm, academicYearId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Year</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.isCurrent ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ceremony Date</label>
                <input
                  type="date"
                  value={createForm.ceremonyDate}
                  onChange={(e) => setCreateForm({ ...createForm, ceremonyDate: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBatch}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Graduates Modal */}
      {showAddGraduates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Add Graduates</h2>
            <div className="space-y-4">
              <div className="relative">
                <label className="mb-1 block text-sm font-medium">Search SHS 3 Students</label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => handleStudentSearch(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Search by name or student ID..."
                />
                {showStudentDropdown && studentResults.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border bg-background shadow-lg">
                    {studentResults.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => selectStudent(s)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        {s.firstName} {s.lastName}{" "}
                        <span className="text-muted-foreground">({s.studentId})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected students */}
              {selectedStudents.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    {selectedStudents.length} students selected:
                  </p>
                  <div className="max-h-40 space-y-1 overflow-auto">
                    {selectedStudents.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded border px-3 py-1.5 text-sm"
                      >
                        <span>
                          {s.firstName} {s.lastName} ({s.studentId})
                        </span>
                        <button
                          onClick={() => removeStudent(s.id)}
                          className="text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowAddGraduates(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleAddGraduates}
                disabled={isPending || selectedStudents.length === 0}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Adding..." : `Add ${selectedStudents.length} Students`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Graduate Modal */}
      {showConfirmModal && confirmingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Confirm Graduate</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {confirmingRecord.studentName} ({confirmingRecord.studentCode})
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Certificate Number</label>
                <input
                  type="text"
                  value={confirmForm.certificateNumber}
                  onChange={(e) =>
                    setConfirmForm({ ...confirmForm, certificateNumber: e.target.value })
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. CERT/2026/001"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Honours</label>
                <select
                  value={confirmForm.honours}
                  onChange={(e) => setConfirmForm({ ...confirmForm, honours: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">None</option>
                  <option value="First Class">First Class</option>
                  <option value="Second Class">Second Class</option>
                  <option value="Pass">Pass</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmGraduate}
                disabled={isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
