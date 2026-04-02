"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getAllocationsAction,
  allocateBedAction,
  vacateBedAction,
} from "@/modules/boarding/actions/allocation.action";
import { getHostelAction } from "@/modules/boarding/actions/hostel.action";

// ─── Types ──────────────────────────────────────────────────────────

interface AllocationRow {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  hostelName: string;
  hostelId: string;
  dormitoryName: string;
  bedId: string;
  bedNumber: string;
  allocatedAt: Date;
  status: string;
  termId: string;
  academicYearId: string;
}

interface OccupancyRow {
  hostelId: string;
  hostelName: string;
  gender: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyPercent: number;
}

interface HostelOption {
  id: string;
  name: string;
  gender: string;
}

interface TermOption {
  id: string;
  name: string;
  academicYear: { id: string; name: string };
}

interface AcademicYearOption {
  id: string;
  name: string;
}

interface DormOption {
  id: string;
  name: string;
  beds: Array<{ id: string; bedNumber: string; status: string }>;
}

// ─── Component ──────────────────────────────────────────────────────

export function AllocationsClient({
  allocations: initialAllocations,
  occupancy,
  hostels,
  terms,
  academicYears,
}: {
  allocations: AllocationRow[];
  occupancy: OccupancyRow[];
  hostels: HostelOption[];
  terms: TermOption[];
  academicYears: AcademicYearOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [allocations, setAllocations] = useState<AllocationRow[]>(initialAllocations);
  const [filterHostel, setFilterHostel] = useState("");
  const [filterStatus, setFilterStatus] = useState("ACTIVE");

  // Allocate form
  const [showAllocateForm, setShowAllocateForm] = useState(false);
  const [allocateForm, setAllocateForm] = useState({
    studentSearch: "",
    studentId: "",
    studentName: "",
    hostelId: "",
    dormitoryId: "",
    bedId: "",
    termId: "",
    academicYearId: "",
  });
  const [dormitories, setDormitories] = useState<DormOption[]>([]);
  const [availableBeds, setAvailableBeds] = useState<Array<{ id: string; bedNumber: string }>>([]);

  // ─── Filter ─────────────────────────────────────────────────────

  function handleFilter() {
    startTransition(async () => {
      const result = await getAllocationsAction({
        hostelId: filterHostel || undefined,
        status: filterStatus || undefined,
      });
      if ("data" in result) {
        setAllocations(result.data);
      }
    });
  }

  // ─── Allocation ─────────────────────────────────────────────────

  function openAllocateForm() {
    setAllocateForm({
      studentSearch: "",
      studentId: "",
      studentName: "",
      hostelId: "",
      dormitoryId: "",
      bedId: "",
      termId: "",
      academicYearId: "",
    });
    setDormitories([]);
    setAvailableBeds([]);
    setShowAllocateForm(true);
  }

  function handleHostelChange(hostelId: string) {
    setAllocateForm((p) => ({ ...p, hostelId, dormitoryId: "", bedId: "" }));
    setAvailableBeds([]);

    if (!hostelId) {
      setDormitories([]);
      return;
    }

    startTransition(async () => {
      const result = await getHostelAction(hostelId);
      if ("data" in result) {
        setDormitories(
          result.data.dormitories.map((d) => ({
            id: d.id,
            name: d.name,
            beds: d.beds.map((b) => ({
              id: b.id,
              bedNumber: b.bedNumber,
              status: b.status,
            })),
          })),
        );
      }
    });
  }

  function handleDormitoryChange(dormId: string) {
    setAllocateForm((p) => ({ ...p, dormitoryId: dormId, bedId: "" }));
    const dorm = dormitories.find((d) => d.id === dormId);
    if (dorm) {
      setAvailableBeds(dorm.beds.filter((b) => b.status === "AVAILABLE"));
    } else {
      setAvailableBeds([]);
    }
  }

  function handleAllocate() {
    if (!allocateForm.studentId || !allocateForm.bedId || !allocateForm.termId || !allocateForm.academicYearId) {
      toast.error("Please fill in all required fields.");
      return;
    }

    startTransition(async () => {
      const result = await allocateBedAction({
        studentId: allocateForm.studentId,
        bedId: allocateForm.bedId,
        termId: allocateForm.termId,
        academicYearId: allocateForm.academicYearId,
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Student allocated to bed successfully.");
        setShowAllocateForm(false);
        router.refresh();
      }
    });
  }

  function handleVacate(allocationId: string, studentName: string) {
    if (!confirm(`Vacate bed for ${studentName}?`)) return;

    startTransition(async () => {
      const result = await vacateBedAction(allocationId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Bed vacated successfully.");
        router.refresh();
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

  return (
    <div className="space-y-6">
      {/* Occupancy Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {occupancy.map((o) => (
          <div key={o.hostelId} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{o.hostelName}</h4>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  o.gender === "MALE"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-pink-100 text-pink-700"
                }`}
              >
                {o.gender}
              </span>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {o.occupiedBeds}/{o.totalBeds} beds
                </span>
                <span>{o.occupancyPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full transition-all ${
                    o.occupancyPercent >= 90
                      ? "bg-red-500"
                      : o.occupancyPercent >= 70
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${o.occupancyPercent}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {o.availableBeds} beds available
            </p>
          </div>
        ))}
      </div>

      {/* Actions and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={filterHostel}
            onChange={(e) => setFilterHostel(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Hostels</option>
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="VACATED">Vacated</option>
          </select>
          <button
            onClick={handleFilter}
            disabled={isPending}
            className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Apply
          </button>
        </div>
        <button
          onClick={openAllocateForm}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Allocate Student
        </button>
      </div>

      {/* Allocations Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Student ID</th>
                <th className="px-4 py-3 text-left font-medium">Student Name</th>
                <th className="px-4 py-3 text-left font-medium">Hostel</th>
                <th className="px-4 py-3 text-left font-medium">Dormitory</th>
                <th className="px-4 py-3 text-left font-medium">Bed</th>
                <th className="px-4 py-3 text-left font-medium">Allocated</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No allocations found.
                  </td>
                </tr>
              ) : (
                allocations.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{a.studentNumber}</td>
                    <td className="px-4 py-3 font-medium">{a.studentName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.hostelName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.dormitoryName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.bedNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(a.allocatedAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.status === "ACTIVE" && (
                        <button
                          onClick={() => handleVacate(a.id, a.studentName)}
                          disabled={isPending}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Vacate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Allocate Student Modal ─────────────────────────────────── */}
      {showAllocateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Allocate Student to Bed</h3>
            <div className="space-y-4">
              {/* Student ID (manual entry) */}
              <div>
                <label className="block text-sm font-medium mb-1">Student ID</label>
                <input
                  type="text"
                  value={allocateForm.studentId}
                  onChange={(e) =>
                    setAllocateForm((p) => ({ ...p, studentId: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter student ID (boarding students only)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the student record ID. Only boarding students can be allocated.
                </p>
              </div>

              {/* Academic Year */}
              <div>
                <label className="block text-sm font-medium mb-1">Academic Year</label>
                <select
                  value={allocateForm.academicYearId}
                  onChange={(e) =>
                    setAllocateForm((p) => ({ ...p, academicYearId: e.target.value, termId: "" }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select academic year</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Term */}
              <div>
                <label className="block text-sm font-medium mb-1">Term</label>
                <select
                  value={allocateForm.termId}
                  onChange={(e) =>
                    setAllocateForm((p) => ({ ...p, termId: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select term</option>
                  {terms
                    .filter(
                      (t) =>
                        !allocateForm.academicYearId ||
                        t.academicYear.id === allocateForm.academicYearId,
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Hostel */}
              <div>
                <label className="block text-sm font-medium mb-1">Hostel</label>
                <select
                  value={allocateForm.hostelId}
                  onChange={(e) => handleHostelChange(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select hostel</option>
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.gender})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dormitory */}
              <div>
                <label className="block text-sm font-medium mb-1">Dormitory</label>
                <select
                  value={allocateForm.dormitoryId}
                  onChange={(e) => handleDormitoryChange(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={!allocateForm.hostelId}
                >
                  <option value="">Select dormitory</option>
                  {dormitories.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.beds.filter((b) => b.status === "AVAILABLE").length} available)
                    </option>
                  ))}
                </select>
              </div>

              {/* Bed */}
              <div>
                <label className="block text-sm font-medium mb-1">Bed</label>
                <select
                  value={allocateForm.bedId}
                  onChange={(e) => setAllocateForm((p) => ({ ...p, bedId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={!allocateForm.dormitoryId}
                >
                  <option value="">Select bed</option>
                  {availableBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bedNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAllocateForm(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAllocate}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Allocating..." : "Allocate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
