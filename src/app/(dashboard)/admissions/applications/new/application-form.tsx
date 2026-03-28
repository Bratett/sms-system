"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createApplicationAction } from "@/modules/admissions/actions/admission.action";

interface Programme {
  id: string;
  name: string;
}

const GUARDIAN_RELATIONSHIPS = [
  "Father",
  "Mother",
  "Uncle",
  "Aunt",
  "Guardian",
  "Other",
];

export function ApplicationForm({ programmes }: { programmes: Programme[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Applicant Info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [otherNames, setOtherNames] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "">("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [jhsIndexNumber, setJhsIndexNumber] = useState("");
  const [jhsAggregate, setJhsAggregate] = useState("");

  // Programme Preferences
  const [programmePreference1Id, setProgrammePreference1Id] = useState("");
  const [programmePreference2Id, setProgrammePreference2Id] = useState("");
  const [boardingStatus, setBoardingStatus] = useState<"DAY" | "BOARDING">("DAY");

  // Guardian Info
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianAddress, setGuardianAddress] = useState("");
  const [guardianOccupation, setGuardianOccupation] = useState("");

  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const result = await createApplicationAction({
        firstName,
        lastName,
        otherNames,
        dateOfBirth,
        gender: gender as "MALE" | "FEMALE",
        previousSchool,
        jhsIndexNumber,
        jhsAggregate: jhsAggregate ? parseInt(jhsAggregate, 10) : undefined,
        programmePreference1Id,
        programmePreference2Id,
        guardianName,
        guardianPhone,
        guardianEmail,
        guardianRelationship,
        guardianAddress,
        guardianOccupation,
        boardingStatus,
        notes,
      });

      if (result.error) {
        toast.error(result.error);
        if (result.details) {
          setErrors(result.details as Record<string, string[]>);
        }
      } else {
        toast.success("Application created successfully.");
        router.push("/admissions/applications");
        router.refresh();
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const labelClass = "block text-sm font-medium mb-1.5";
  const errorClass = "text-xs text-destructive mt-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Section 1: Applicant Information */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Applicant Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass}>
              First Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
              placeholder="Enter first name"
              required
            />
            {errors.firstName && <p className={errorClass}>{errors.firstName[0]}</p>}
          </div>

          <div>
            <label className={labelClass}>
              Last Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
              placeholder="Enter last name"
              required
            />
            {errors.lastName && <p className={errorClass}>{errors.lastName[0]}</p>}
          </div>

          <div>
            <label className={labelClass}>Other Names</label>
            <input
              type="text"
              value={otherNames}
              onChange={(e) => setOtherNames(e.target.value)}
              className={inputClass}
              placeholder="Enter other names"
            />
          </div>

          <div>
            <label className={labelClass}>
              Date of Birth <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={inputClass}
              required
            />
            {errors.dateOfBirth && <p className={errorClass}>{errors.dateOfBirth[0]}</p>}
          </div>

          <div>
            <label className={labelClass}>
              Gender <span className="text-destructive">*</span>
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE")}
              className={inputClass}
              required
            >
              <option value="">Select gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
            {errors.gender && <p className={errorClass}>{errors.gender[0]}</p>}
          </div>

          <div>
            <label className={labelClass}>Previous School</label>
            <input
              type="text"
              value={previousSchool}
              onChange={(e) => setPreviousSchool(e.target.value)}
              className={inputClass}
              placeholder="Enter previous school name"
            />
          </div>

          <div>
            <label className={labelClass}>JHS Index Number</label>
            <input
              type="text"
              value={jhsIndexNumber}
              onChange={(e) => setJhsIndexNumber(e.target.value)}
              className={inputClass}
              placeholder="e.g., 0123456789"
            />
          </div>

          <div>
            <label className={labelClass}>JHS Aggregate</label>
            <input
              type="number"
              value={jhsAggregate}
              onChange={(e) => setJhsAggregate(e.target.value)}
              className={inputClass}
              placeholder="6-54"
              min={6}
              max={54}
            />
            {errors.jhsAggregate && (
              <p className={errorClass}>{errors.jhsAggregate[0]}</p>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Programme Preferences */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Programme Preferences</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass}>Programme Preference 1</label>
            <select
              value={programmePreference1Id}
              onChange={(e) => setProgrammePreference1Id(e.target.value)}
              className={inputClass}
            >
              <option value="">Select programme</option>
              {programmes.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  {prog.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Programme Preference 2</label>
            <select
              value={programmePreference2Id}
              onChange={(e) => setProgrammePreference2Id(e.target.value)}
              className={inputClass}
            >
              <option value="">Select programme</option>
              {programmes.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  {prog.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Boarding Status</label>
            <div className="flex items-center gap-6 mt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="boardingStatus"
                  value="DAY"
                  checked={boardingStatus === "DAY"}
                  onChange={() => setBoardingStatus("DAY")}
                  className="h-4 w-4 text-primary"
                />
                Day
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="boardingStatus"
                  value="BOARDING"
                  checked={boardingStatus === "BOARDING"}
                  onChange={() => setBoardingStatus("BOARDING")}
                  className="h-4 w-4 text-primary"
                />
                Boarding
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Guardian Information */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Guardian Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass}>
              Guardian Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              className={inputClass}
              placeholder="Enter guardian full name"
              required
            />
            {errors.guardianName && (
              <p className={errorClass}>{errors.guardianName[0]}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Guardian Phone <span className="text-destructive">*</span>
            </label>
            <input
              type="tel"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              className={inputClass}
              placeholder="e.g., 0241234567"
              required
            />
            {errors.guardianPhone && (
              <p className={errorClass}>{errors.guardianPhone[0]}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Guardian Email</label>
            <input
              type="email"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              className={inputClass}
              placeholder="guardian@example.com"
            />
            {errors.guardianEmail && (
              <p className={errorClass}>{errors.guardianEmail[0]}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Relationship</label>
            <select
              value={guardianRelationship}
              onChange={(e) => setGuardianRelationship(e.target.value)}
              className={inputClass}
            >
              <option value="">Select relationship</option>
              {GUARDIAN_RELATIONSHIPS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Address</label>
            <input
              type="text"
              value={guardianAddress}
              onChange={(e) => setGuardianAddress(e.target.value)}
              className={inputClass}
              placeholder="Enter guardian address"
            />
          </div>

          <div>
            <label className={labelClass}>Occupation</label>
            <input
              type="text"
              value={guardianOccupation}
              onChange={(e) => setGuardianOccupation(e.target.value)}
              className={inputClass}
              placeholder="Enter guardian occupation"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Additional Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${inputClass} min-h-[100px]`}
          placeholder="Any additional notes about the application..."
          rows={4}
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/admissions/applications")}
          className="rounded-md border border-border px-6 py-2 text-sm font-medium hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Submitting..." : "Submit Application"}
        </button>
      </div>
    </form>
  );
}
