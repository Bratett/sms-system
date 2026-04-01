"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMyStaffProfileAction, updateMyProfileAction } from "@/modules/hr/actions/self-service.action";

export default function StaffProfilePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ phone: "", address: "", region: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    startTransition(async () => {
      const res = await getMyStaffProfileAction();
      if ("data" in res && res.data) {
        const d = res.data;
        setProfile(d);
        setForm({
          phone: d.phone || "",
          address: d.address || "",
          region: d.region || "",
        });
      }
    });
  }, []);

  function handleSave() {
    startTransition(async () => {
      const res = await updateMyProfileAction(form);
      if ("error" in res) {
        setMessage(res.error as string);
      } else {
        setMessage("Profile updated successfully!");
        setIsEditing(false);
        router.refresh();
      }
    });
  }

  if (!profile) {
    return <div className="py-12 text-center text-gray-400">{isPending ? "Loading..." : "No profile found."}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">My Profile</h2>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="text-sm text-teal-600 font-medium hover:text-teal-800">Edit</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(false)} className="text-sm text-gray-500">Cancel</button>
            <button onClick={handleSave} disabled={isPending}
              className="rounded-md bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.includes("success") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      )}

      <div className="rounded-lg border bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Staff ID" value={profile.staffId} />
          <Field label="First Name" value={profile.firstName} />
          <Field label="Last Name" value={profile.lastName} />
          <Field label="Gender" value={profile.gender} />
          <Field label="Staff Type" value={profile.staffType.replace("_", " ")} />
          <Field label="Email" value={profile.email || "---"} />

          {isEditing ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Region</label>
                <input type="text" value={form.region} onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
                  className="w-full rounded-md border px-3 py-1.5 text-sm" />
              </div>
            </>
          ) : (
            <>
              <Field label="Phone" value={profile.phone} />
              <Field label="Address" value={profile.address || "---"} />
              <Field label="Region" value={profile.region || "---"} />
            </>
          )}

          <Field label="Ghana Card" value={profile.ghanaCardNumber || "---"} />
          <Field label="SSNIT No." value={profile.ssnitNumber || "---"} />
          <Field label="TIN No." value={profile.tinNumber || "---"} />
        </div>
      </div>

      {/* Current Employment */}
      {profile.employments?.[0] && (
        <div className="rounded-lg border bg-white p-6">
          <h3 className="font-semibold text-sm mb-3">Current Employment</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Position" value={profile.employments[0].position} />
            <Field label="Rank" value={profile.employments[0].rank || "---"} />
            <Field label="Department" value={profile.employments[0].departmentName || "---"} />
            <Field label="Appointment Type" value={profile.employments[0].appointmentType} />
            <Field label="Salary Grade" value={profile.employments[0].salaryGrade || "---"} />
            <Field label="Start Date" value={new Date(profile.employments[0].startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}
