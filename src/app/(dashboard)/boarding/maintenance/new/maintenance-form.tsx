"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMaintenanceRequestAction } from "@/modules/boarding/actions/maintenance.action";
import {
  getDormitoriesAction,
  getBedsAction,
} from "@/modules/boarding/actions/hostel.action";

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

interface BedOption {
  id: string;
  bedNumber: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function MaintenanceForm({ hostels }: { hostels: HostelOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [dormitories, setDormitories] = useState<DormitoryOption[]>([]);
  const [beds, setBeds] = useState<BedOption[]>([]);
  const [loadingDorms, setLoadingDorms] = useState(false);
  const [loadingBeds, setLoadingBeds] = useState(false);

  const [form, setForm] = useState({
    hostelId: "",
    dormitoryId: "",
    bedId: "",
    title: "",
    description: "",
    category: "OTHER",
    priority: "MEDIUM",
  });

  // ─── Cascading Dormitory Fetch ──────────────────────────────────

  async function handleHostelChange(hostelId: string) {
    setForm((p) => ({ ...p, hostelId, dormitoryId: "", bedId: "" }));
    setDormitories([]);
    setBeds([]);

    if (!hostelId) return;

    setLoadingDorms(true);
    const result = await getDormitoriesAction(hostelId);
    if ("data" in result) {
      setDormitories(result.data);
    }
    setLoadingDorms(false);
  }

  // ─── Cascading Bed Fetch ────────────────────────────────────────

  async function handleDormitoryChange(dormitoryId: string) {
    setForm((p) => ({ ...p, dormitoryId, bedId: "" }));
    setBeds([]);

    if (!dormitoryId) return;

    setLoadingBeds(true);
    const result = await getBedsAction(dormitoryId);
    if ("data" in result) {
      setBeds(result.data);
    }
    setLoadingBeds(false);
  }

  // ─── Submit ─────────────────────────────────────────────────────

  function handleSubmit() {
    if (!form.hostelId) {
      toast.error("Hostel is required.");
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

    startTransition(async () => {
      const result = await createMaintenanceRequestAction({
        hostelId: form.hostelId,
        dormitoryId: form.dormitoryId || undefined,
        bedId: form.bedId || undefined,
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Maintenance request submitted successfully.");
        router.push("/boarding/maintenance");
        router.refresh();
      }
    });
  }

  const categoryOptions = [
    { value: "PLUMBING", label: "Plumbing" },
    { value: "ELECTRICAL", label: "Electrical" },
    { value: "FURNITURE", label: "Furniture" },
    { value: "STRUCTURAL", label: "Structural" },
    { value: "CLEANING", label: "Cleaning" },
    { value: "PEST_CONTROL", label: "Pest Control" },
    { value: "SECURITY", label: "Security" },
    { value: "OTHER", label: "Other" },
  ];

  const priorityOptions = [
    { value: "LOW", label: "Low", color: "border-gray-300 bg-gray-50 text-gray-700" },
    { value: "MEDIUM", label: "Medium", color: "border-blue-300 bg-blue-50 text-blue-700" },
    { value: "HIGH", label: "High", color: "border-orange-300 bg-orange-50 text-orange-700" },
    { value: "URGENT", label: "Urgent", color: "border-red-300 bg-red-50 text-red-700" },
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
            onChange={(e) => handleDormitoryChange(e.target.value)}
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

        {/* Bed */}
        <div>
          <label className="block text-sm font-medium mb-1">Bed (optional)</label>
          <select
            value={form.bedId}
            onChange={(e) => setForm((p) => ({ ...p, bedId: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={!form.dormitoryId || loadingBeds}
          >
            <option value="">
              {loadingBeds
                ? "Loading beds..."
                : !form.dormitoryId
                  ? "Select a dormitory first"
                  : "Select bed"}
            </option>
            {beds.map((b) => (
              <option key={b.id} value={b.id}>
                Bed {b.bedNumber}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Brief title for the issue"
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
            placeholder="Detailed description of the maintenance issue..."
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {categoryOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium mb-2">Priority</label>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
            {priorityOptions.map((opt) => (
              <label
                key={opt.value}
                className={`relative flex cursor-pointer rounded-lg border p-3 text-center ${
                  form.priority === opt.value
                    ? `${opt.color} border-2`
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  value={opt.value}
                  checked={form.priority === opt.value}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, priority: e.target.value }))
                  }
                  className="sr-only"
                />
                <span className="w-full text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <button
            onClick={() => router.push("/boarding/maintenance")}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
