"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertAlumniProfileAction } from "@/modules/graduation/actions/alumni.action";

type Row = {
  studentId: string;
  graduationYear: number;
  email: string | null;
  phone: string | null;
  address: string | null;
  currentEmployer: string | null;
  currentPosition: string | null;
  industry: string | null;
  highestEducation: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  isPublic: boolean;
};

export function AlumniEditModal({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    graduationYear: row.graduationYear,
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    currentEmployer: row.currentEmployer ?? "",
    currentPosition: row.currentPosition ?? "",
    industry: row.industry ?? "",
    highestEducation: row.highestEducation ?? "",
    linkedinUrl: row.linkedinUrl ?? "",
    bio: row.bio ?? "",
    isPublic: row.isPublic,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await upsertAlumniProfileAction({
        studentId: row.studentId,
        graduationYear: form.graduationYear,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        currentEmployer: form.currentEmployer || undefined,
        currentPosition: form.currentPosition || undefined,
        industry: form.industry || undefined,
        highestEducation: form.highestEducation || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
        bio: form.bio || undefined,
        isPublic: form.isPublic,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Profile updated.");
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
          <h2 className="text-lg font-semibold">Edit alumni profile</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Graduation year"
            value={String(form.graduationYear)}
            onChange={(v) => setForm({ ...form, graduationYear: Number(v) || form.graduationYear })}
            type="number"
          />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label="Current employer" value={form.currentEmployer} onChange={(v) => setForm({ ...form, currentEmployer: v })} />
          <Field label="Current position" value={form.currentPosition} onChange={(v) => setForm({ ...form, currentPosition: v })} />
          <Field label="Industry" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} />
          <Field label="Highest education" value={form.highestEducation} onChange={(v) => setForm({ ...form, highestEducation: v })} />
        </div>
        <Field label="LinkedIn URL" value={form.linkedinUrl} onChange={(v) => setForm({ ...form, linkedinUrl: v })} type="url" />

        <label className="block">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={4}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
          />
          <span>Public — visible to other alumni in the directory</span>
        </label>

        <div className="flex justify-end gap-2">
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
            {pending ? "Saving…" : "Save changes"}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
