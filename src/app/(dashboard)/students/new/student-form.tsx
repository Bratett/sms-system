"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GHANA_REGIONS } from "@/lib/constants";
import { createStudentAction } from "@/modules/student/actions/student.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ClassArmOption {
  id: string;
  label: string;
  className: string;
  capacity: number;
  enrollmentCount: number;
}

interface FormData {
  // Personal
  firstName: string;
  lastName: string;
  otherNames: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  hometown: string;
  region: string;
  religion: string;
  // Medical
  bloodGroup: string;
  medicalConditions: string;
  allergies: string;
  // School
  boardingStatus: string;
  classArmId: string;
}

const RELIGIONS = [
  "Christianity",
  "Islam",
  "Traditional",
  "Hinduism",
  "Buddhism",
  "Other",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ─── Component ──────────────────────────────────────────────────────

export function StudentForm({
  classArmOptions,
}: {
  classArmOptions: ClassArmOption[];
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
    nationality: "Ghanaian",
    hometown: "",
    region: "",
    religion: "",
    bloodGroup: "",
    medicalConditions: "",
    allergies: "",
    boardingStatus: "DAY",
    classArmId: "",
  });

  const sections = [
    { title: "Personal Information", index: 0 },
    { title: "Medical Information", index: 1 },
    { title: "School Information", index: 2 },
  ];

  function updateField(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleNext() {
    // Validate current section
    if (activeSection === 0) {
      if (!formData.firstName.trim()) {
        setFormError("First name is required.");
        return;
      }
      if (!formData.lastName.trim()) {
        setFormError("Last name is required.");
        return;
      }
      if (!formData.dateOfBirth) {
        setFormError("Date of birth is required.");
        return;
      }
      if (!formData.gender) {
        setFormError("Gender is required.");
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
    if (!formData.dateOfBirth) {
      setFormError("Date of birth is required.");
      setActiveSection(0);
      return;
    }
    if (!formData.gender) {
      setFormError("Gender is required.");
      setActiveSection(0);
      return;
    }

    startTransition(async () => {
      const result = await createStudentAction({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        otherNames: formData.otherNames.trim() || undefined,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender as "MALE" | "FEMALE",
        nationality: formData.nationality.trim() || undefined,
        hometown: formData.hometown.trim() || undefined,
        region: formData.region || undefined,
        religion: formData.religion || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        medicalConditions: formData.medicalConditions.trim() || undefined,
        allergies: formData.allergies.trim() || undefined,
        boardingStatus: (formData.boardingStatus as "DAY" | "BOARDING") || "DAY",
        classArmId: formData.classArmId || undefined,
      });

      if (result.error) {
        setFormError(result.error);
      } else if (result.data) {
        toast.success(
          `Student "${result.data.firstName} ${result.data.lastName}" registered successfully.`,
        );
        router.push(`/students/${result.data.id}`);
      }
    });
  }

  // Group class arm options by class
  const classGroups = classArmOptions.reduce(
    (acc, arm) => {
      if (!acc[arm.className]) acc[arm.className] = [];
      acc[arm.className].push(arm);
      return acc;
    },
    {} as Record<string, ClassArmOption[]>,
  );

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
                <label className="block text-sm font-medium mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => updateField("dateOfBirth", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
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
                <label className="block text-sm font-medium mb-1">Nationality</label>
                <input
                  type="text"
                  value={formData.nationality}
                  onChange={(e) => updateField("nationality", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Ghanaian"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hometown</label>
                <input
                  type="text"
                  value={formData.hometown}
                  onChange={(e) => updateField("hometown", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Kumasi"
                />
              </div>
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
                <label className="block text-sm font-medium mb-1">Religion</label>
                <select
                  value={formData.religion}
                  onChange={(e) => updateField("religion", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select religion</option>
                  {RELIGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Medical Information */}
        {activeSection === 1 && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div>
              <label className="block text-sm font-medium mb-1">Blood Group</label>
              <select
                value={formData.bloodGroup}
                onChange={(e) => updateField("bloodGroup", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select blood group</option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Medical Conditions</label>
              <textarea
                value={formData.medicalConditions}
                onChange={(e) => updateField("medicalConditions", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="List any known medical conditions (e.g. asthma, sickle cell, epilepsy)"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Allergies</label>
              <textarea
                value={formData.allergies}
                onChange={(e) => updateField("allergies", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="List any known allergies (e.g. penicillin, peanuts)"
                rows={3}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Medical information is kept confidential and used only for student welfare purposes.
            </p>
          </div>
        )}

        {/* Section 3: School Information */}
        {activeSection === 2 && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div>
              <label className="block text-sm font-medium mb-1">Boarding Status</label>
              <select
                value={formData.boardingStatus}
                onChange={(e) => updateField("boardingStatus", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="DAY">Day Student</option>
                <option value="BOARDING">Boarding Student</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Class Assignment</label>
              <select
                value={formData.classArmId}
                onChange={(e) => updateField("classArmId", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Assign later</option>
                {Object.entries(classGroups).map(([className, arms]) => (
                  <optgroup key={className} label={className}>
                    {arms.map((arm) => (
                      <option key={arm.id} value={arm.id}>
                        {arm.label} ({arm.enrollmentCount}/{arm.capacity})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                You can assign the student to a class now, or do it later from their profile.
              </p>
            </div>
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
              onClick={() => router.push("/students")}
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
                {isPending ? "Registering..." : "Register Student"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
