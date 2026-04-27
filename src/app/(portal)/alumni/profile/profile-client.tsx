"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateMyAlumniProfileAction } from "@/modules/alumni/actions/alumni-self.action";

type ProfileShape = {
  id: string;
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
  student: {
    firstName: string;
    lastName: string;
    studentId: string;
    photoUrl: string | null;
  };
  graduation: {
    certificateNumber: string | null;
    honours: string | null;
    batchName: string;
    ceremonyDate: Date | string | null;
  } | null;
};

export function ProfileClient({ profile }: { profile: ProfileShape }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    currentEmployer: profile.currentEmployer ?? "",
    currentPosition: profile.currentPosition ?? "",
    industry: profile.industry ?? "",
    highestEducation: profile.highestEducation ?? "",
    linkedinUrl: profile.linkedinUrl ?? "",
    bio: profile.bio ?? "",
    isPublic: profile.isPublic,
  });

  const fullName = `${profile.student.firstName} ${profile.student.lastName}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateMyAlumniProfileAction({
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        currentEmployer: form.currentEmployer || null,
        currentPosition: form.currentPosition || null,
        industry: form.industry || null,
        highestEducation: form.highestEducation || null,
        linkedinUrl: form.linkedinUrl,
        bio: form.bio || null,
        isPublic: form.isPublic,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Profile updated.");
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Read-only header */}
      <header className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          {profile.student.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.student.photoUrl}
              alt={fullName}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center text-lg font-semibold text-gray-600">
              {profile.student.firstName.charAt(0)}
              {profile.student.lastName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{fullName}</h1>
            <p className="text-sm text-gray-500">
              Class of {profile.graduationYear} · Student ID {profile.student.studentId}
            </p>
            {profile.graduation && (
              <p className="text-xs text-gray-400 mt-1">
                {profile.graduation.batchName}
                {profile.graduation.certificateNumber
                  ? ` · Cert #${profile.graduation.certificateNumber}`
                  : ""}
                {profile.graduation.honours ? ` · ${profile.graduation.honours}` : ""}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Edit form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-200 bg-white p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold text-gray-900">Edit profile</h2>

        <Field
          label="Email"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
          type="email"
        />
        <Field
          label="Phone"
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
        />
        <Field
          label="Address"
          value={form.address}
          onChange={(v) => setForm({ ...form, address: v })}
        />
        <Field
          label="Current employer"
          value={form.currentEmployer}
          onChange={(v) => setForm({ ...form, currentEmployer: v })}
        />
        <Field
          label="Current position"
          value={form.currentPosition}
          onChange={(v) => setForm({ ...form, currentPosition: v })}
        />
        <Field
          label="Industry"
          value={form.industry}
          onChange={(v) => setForm({ ...form, industry: v })}
        />
        <Field
          label="Highest education"
          value={form.highestEducation}
          onChange={(v) => setForm({ ...form, highestEducation: v })}
        />
        <Field
          label="LinkedIn URL"
          value={form.linkedinUrl}
          onChange={(v) => setForm({ ...form, linkedinUrl: v })}
          type="url"
          placeholder="https://www.linkedin.com/in/..."
        />

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Bio</span>
          <textarea
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            rows={4}
            maxLength={2000}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
            className="rounded border-gray-300"
          />
          <span>Make my profile visible to other alumni from this school</span>
        </label>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm hover:bg-teal-700 disabled:opacity-50"
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
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
    </label>
  );
}
