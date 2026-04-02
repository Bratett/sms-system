"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reportIncidentAction } from "@/modules/boarding/actions/incident.action";
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

export function IncidentForm({ hostels }: { hostels: HostelOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [dormitories, setDormitories] = useState<DormitoryOption[]>([]);
  const [loadingDorms, setLoadingDorms] = useState(false);

  const [form, setForm] = useState({
    hostelId: "",
    dormitoryId: "",
    studentIds: "",
    date: "",
    time: "",
    category: "OTHER",
    severity: "MINOR",
    title: "",
    description: "",
  });

  // ─── Cascading Dormitory Fetch ──────────────────────────────────

  async function handleHostelChange(hostelId: string) {
    setForm((p) => ({ ...p, hostelId, dormitoryId: "" }));
    setDormitories([]);

    if (!hostelId) return;

    setLoadingDorms(true);
    const result = await getDormitoriesAction(hostelId);
    if (result.data) {
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
    if (!form.studentIds.trim()) {
      toast.error("At least one student ID is required.");
      return;
    }
    if (!form.date) {
      toast.error("Date is required.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Description is required.");
      return;
    }

    const studentIds = form.studentIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (studentIds.length === 0) {
      toast.error("At least one valid student ID is required.");
      return;
    }

    startTransition(async () => {
      const result = await reportIncidentAction({
        hostelId: form.hostelId,
        dormitoryId: form.dormitoryId || undefined,
        studentIds,
        date: form.date,
        time: form.time || undefined,
        category: form.category,
        severity: form.severity,
        title: form.title,
        description: form.description,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Incident reported successfully.");
        router.push("/boarding/incidents");
        router.refresh();
      }
    });
  }

  const categories = [
    { value: "CURFEW_VIOLATION", label: "Curfew Violation" },
    { value: "PROPERTY_DAMAGE", label: "Property Damage" },
    { value: "BULLYING", label: "Bullying" },
    { value: "FIGHTING", label: "Fighting" },
    { value: "UNAUTHORIZED_ABSENCE", label: "Unauthorized Absence" },
    { value: "SUBSTANCE_ABUSE", label: "Substance Abuse" },
    { value: "THEFT", label: "Theft" },
    { value: "NOISE_DISTURBANCE", label: "Noise Disturbance" },
    { value: "HEALTH_EMERGENCY", label: "Health Emergency" },
    { value: "SAFETY_HAZARD", label: "Safety Hazard" },
    { value: "OTHER", label: "Other" },
  ];

  const severityOptions = [
    { value: "MINOR", label: "Minor", color: "border-gray-300 bg-gray-50 text-gray-700" },
    { value: "MODERATE", label: "Moderate", color: "border-yellow-300 bg-yellow-50 text-yellow-700" },
    { value: "MAJOR", label: "Major", color: "border-orange-300 bg-orange-50 text-orange-700" },
    { value: "CRITICAL", label: "Critical", color: "border-red-300 bg-red-50 text-red-700" },
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

        {/* Student IDs */}
        <div>
          <label className="block text-sm font-medium mb-1">Student IDs</label>
          <input
            type="text"
            value={form.studentIds}
            onChange={(e) => setForm((p) => ({ ...p, studentIds: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Enter student record IDs, separated by commas"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Comma-separated list of student record IDs involved in the incident.
          </p>
        </div>

        {/* Date and Time */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Time (optional)</label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div>
          <label className="block text-sm font-medium mb-2">Severity</label>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
            {severityOptions.map((opt) => (
              <label
                key={opt.value}
                className={`relative flex cursor-pointer rounded-lg border p-3 text-center ${
                  form.severity === opt.value
                    ? `${opt.color} border-2`
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="severity"
                  value={opt.value}
                  checked={form.severity === opt.value}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, severity: e.target.value }))
                  }
                  className="sr-only"
                />
                <span className="w-full text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Brief title for the incident"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={4}
            placeholder="Detailed description of the incident..."
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <button
            onClick={() => router.push("/boarding/incidents")}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Submitting..." : "Report Incident"}
          </button>
        </div>
      </div>
    </div>
  );
}
