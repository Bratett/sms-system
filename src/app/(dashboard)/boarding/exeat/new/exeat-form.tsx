"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestExeatAction } from "@/modules/boarding/actions/exeat.action";

// ─── Types ──────────────────────────────────────────────────────────

interface TermOption {
  id: string;
  name: string;
  academicYear: { id: string; name: string };
}

// ─── Component ──────────────────────────────────────────────────────

export function ExeatForm({ terms }: { terms: TermOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    studentId: "",
    termId: "",
    type: "NORMAL" as "NORMAL" | "EMERGENCY" | "MEDICAL" | "WEEKEND" | "VACATION",
    reason: "",
    departureDate: "",
    departureTime: "",
    expectedReturnDate: "",
    guardianName: "",
    guardianPhone: "",
  });

  function handleSubmit() {
    if (!form.studentId.trim()) {
      toast.error("Student ID is required.");
      return;
    }
    if (!form.termId) {
      toast.error("Term is required.");
      return;
    }
    if (!form.reason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    if (!form.departureDate) {
      toast.error("Departure date is required.");
      return;
    }
    if (!form.expectedReturnDate) {
      toast.error("Expected return date is required.");
      return;
    }

    startTransition(async () => {
      const result = await requestExeatAction({
        studentId: form.studentId,
        termId: form.termId,
        type: form.type,
        reason: form.reason,
        departureDate: form.departureDate,
        departureTime: form.departureTime || undefined,
        expectedReturnDate: form.expectedReturnDate,
        guardianName: form.guardianName || undefined,
        guardianPhone: form.guardianPhone || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Exeat request created successfully.");
        router.push("/boarding/exeat");
        router.refresh();
      }
    });
  }

  const exeatTypes = [
    { value: "NORMAL", label: "Normal", description: "Regular leave request" },
    { value: "EMERGENCY", label: "Emergency", description: "Urgent - skips housemaster approval" },
    { value: "MEDICAL", label: "Medical", description: "Medical appointment or health issue" },
    { value: "WEEKEND", label: "Weekend", description: "Weekend leave" },
    { value: "VACATION", label: "Vacation", description: "Extended vacation leave" },
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
            placeholder="Enter student record ID (boarding students only)"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Only boarding students can request exeats.
          </p>
        </div>

        {/* Term */}
        <div>
          <label className="block text-sm font-medium mb-1">Term</label>
          <select
            value={form.termId}
            onChange={(e) => setForm((p) => ({ ...p, termId: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select term</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.academicYear.name})
              </option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium mb-2">Exeat Type</label>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {exeatTypes.map((type) => (
              <label
                key={type.value}
                className={`relative flex cursor-pointer rounded-lg border p-3 ${
                  form.type === type.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="exeatType"
                  value={type.value}
                  checked={form.type === type.value}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      type: e.target.value as typeof form.type,
                    }))
                  }
                  className="sr-only"
                />
                <div>
                  <p className="text-sm font-medium">{type.label}</p>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium mb-1">Reason</label>
          <textarea
            value={form.reason}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="Reason for the exeat request..."
          />
        </div>

        {/* Dates */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Departure Date</label>
            <input
              type="date"
              value={form.departureDate}
              onChange={(e) => setForm((p) => ({ ...p, departureDate: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Departure Time (optional)</label>
            <input
              type="time"
              value={form.departureTime}
              onChange={(e) => setForm((p) => ({ ...p, departureTime: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Expected Return Date</label>
          <input
            type="date"
            value={form.expectedReturnDate}
            onChange={(e) => setForm((p) => ({ ...p, expectedReturnDate: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Guardian Info */}
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-medium mb-3">Guardian Information (optional)</h4>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Guardian Name</label>
              <input
                type="text"
                value={form.guardianName}
                onChange={(e) => setForm((p) => ({ ...p, guardianName: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Name of guardian"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Guardian Phone</label>
              <input
                type="tel"
                value={form.guardianPhone}
                onChange={(e) => setForm((p) => ({ ...p, guardianPhone: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Phone number"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <button
            onClick={() => router.push("/boarding/exeat")}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Submitting..." : "Submit Exeat Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
