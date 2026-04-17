"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createIncidentAction,
  resolveIncidentAction,
  searchStudentsForDisciplineAction,
} from "@/modules/discipline/actions/discipline.action";

// ─── Types ──────────────────────────────────────────────────────────

interface IncidentRow {
  id: string;
  studentId: string;
  studentName: string;
  reportedByName: string;
  date: Date | string;
  type: string;
  description: string;
  severity: string;
  sanction: string | null;
  status: string;
  notes: string | null;
  createdAt: Date | string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface StudentOption {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

const INCIDENT_TYPES = [
  "Fighting",
  "Truancy",
  "Vandalism",
  "Disobedience",
  "Theft",
  "Bullying",
  "Drug Use",
  "Cheating",
  "Dress Code Violation",
  "Other",
];

function getSeverityBadge(severity: string) {
  const map: Record<string, string> = {
    MINOR: "bg-blue-100 text-blue-700",
    MODERATE: "bg-yellow-100 text-yellow-700",
    MAJOR: "bg-orange-100 text-orange-700",
    CRITICAL: "bg-red-100 text-red-700",
  };
  return map[severity] || "bg-gray-100 text-gray-700";
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    REPORTED: "bg-yellow-100 text-yellow-700",
    INVESTIGATING: "bg-blue-100 text-blue-700",
    RESOLVED: "bg-green-100 text-green-700",
    DISMISSED: "bg-gray-100 text-gray-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

function formatDate(dateStr: Date | string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────

export function DisciplineClient({
  incidents: initialIncidents,
  pagination,
}: {
  incidents: IncidentRow[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [incidents] = useState<IncidentRow[]>(initialIncidents);
  const [showForm, setShowForm] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [form, setForm] = useState({
    studentId: "",
    date: new Date().toISOString().split("T")[0],
    type: "Other",
    description: "",
    severity: "MINOR",
    sanction: "",
  });

  // Student search
  const [studentSearch, setStudentSearch] = useState("");
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // ─── Student Search ───────────────────────────────────────────────

  function handleStudentSearch(value: string) {
    setStudentSearch(value);
    if (value.length >= 2) {
      startTransition(async () => {
        const result = await searchStudentsForDisciplineAction(value);
        if ("data" in result) {
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
    setSelectedStudent(student);
    setForm({ ...form, studentId: student.id });
    setStudentSearch(`${student.firstName} ${student.lastName} (${student.studentId})`);
    setShowStudentDropdown(false);
  }

  // ─── Handlers ─────────────────────────────────────────────────────

  function openForm() {
    setForm({
      studentId: "",
      date: new Date().toISOString().split("T")[0],
      type: "Other",
      description: "",
      severity: "MINOR",
      sanction: "",
    });
    setSelectedStudent(null);
    setStudentSearch("");
    setShowForm(true);
  }

  function handleCreate() {
    if (!form.studentId) {
      toast.error("Please select a student.");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Description is required.");
      return;
    }

    startTransition(async () => {
      const result = await createIncidentAction({
        studentId: form.studentId,
        date: form.date,
        type: form.type,
        description: form.description,
        severity: form.severity,
        sanction: form.sanction || undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Incident reported.");
      setShowForm(false);
      router.refresh();
    });
  }

  function openResolveModal(id: string) {
    setResolvingId(id);
    setResolveNotes("");
    setShowResolveModal(true);
  }

  function handleResolve() {
    if (!resolvingId) return;

    startTransition(async () => {
      const result = await resolveIncidentAction(resolvingId, resolveNotes || undefined);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Incident resolved.");
      setShowResolveModal(false);
      router.refresh();
    });
  }

  // ─── Filter ───────────────────────────────────────────────────────

  const filtered = incidents.filter((i) => {
    if (filterStatus && i.status !== filterStatus) return false;
    if (filterSeverity && i.severity !== filterSeverity) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        i.studentName.toLowerCase().includes(term) ||
        i.type.toLowerCase().includes(term) ||
        i.description.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search incidents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-56 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="REPORTED">Reported</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Severity</option>
            <option value="MINOR">Minor</option>
            <option value="MODERATE">Moderate</option>
            <option value="MAJOR">Major</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
        <button
          onClick={openForm}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Report Incident
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Student
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Severity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Reported By
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {filtered.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{i.studentName}</p>
                </td>
                <td className="px-4 py-3 text-sm">{i.type}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSeverityBadge(i.severity)}`}
                  >
                    {i.severity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(i.status)}`}
                  >
                    {i.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(i.date)}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{i.reportedByName}</td>
                <td className="px-4 py-3 text-right">
                  {(i.status === "REPORTED" || i.status === "INVESTIGATING") && (
                    <button
                      onClick={() => openResolveModal(i.id)}
                      disabled={isPending}
                      className="text-xs text-green-600 hover:underline"
                    >
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No incidents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination.total > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {pagination.total} incidents
        </p>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Report Incident</h2>
            <div className="space-y-4">
              {/* Student Search */}
              <div className="relative">
                <label className="mb-1 block text-sm font-medium">Student *</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {INCIDENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Describe the incident..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="MINOR">Minor</option>
                    <option value="MODERATE">Moderate</option>
                    <option value="MAJOR">Major</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Sanction</label>
                  <input
                    type="text"
                    value={form.sanction}
                    onChange={(e) => setForm({ ...form, sanction: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. Warning, Suspension"
                  />
                </div>
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
                onClick={handleCreate}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Resolve Incident</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Resolution Notes</label>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Add resolution notes..."
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowResolveModal(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? "Resolving..." : "Resolve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
