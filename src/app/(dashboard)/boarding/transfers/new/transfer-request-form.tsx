"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestTransferAction } from "@/modules/boarding/actions/transfer.action";
import { getHostelAction } from "@/modules/boarding/actions/hostel.action";

// ─── Types ──────────────────────────────────────────────────────────

interface HostelOption {
  id: string;
  name: string;
  gender: string;
}

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

interface DormOption {
  id: string;
  name: string;
  beds: Array<{ id: string; bedNumber: string; status: string }>;
}

const TRANSFER_REASONS = [
  { value: "STUDENT_REQUEST", label: "Student Request" },
  { value: "DISCIPLINARY", label: "Disciplinary" },
  { value: "MEDICAL", label: "Medical" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "CONFLICT_RESOLUTION", label: "Conflict Resolution" },
  { value: "REBALANCING", label: "Rebalancing" },
  { value: "OTHER", label: "Other" },
];

// ─── Component ──────────────────────────────────────────────────────

export function TransferRequestForm({
  hostels,
  allocations,
}: {
  hostels: HostelOption[];
  allocations: AllocationRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [studentId, setStudentId] = useState("");
  const [destHostelId, setDestHostelId] = useState("");
  const [destDormitoryId, setDestDormitoryId] = useState("");
  const [destBedId, setDestBedId] = useState("");
  const [reason, setReason] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  // Cascading data
  const [dormitories, setDormitories] = useState<DormOption[]>([]);
  const [availableBeds, setAvailableBeds] = useState<Array<{ id: string; bedNumber: string }>>([]);

  // Find the selected student's current allocation
  const selectedAllocation = allocations.find((a) => a.studentId === studentId);

  // ─── Cascading Selects ─────────────────────────────────────────────

  function handleDestHostelChange(hostelId: string) {
    setDestHostelId(hostelId);
    setDestDormitoryId("");
    setDestBedId("");
    setAvailableBeds([]);

    if (!hostelId) {
      setDormitories([]);
      return;
    }

    startTransition(async () => {
      const result = await getHostelAction(hostelId);
      if (result.data) {
        setDormitories(
          result.data.dormitories.map((d: { id: string; name: string; beds: Array<{ id: string; bedNumber: string; status: string }> }) => ({
            id: d.id,
            name: d.name,
            beds: d.beds.map((b: { id: string; bedNumber: string; status: string }) => ({
              id: b.id,
              bedNumber: b.bedNumber,
              status: b.status,
            })),
          })),
        );
      }
    });
  }

  function handleDestDormitoryChange(dormId: string) {
    setDestDormitoryId(dormId);
    setDestBedId("");
    const dorm = dormitories.find((d) => d.id === dormId);
    if (dorm) {
      setAvailableBeds(dorm.beds.filter((b) => b.status === "AVAILABLE"));
    } else {
      setAvailableBeds([]);
    }
  }

  // ─── Submit ────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!studentId || !destBedId || !reason) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (!selectedAllocation) {
      toast.error("Could not find current allocation for selected student.");
      return;
    }

    startTransition(async () => {
      const result = await requestTransferAction({
        studentId,
        fromBedId: selectedAllocation.bedId,
        toBedId: destBedId,
        reason,
        reasonDetails: reasonDetails || undefined,
        effectiveDate: effectiveDate || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Transfer request created successfully.");
        router.push("/boarding/transfers");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Student Select */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Student <span className="text-red-500">*</span>
          </label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a student with active allocation...</option>
            {allocations.map((a) => (
              <option key={a.studentId} value={a.studentId}>
                {a.studentName} ({a.studentNumber})
              </option>
            ))}
          </select>
        </div>

        {/* Current Bed Info */}
        {selectedAllocation && (
          <div className="rounded-md border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium mb-2">Current Bed Assignment</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Hostel</p>
                <p className="font-medium">{selectedAllocation.hostelName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dormitory</p>
                <p className="font-medium">{selectedAllocation.dormitoryName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bed</p>
                <p className="font-medium">{selectedAllocation.bedNumber}</p>
              </div>
            </div>
          </div>
        )}

        {/* Destination Hostel */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Destination Hostel <span className="text-red-500">*</span>
          </label>
          <select
            value={destHostelId}
            onChange={(e) => handleDestHostelChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select hostel...</option>
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.gender})
              </option>
            ))}
          </select>
        </div>

        {/* Destination Dormitory */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Destination Dormitory <span className="text-red-500">*</span>
          </label>
          <select
            value={destDormitoryId}
            onChange={(e) => handleDestDormitoryChange(e.target.value)}
            disabled={!destHostelId}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Select dormitory...</option>
            {dormitories.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Destination Bed */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Destination Bed <span className="text-red-500">*</span>
          </label>
          <select
            value={destBedId}
            onChange={(e) => setDestBedId(e.target.value)}
            disabled={!destDormitoryId}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Select bed...</option>
            {availableBeds.map((b) => (
              <option key={b.id} value={b.id}>
                Bed {b.bedNumber}
              </option>
            ))}
          </select>
          {destDormitoryId && availableBeds.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              No available beds in this dormitory.
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select reason...</option>
            {TRANSFER_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reason Details */}
        <div>
          <label className="block text-sm font-medium mb-1">Reason Details</label>
          <textarea
            value={reasonDetails}
            onChange={(e) => setReasonDetails(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="Additional details about the transfer reason..."
          />
        </div>

        {/* Effective Date */}
        <div>
          <label className="block text-sm font-medium mb-1">Effective Date</label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave blank for immediate transfer upon execution.
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push("/boarding/transfers")}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Submitting..." : "Submit Transfer Request"}
          </button>
        </div>
      </form>
    </div>
  );
}
