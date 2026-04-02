"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GHANA_REGIONS } from "@/lib/constants";
import { createStaffAction } from "@/modules/hr/actions/staff.action";

// ─── Types ──────────────────────────────────────────────────────────

interface DepartmentOption {
  id: string;
  name: string;
}

interface Qualification {
  degree: string;
  institution: string;
  year: string;
}

interface FormData {
  // Personal
  firstName: string;
  lastName: string;
  otherNames: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  region: string;
  ghanaCardNumber: string;
  ssnitNumber: string;
  tinNumber: string;
  // Professional
  staffType: string;
  specialization: string;
  dateOfFirstAppointment: string;
  dateOfPostingToSchool: string;
  // Employment
  position: string;
  rank: string;
  departmentId: string;
  appointmentType: string;
  salaryGrade: string;
  startDate: string;
  // Account
  createUserAccount: boolean;
}

// ─── Component ──────────────────────────────────────────────────────

export function StaffForm({
  departments,
}: {
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeSection, setActiveSection] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    otherNames: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    region: "",
    ghanaCardNumber: "",
    ssnitNumber: "",
    tinNumber: "",
    staffType: "TEACHING",
    specialization: "",
    dateOfFirstAppointment: "",
    dateOfPostingToSchool: "",
    position: "",
    rank: "",
    departmentId: "",
    appointmentType: "PERMANENT",
    salaryGrade: "",
    startDate: "",
    createUserAccount: false,
  });

  const [qualifications, setQualifications] = useState<Qualification[]>([
    { degree: "", institution: "", year: "" },
  ]);

  const sections = [
    { title: "Personal Information", index: 0 },
    { title: "Professional Details", index: 1 },
    { title: "Employment", index: 2 },
  ];

  function updateField(field: keyof FormData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function addQualification() {
    setQualifications((prev) => [...prev, { degree: "", institution: "", year: "" }]);
  }

  function removeQualification(index: number) {
    setQualifications((prev) => prev.filter((_, i) => i !== index));
  }

  function updateQualification(index: number, field: keyof Qualification, value: string) {
    setQualifications((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    );
  }

  function handleNext() {
    if (activeSection === 0) {
      if (!formData.firstName.trim()) {
        setFormError("First name is required.");
        return;
      }
      if (!formData.lastName.trim()) {
        setFormError("Last name is required.");
        return;
      }
      if (!formData.gender) {
        setFormError("Gender is required.");
        return;
      }
      if (!formData.phone.trim()) {
        setFormError("Phone number is required.");
        return;
      }
    }
    if (activeSection === 1) {
      if (!formData.staffType) {
        setFormError("Staff type is required.");
        return;
      }
    }
    setFormError(null);
    setActiveSection((prev) => Math.min(prev + 1, 2));
  }

  function handleBack() {
    setFormError(null);
    setActiveSection((prev) => Math.max(prev - 1, 0));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Final validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setFormError("First name and last name are required.");
      setActiveSection(0);
      return;
    }
    if (!formData.gender) {
      setFormError("Gender is required.");
      setActiveSection(0);
      return;
    }
    if (!formData.phone.trim()) {
      setFormError("Phone number is required.");
      setActiveSection(0);
      return;
    }
    if (!formData.position.trim()) {
      setFormError("Position is required.");
      setActiveSection(2);
      return;
    }
    if (!formData.startDate) {
      setFormError("Start date is required.");
      setActiveSection(2);
      return;
    }

    const validQualifications = qualifications.filter(
      (q) => q.degree.trim() && q.institution.trim(),
    );

    startTransition(async () => {
      const result = await createStaffAction({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        otherNames: formData.otherNames.trim() || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender as "MALE" | "FEMALE",
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        region: formData.region || undefined,
        ghanaCardNumber: formData.ghanaCardNumber.trim() || undefined,
        ssnitNumber: formData.ssnitNumber.trim() || undefined,
        tinNumber: formData.tinNumber.trim() || undefined,
        staffType: formData.staffType as "TEACHING" | "NON_TEACHING",
        specialization: formData.specialization.trim() || undefined,
        qualifications: validQualifications.length > 0 ? validQualifications : undefined,
        dateOfFirstAppointment: formData.dateOfFirstAppointment || undefined,
        dateOfPostingToSchool: formData.dateOfPostingToSchool || undefined,
        position: formData.position.trim(),
        rank: formData.rank.trim() || undefined,
        departmentId: formData.departmentId || undefined,
        appointmentType: formData.appointmentType as
          | "PERMANENT"
          | "CONTRACT"
          | "NATIONAL_SERVICE"
          | "VOLUNTEER",
        salaryGrade: formData.salaryGrade || undefined,
        startDate: formData.startDate,
        createUserAccount: formData.createUserAccount,
      });

      if ("error" in result) {
        setFormError(result.error ?? null);
      } else if ("data" in result && result.data) {
        toast.success(
          `Staff "${result.data.firstName} ${result.data.lastName}" registered successfully.`,
        );
        router.push(`/hr/staff/${result.data.id}`);
      }
    });
  }

  return (
    <div className="max-w-3xl">
      {/* Section Tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-border">
        {sections.map((section) => (
          <button
            key={section.index}
            type="button"
            onClick={() => setActiveSection(section.index)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeSection === section.index
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {section.index + 1}
            </span>
            {section.title}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {formError && (
          <div className="mb-4 rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
            {formError}
          </div>
        )}

        {/* Section 1: Personal Information */}
        {activeSection === 0 && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Kwame"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Mensah"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Other Names</label>
              <input
                type="text"
                value={formData.otherNames}
                onChange={(e) => updateField("otherNames", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Middle names"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => updateField("dateOfBirth", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => updateField("gender", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. 0244123456"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. kwame@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Residential address"
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Region</label>
                <select
                  value={formData.region}
                  onChange={(e) => updateField("region", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select region</option>
                  {GHANA_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ghana Card Number</label>
                <input
                  type="text"
                  value={formData.ghanaCardNumber}
                  onChange={(e) => updateField("ghanaCardNumber", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="GHA-XXXXXXXXX-X"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">SSNIT Number</label>
                <input
                  type="text"
                  value={formData.ssnitNumber}
                  onChange={(e) => updateField("ssnitNumber", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="SSNIT number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">TIN Number</label>
                <input
                  type="text"
                  value={formData.tinNumber}
                  onChange={(e) => updateField("tinNumber", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Tax identification number"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Professional Details */}
        {activeSection === 1 && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Staff Type <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="staffType"
                    value="TEACHING"
                    checked={formData.staffType === "TEACHING"}
                    onChange={(e) => updateField("staffType", e.target.value)}
                    className="accent-primary"
                  />
                  Teaching
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="staffType"
                    value="NON_TEACHING"
                    checked={formData.staffType === "NON_TEACHING"}
                    onChange={(e) => updateField("staffType", e.target.value)}
                    className="accent-primary"
                  />
                  Non-Teaching
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Specialization</label>
              <input
                type="text"
                value={formData.specialization}
                onChange={(e) => updateField("specialization", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. Mathematics, Science, Administration"
              />
            </div>

            {/* Qualifications */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Qualifications</label>
                <button
                  type="button"
                  onClick={addQualification}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                >
                  + Add Qualification
                </button>
              </div>
              <div className="space-y-3">
                {qualifications.map((q, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex-1 grid gap-2 md:grid-cols-3">
                      <input
                        type="text"
                        value={q.degree}
                        onChange={(e) => updateQualification(index, "degree", e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Degree (e.g. B.Ed)"
                      />
                      <input
                        type="text"
                        value={q.institution}
                        onChange={(e) =>
                          updateQualification(index, "institution", e.target.value)
                        }
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Institution"
                      />
                      <input
                        type="text"
                        value={q.year}
                        onChange={(e) => updateQualification(index, "year", e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Year"
                      />
                    </div>
                    {qualifications.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQualification(index)}
                        className="mt-2 text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Date of First Appointment
                </label>
                <input
                  type="date"
                  value={formData.dateOfFirstAppointment}
                  onChange={(e) => updateField("dateOfFirstAppointment", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Date of Posting to School
                </label>
                <input
                  type="date"
                  value={formData.dateOfPostingToSchool}
                  onChange={(e) => updateField("dateOfPostingToSchool", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Employment */}
        {activeSection === 2 && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Position <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => updateField("position", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Senior Teacher, Accountant"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rank</label>
                <input
                  type="text"
                  value={formData.rank}
                  onChange={(e) => updateField("rank", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Principal Superintendent"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => updateField("departmentId", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => updateField("startDate", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Appointment Type <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-4">
                {[
                  { value: "PERMANENT", label: "Permanent" },
                  { value: "CONTRACT", label: "Contract" },
                  { value: "NATIONAL_SERVICE", label: "National Service" },
                  { value: "VOLUNTEER", label: "Volunteer" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="appointmentType"
                      value={opt.value}
                      checked={formData.appointmentType === opt.value}
                      onChange={(e) => updateField("appointmentType", e.target.value)}
                      className="accent-primary"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Salary Grade</label>
              <select
                value={formData.salaryGrade}
                onChange={(e) => updateField("salaryGrade", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select salary grade</option>
                {Array.from({ length: 10 }, (_, i) => `Grade ${i + 1}`).map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>

            {/* Create User Account */}
            {formData.staffType === "TEACHING" && (
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.createUserAccount}
                    onChange={(e) => updateField("createUserAccount", e.target.checked)}
                    className="rounded accent-primary h-4 w-4"
                  />
                  <div>
                    <span className="text-sm font-medium">
                      Create login account for this staff member
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      A user account with the &ldquo;teacher&rdquo; role will be created. A secure password will be generated and a password-reset email sent.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {activeSection > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/hr/staff")}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            {activeSection < 2 ? (
              <button
                type="button"
                onClick={handleNext}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Registering..." : "Register Staff"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
