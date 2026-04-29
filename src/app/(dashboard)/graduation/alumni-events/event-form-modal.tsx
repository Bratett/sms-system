"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createAlumniEventDraftAction,
  updateAlumniEventAction,
} from "@/modules/alumni-events/actions/admin-events.action";

type EventValues = {
  id?: string;
  title: string;
  description: string;
  startAt: string;  // ISO local datetime
  endAt: string;
  location: string;
  virtualLink: string;
  capacity: string;
  maxGuestsPerRsvp: number;
  rsvpDeadline: string;
};

const blankValues: EventValues = {
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  location: "",
  virtualLink: "",
  capacity: "",
  maxGuestsPerRsvp: 0,
  rsvpDeadline: "",
};

export function EventFormModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: Partial<EventValues>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState<EventValues>({ ...blankValues, ...initial });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        startAt: new Date(form.startAt),
        endAt: form.endAt ? new Date(form.endAt) : null,
        location: form.location || null,
        virtualLink: form.virtualLink || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        maxGuestsPerRsvp: form.maxGuestsPerRsvp,
        rsvpDeadline: form.rsvpDeadline ? new Date(form.rsvpDeadline) : null,
      };

      const res =
        mode === "create"
          ? await createAlumniEventDraftAction(payload)
          : await updateAlumniEventAction(form.id!, payload);

      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(mode === "create" ? "Draft created." : "Event updated.");
      onSaved();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl bg-card p-6 space-y-3 max-h-[85vh] overflow-auto"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "New alumni event" : "Edit alumni event"}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground">
            ✕
          </button>
        </div>

        <Field
          label="Title *"
          value={form.title}
          onChange={(v) => setForm({ ...form, title: v })}
        />

        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            maxLength={5000}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Start *"
            type="datetime-local"
            value={form.startAt}
            onChange={(v) => setForm({ ...form, startAt: v })}
          />
          <Field
            label="End (optional)"
            type="datetime-local"
            value={form.endAt}
            onChange={(v) => setForm({ ...form, endAt: v })}
          />
        </div>

        <Field
          label="Location"
          value={form.location}
          onChange={(v) => setForm({ ...form, location: v })}
        />
        <Field
          label="Virtual link"
          type="url"
          value={form.virtualLink}
          onChange={(v) => setForm({ ...form, virtualLink: v })}
          placeholder="https://..."
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Capacity"
            type="number"
            value={form.capacity}
            onChange={(v) => setForm({ ...form, capacity: v })}
            placeholder="Leave blank for unlimited"
          />
          <label className="block">
            <span className="text-sm font-medium">Max guests per RSVP</span>
            <input
              type="number"
              min={0}
              value={form.maxGuestsPerRsvp}
              onChange={(e) =>
                setForm({ ...form, maxGuestsPerRsvp: Number(e.target.value) || 0 })
              }
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <Field
          label="RSVP deadline"
          type="datetime-local"
          value={form.rsvpDeadline}
          onChange={(v) => setForm({ ...form, rsvpDeadline: v })}
        />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
          >
            {pending ? "Saving…" : mode === "create" ? "Create draft" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
