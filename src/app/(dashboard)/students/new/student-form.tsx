"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GHANA_REGIONS } from "@/lib/constants";
import { createStudentAction } from "@/modules/student/actions/student.action";
import { FormInput, FormSelect, FormTextarea } from "@/components/shared/form-field";
import { CheckCircle2 } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

interface ClassArmOption {
  id: string;
  label: string;
  className: string;
  capacity: number;
  enrollmentCount: number;
}

interface FormData {
  firstName: string;
  lastName: string;
  otherNames: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  hometown: string;
  region: string;
  religion: string;
  bloodGroup: string;
  medicalConditions: string;
  allergies: string;
  boardingStatus: string;
  classArmId: string;
}

interface FieldErrors {
  [key: string]: string | undefined;
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

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
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validateSection(section: number): boolean {
    const errors: FieldErrors = {};
    if (section === 0) {
      if (!formData.firstName.trim()) errors.firstName = "First name is required";
      if (!formData.lastName.trim()) errors.lastName = "Last name is required";
      if (!formData.dateOfBirth) errors.dateOfBirth = "Date of birth is required";
      if (!formData.gender) errors.gender = "Gender is required";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (!validateSection(activeSection)) return;
    setFormError(null);
    setActiveSection((prev) => Math.min(prev + 1, 2));
  }

  function handleBack() {
    setFormError(null);
    setFieldErrors({});
    setActiveSection((prev) => Math.max(prev - 1, 0));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!validateSection(0)) {
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

      if ("error" in result) {
        setFormError(result.error ?? null);
      } else if ("data" in result && result.data) {
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

  const classOptions = Object.entries(classGroups).flatMap(([className, arms]) =>
    arms.map((arm) => ({
      label: `${arm.label} (${arm.enrollmentCount}/${arm.capacity})`,
      value: arm.id,
    })),
  );

  return (
    <div className="max-w-3xl">
      {/* Step Indicator */}
      <div className="mb-6 flex items-center">
        {sections.map((section, i) => (
          <div key={section.index} className="flex items-center">
            {i > 0 && (
              <div className={`h-px w-8 sm:w-16 ${i <= activeSection ? "bg-primary" : "bg-border"}`} />
            )}
            <button
              type="button"
              onClick={() => {
                if (i < activeSection || (i > activeSection && validateSection(activeSection))) {
                  setActiveSection(i);
                }
              }}
              className="flex items-center gap-2"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  i < activeSection
                    ? "bg-primary text-primary-foreground"
                    : i === activeSection
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < activeSection ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`hidden text-sm font-medium sm:inline ${
                  i === activeSection ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {section.title}
              </span>
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {formError && (
          <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {formError}
          </div>
        )}

        {/* Section 1: Personal Information */}
        {activeSection === 0 && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                id="firstName"
                label="First Name"
                required
                value={formData.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                placeholder="e.g. Kwame"
                error={fieldErrors.firstName}
              />
              <FormInput
                id="lastName"
                label="Last Name"
                required
                value={formData.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                placeholder="e.g. Mensah"
                error={fieldErrors.lastName}
              />
            </div>

            <FormInput
              id="otherNames"
              label="Other Names"
              value={formData.otherNames}
              onChange={(e) => updateField("otherNames", e.target.value)}
              placeholder="Middle names"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                id="dateOfBirth"
                label="Date of Birth"
                type="date"
                required
                value={formData.dateOfBirth}
                onChange={(e) => updateField("dateOfBirth", e.target.value)}
                error={fieldErrors.dateOfBirth}
              />
              <FormSelect
                id="gender"
                label="Gender"
                required
                value={formData.gender}
                onChange={(e) => updateField("gender", e.target.value)}
                placeholder="Select gender"
                options={[
                  { label: "Male", value: "MALE" },
                  { label: "Female", value: "FEMALE" },
                ]}
                error={fieldErrors.gender}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                id="nationality"
                label="Nationality"
                value={formData.nationality}
                onChange={(e) => updateField("nationality", e.target.value)}
                placeholder="Ghanaian"
              />
              <FormInput
                id="hometown"
                label="Hometown"
                value={formData.hometown}
                onChange={(e) => updateField("hometown", e.target.value)}
                placeholder="e.g. Kumasi"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormSelect
                id="region"
                label="Region"
                value={formData.region}
                onChange={(e) => updateField("region", e.target.value)}
                placeholder="Select region"
                options={GHANA_REGIONS.map((r) => ({ label: r, value: r }))}
              />
              <FormSelect
                id="religion"
                label="Religion"
                value={formData.religion}
                onChange={(e) => updateField("religion", e.target.value)}
                placeholder="Select religion"
                options={RELIGIONS.map((r) => ({ label: r, value: r }))}
              />
            </div>
          </div>
        )}

        {/* Section 2: Medical Information */}
        {activeSection === 1 && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <FormSelect
              id="bloodGroup"
              label="Blood Group"
              value={formData.bloodGroup}
              onChange={(e) => updateField("bloodGroup", e.target.value)}
              placeholder="Select blood group"
              options={BLOOD_GROUPS.map((bg) => ({ label: bg, value: bg }))}
            />

            <FormTextarea
              id="medicalConditions"
              label="Medical Conditions"
              value={formData.medicalConditions}
              onChange={(e) => updateField("medicalConditions", e.target.value)}
              placeholder="List any known medical conditions (e.g. asthma, sickle cell, epilepsy)"
              rows={3}
            />

            <FormTextarea
              id="allergies"
              label="Allergies"
              value={formData.allergies}
              onChange={(e) => updateField("allergies", e.target.value)}
              placeholder="List any known allergies (e.g. penicillin, peanuts)"
              rows={3}
            />

            <p className="text-xs text-muted-foreground">
              Medical information is kept confidential and used only for student welfare purposes.
            </p>
          </div>
        )}

        {/* Section 3: School Information */}
        {activeSection === 2 && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <FormSelect
              id="boardingStatus"
              label="Boarding Status"
              value={formData.boardingStatus}
              onChange={(e) => updateField("boardingStatus", e.target.value)}
              options={[
                { label: "Day Student", value: "DAY" },
                { label: "Boarding Student", value: "BOARDING" },
              ]}
            />

            <FormSelect
              id="classArmId"
              label="Class Assignment"
              value={formData.classArmId}
              onChange={(e) => updateField("classArmId", e.target.value)}
              placeholder="Assign later"
              options={classOptions}
              description="You can assign the student to a class now, or do it later from their profile."
            />
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {activeSection > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/students")}
              className="rounded-lg border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            {activeSection < 2 ? (
              <button
                type="button"
                onClick={handleNext}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
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
