"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { checkInVisitorAction } from "@/modules/boarding/actions/visitor.action";

// ─── Types ──────────────────────────────────────────────────────────

interface HostelOption {
  id: string;
  name: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function VisitorCheckInForm({ hostels }: { hostels: HostelOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    studentId: "",
    hostelId: "",
    visitorName: "",
    relationship: "",
    visitorPhone: "",
    visitorIdNumber: "",
    purpose: "",
    notes: "",
  });

  function handleSubmit() {
    if (!form.studentId.trim()) {
      toast.error("Student ID is required.");
      return;
    }
    if (!form.hostelId) {
      toast.error("Please select a hostel.");
      return;
    }
    if (!form.visitorName.trim()) {
      toast.error("Visitor name is required.");
      return;
    }
    if (!form.relationship) {
      toast.error("Relationship is required.");
      return;
    }
    if (!form.visitorPhone.trim()) {
      toast.error("Phone number is required.");
      return;
    }
    if (!form.purpose.trim()) {
      toast.error("Purpose of visit is required.");
      return;
    }

    startTransition(async () => {
      const result = await checkInVisitorAction({
        studentId: form.studentId,
        hostelId: form.hostelId,
        visitorName: form.visitorName,
        relationship: form.relationship,
        visitorPhone: form.visitorPhone,
        visitorIdNumber: form.visitorIdNumber || undefined,
        purpose: form.purpose,
        notes: form.notes || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Visitor checked in successfully.");
        router.push("/boarding/visitors");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6">
      <div className="space-y-4">
        {/* Student ID */}
        <div>
          <label className="block text-sm font-medium mb-1">Student ID</label>
          <input
            type="text"
            value={form.studentId}
            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Enter student ID"
          />
        </div>

        {/* Hostel */}
        <div>
          <label className="block text-sm font-medium mb-1">Hostel</label>
          <select
            value={form.hostelId}
            onChange={(e) => setForm({ ...form, hostelId: e.target.value })}
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

        {/* Visitor Name */}
        <div>
          <label className="block text-sm font-medium mb-1">Visitor Name</label>
          <input
            type="text"
            value={form.visitorName}
            onChange={(e) => setForm({ ...form, visitorName: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Full name of visitor"
          />
        </div>

        {/* Relationship */}
        <div>
          <label className="block text-sm font-medium mb-1">Relationship</label>
          <select
            value={form.relationship}
            onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select relationship</option>
            <option value="Parent">Parent</option>
            <option value="Guardian">Guardian</option>
            <option value="Sibling">Sibling</option>
            <option value="Spouse">Spouse</option>
            <option value="Uncle">Uncle</option>
            <option value="Aunt">Aunt</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium mb-1">Phone Number</label>
          <input
            type="tel"
            value={form.visitorPhone}
            onChange={(e) => setForm({ ...form, visitorPhone: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Visitor phone number"
          />
        </div>

        {/* ID Number (optional) */}
        <div>
          <label className="block text-sm font-medium mb-1">
            ID Number <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="text"
            value={form.visitorIdNumber}
            onChange={(e) => setForm({ ...form, visitorIdNumber: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="National ID or passport number"
          />
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-sm font-medium mb-1">Purpose of Visit</label>
          <textarea
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="Reason for visiting..."
          />
        </div>

        {/* Notes (optional) */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Notes <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={2}
            placeholder="Additional notes..."
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={() => router.push("/boarding/visitors")}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Checking In..." : "Check In Visitor"}
          </button>
        </div>
      </div>
    </div>
  );
}
