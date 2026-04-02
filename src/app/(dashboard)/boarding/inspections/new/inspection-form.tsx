"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createInspectionAction } from "@/modules/boarding/actions/inspection.action";
import { getDormitoriesAction } from "@/modules/boarding/actions/hostel.action";

// ─── Types ──────────────────────────────────────────────────────────

interface HostelOption {
  id: string;
  name: string;
  gender: string;
}

interface DormitoryOption {
  id: string;
  name: string;
  floor: string | null;
}

// ─── Component ──────────────────────────────────────────────────────

export function InspectionForm({ hostels }: { hostels: HostelOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [dormitories, setDormitories] = useState<DormitoryOption[]>([]);
  const [loadingDorms, setLoadingDorms] = useState(false);

  const [form, setForm] = useState({
    hostelId: "",
    dormitoryId: "",
    inspectionDate: "",
    type: "ROUTINE",
    overallRating: "GOOD",
    cleanlinessRating: "GOOD",
    facilityRating: "GOOD",
    safetyRating: "GOOD",
    remarks: "",
    issues: "",
    followUpRequired: false,
  });

  // ─── Cascading Dormitory Fetch ──────────────────────────────────

  async function handleHostelChange(hostelId: string) {
    setForm((p) => ({ ...p, hostelId, dormitoryId: "" }));
    setDormitories([]);

    if (!hostelId) return;

    setLoadingDorms(true);
    const result = await getDormitoriesAction(hostelId);
    if ("data" in result) {
      setDormitories(result.data);
    }
    setLoadingDorms(false);
  }

  // ─── Submit ─────────────────────────────────────────────────────

  function handleSubmit() {
    if (!form.hostelId) {
      toast.error("Hostel is required.");
      return;
    }
    if (!form.inspectionDate) {
      toast.error("Inspection date is required.");
      return;
    }

    startTransition(async () => {
      const result = await createInspectionAction({
        hostelId: form.hostelId,
        dormitoryId: form.dormitoryId || undefined,
        inspectionDate: form.inspectionDate,
        type: form.type,
        overallRating: form.overallRating,
        cleanlinessRating: form.cleanlinessRating,
        facilityRating: form.facilityRating,
        safetyRating: form.safetyRating,
        remarks: form.remarks || undefined,
        issues: form.issues || undefined,
        followUpRequired: form.followUpRequired,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Inspection recorded successfully.");
        router.push("/boarding/inspections");
        router.refresh();
      }
    });
  }

  const typeOptions = [
    { value: "ROUTINE", label: "Routine" },
    { value: "SURPRISE", label: "Surprise" },
    { value: "FOLLOW_UP", label: "Follow Up" },
    { value: "END_OF_TERM", label: "End of Term" },
  ];

  const ratingOptions = [
    { value: "EXCELLENT", label: "Excellent" },
    { value: "GOOD", label: "Good" },
    { value: "FAIR", label: "Fair" },
    { value: "POOR", label: "Poor" },
    { value: "CRITICAL", label: "Critical" },
  ];

  return (
    <div className="max-w-2xl">
      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        {/* Hostel */}
        <div>
          <label className="block text-sm font-medium mb-1">Hostel</label>
          <select
            value={form.hostelId}
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
          <label className="block text-sm font-medium mb-1">Dormitory (optional)</label>
          <select
            value={form.dormitoryId}
            onChange={(e) => setForm((p) => ({ ...p, dormitoryId: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={!form.hostelId || loadingDorms}
          >
            <option value="">
              {loadingDorms
                ? "Loading dormitories..."
                : !form.hostelId
                  ? "Select a hostel first"
                  : "Select dormitory"}
            </option>
            {dormitories.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.floor ? ` (Floor ${d.floor})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Inspection Date */}
        <div>
          <label className="block text-sm font-medium mb-1">Inspection Date</label>
          <input
            type="date"
            value={form.inspectionDate}
            onChange={(e) => setForm((p) => ({ ...p, inspectionDate: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium mb-1">Inspection Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {typeOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Ratings */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Overall Rating</label>
            <select
              value={form.overallRating}
              onChange={(e) => setForm((p) => ({ ...p, overallRating: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ratingOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cleanliness Rating</label>
            <select
              value={form.cleanlinessRating}
              onChange={(e) => setForm((p) => ({ ...p, cleanlinessRating: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ratingOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Facility Rating</label>
            <select
              value={form.facilityRating}
              onChange={(e) => setForm((p) => ({ ...p, facilityRating: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ratingOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Safety Rating</label>
            <select
              value={form.safetyRating}
              onChange={(e) => setForm((p) => ({ ...p, safetyRating: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ratingOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-sm font-medium mb-1">Remarks</label>
          <textarea
            value={form.remarks}
            onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="General remarks about the inspection..."
          />
        </div>

        {/* Issues */}
        <div>
          <label className="block text-sm font-medium mb-1">Issues Found</label>
          <textarea
            value={form.issues}
            onChange={(e) => setForm((p) => ({ ...p, issues: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="List any issues discovered during the inspection..."
          />
        </div>

        {/* Follow-up Required */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="followUpRequired"
            checked={form.followUpRequired}
            onChange={(e) => setForm((p) => ({ ...p, followUpRequired: e.target.checked }))}
            className="h-4 w-4 rounded border-input"
          />
          <label htmlFor="followUpRequired" className="text-sm font-medium">
            Follow-up required
          </label>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <button
            onClick={() => router.push("/boarding/inspections")}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Submitting..." : "Record Inspection"}
          </button>
        </div>
      </div>
    </div>
  );
}
