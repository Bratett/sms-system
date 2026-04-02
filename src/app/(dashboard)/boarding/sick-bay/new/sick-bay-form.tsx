"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { admitToSickBayAction } from "@/modules/boarding/actions/sick-bay.action";

// ─── Types ──────────────────────────────────────────────────────────

interface HostelOption {
  id: string;
  name: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function SickBayForm({ hostels }: { hostels: HostelOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    studentId: "",
    hostelId: "",
    symptoms: "",
    initialDiagnosis: "",
    temperature: "",
    severity: "MILD" as "MILD" | "MODERATE" | "SEVERE" | "EMERGENCY",
  });

  function handleSubmit() {
    if (!form.studentId.trim()) {
      toast.error("Student ID is required.");
      return;
    }
    if (!form.hostelId) {
      toast.error("Hostel is required.");
      return;
    }
    if (!form.symptoms.trim()) {
      toast.error("Symptoms are required.");
      return;
    }

    const temperature = form.temperature ? parseFloat(form.temperature) : undefined;
    if (temperature !== undefined && (temperature < 30 || temperature > 45)) {
      toast.error("Temperature must be between 30 and 45 degrees.");
      return;
    }

    startTransition(async () => {
      const result = await admitToSickBayAction({
        studentId: form.studentId,
        hostelId: form.hostelId,
        symptoms: form.symptoms,
        initialDiagnosis: form.initialDiagnosis || undefined,
        temperature,
        severity: form.severity,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Student admitted to sick bay.");
        router.push("/boarding/sick-bay");
        router.refresh();
      }
    });
  }

  const severityOptions = [
    { value: "MILD", label: "Mild", color: "border-green-400 bg-green-50 text-green-700" },
    { value: "MODERATE", label: "Moderate", color: "border-yellow-400 bg-yellow-50 text-yellow-700" },
    { value: "SEVERE", label: "Severe", color: "border-orange-400 bg-orange-50 text-orange-700" },
    { value: "EMERGENCY", label: "Emergency", color: "border-red-400 bg-red-50 text-red-700" },
  ] as const;

  return (
    <div className="max-w-2xl">
      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        {/* Student ID */}
        <div>
          <label className="block text-sm font-medium mb-1">Student ID</label>
          <input
            type="text"
            value={form.studentId}
            onChange={(e) => setForm((p) => ({ ...p, studentId: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Enter student record ID"
          />
          <p className="text-xs text-muted-foreground mt-1">
            The student record ID for the boarding student.
          </p>
        </div>

        {/* Hostel */}
        <div>
          <label className="block text-sm font-medium mb-1">Hostel</label>
          <select
            value={form.hostelId}
            onChange={(e) => setForm((p) => ({ ...p, hostelId: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select hostel</option>
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        {/* Symptoms */}
        <div>
          <label className="block text-sm font-medium mb-1">Symptoms</label>
          <textarea
            value={form.symptoms}
            onChange={(e) => setForm((p) => ({ ...p, symptoms: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="Describe the symptoms..."
          />
        </div>

        {/* Initial Diagnosis */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Initial Diagnosis <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="text"
            value={form.initialDiagnosis}
            onChange={(e) => setForm((p) => ({ ...p, initialDiagnosis: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Preliminary diagnosis..."
          />
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Temperature (C) <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="number"
            value={form.temperature}
            onChange={(e) => setForm((p) => ({ ...p, temperature: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="e.g. 37.5"
            min={30}
            max={45}
            step={0.1}
          />
        </div>

        {/* Severity */}
        <div>
          <label className="block text-sm font-medium mb-2">Severity</label>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
            {severityOptions.map((opt) => (
              <label
                key={opt.value}
                className={`relative flex cursor-pointer items-center justify-center rounded-lg border-2 p-3 ${
                  form.severity === opt.value
                    ? opt.color
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="severity"
                  value={opt.value}
                  checked={form.severity === opt.value}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      severity: e.target.value as typeof form.severity,
                    }))
                  }
                  className="sr-only"
                />
                <span className="text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <button
            onClick={() => router.push("/boarding/sick-bay")}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Admitting..." : "Admit to Sick Bay"}
          </button>
        </div>
      </div>
    </div>
  );
}
