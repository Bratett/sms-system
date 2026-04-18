"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  submitPublicApplicationAction,
  verifyPlacementAction,
} from "@/modules/admissions/actions/public-admission.action";

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

const STEPS = [
  "Application Type & Applicant Info",
  "Programme & Guardian Details",
  "Review & Submit",
];

export function ApplicationPortalForm({
  programmes,
  schoolName,
}: {
  programmes: Programme[];
  schoolName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [stepError, setStepError] = useState<string | null>(null);

  // Application type
  const [applicationType, setApplicationType] = useState<"STANDARD" | "PLACEMENT">("STANDARD");

  // Placement fields
  const [beceIndexNumber, setBeceIndexNumber] = useState("");
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [placementSchoolCode, setPlacementSchoolCode] = useState("");
  const [isVerifyingPlacement, setIsVerifyingPlacement] = useState(false);
  const [placementVerifyResult, setPlacementVerifyResult] = useState<
    { valid: boolean; errors: string[]; warnings: string[] } | null
  >(null);

  async function handleVerifyPlacement() {
    if (!beceIndexNumber.trim() || !enrollmentCode.trim()) {
      toast.error("Enter both BECE index and enrollment code first.");
      return;
    }
    setIsVerifyingPlacement(true);
    try {
      const res = await verifyPlacementAction({
        enrollmentCode: enrollmentCode.trim(),
        beceIndexNumber: beceIndexNumber.trim(),
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        setPlacementVerifyResult({ valid: false, errors: [res.error], warnings: [] });
      } else if ("data" in res && res.data) {
        setPlacementVerifyResult(res.data);
        if (res.data.valid) {
          toast.success("Placement details look valid.");
        }
      }
    } finally {
      setIsVerifyingPlacement(false);
    }
  }

  // Applicant info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [otherNames, setOtherNames] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "">("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [jhsIndexNumber, setJhsIndexNumber] = useState("");
  const [jhsAggregate, setJhsAggregate] = useState("");

  // Programme preferences
  const [programmePreference1Id, setProgrammePreference1Id] = useState("");
  const [programmePreference2Id, setProgrammePreference2Id] = useState("");
  const [boardingStatus, setBoardingStatus] = useState<"DAY" | "BOARDING">("DAY");

  // Guardian info
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianAddress, setGuardianAddress] = useState("");
  const [guardianOccupation, setGuardianOccupation] = useState("");

  const [notes, setNotes] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const labelClass = "block text-sm font-medium mb-1.5";
  const errorClass = "text-xs text-destructive mt-1";

  function validateStep1(): boolean {
    const errs: string[] = [];
    if (!firstName.trim()) errs.push("First name is required");
    if (!lastName.trim()) errs.push("Last name is required");
    if (!dateOfBirth) errs.push("Date of birth is required");
    if (!gender) errs.push("Gender is required");
    if (applicationType === "PLACEMENT") {
      if (!beceIndexNumber.trim()) errs.push("BECE Index Number is required for placement applications");
      else if (!/^(\d{10}|\d{12})$/.test(beceIndexNumber.trim()))
        errs.push(
          "BECE Index Number must be 10 digits (or 12 digits if the 2-digit year is included). No slashes or spaces.",
        );
      if (!enrollmentCode.trim()) errs.push("Enrollment Code is required for placement applications");
      else if (!/^[A-Za-z0-9]{6,}$/.test(enrollmentCode.trim()))
        errs.push("Enrollment Code must be at least 6 alphanumeric characters");
    }
    if (errs.length > 0) {
      setStepError(errs.join(". "));
      return false;
    }
    setStepError(null);
    return true;
  }

  function validateStep2(): boolean {
    const errs: string[] = [];
    if (!guardianName.trim()) errs.push("Guardian name is required");
    if (!guardianPhone.trim()) errs.push("Guardian phone is required");
    if (!guardianRelationship) errs.push("Guardian relationship is required");
    if (!guardianAddress.trim()) errs.push("Guardian address is required");
    if (guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail))
      errs.push("Invalid email format");
    if (errs.length > 0) {
      setStepError(errs.join(". "));
      return false;
    }
    setStepError(null);
    return true;
  }

  function handleNext() {
    if (currentStep === 0 && !validateStep1()) return;
    if (currentStep === 1 && !validateStep2()) return;
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStepError(null);
    setCurrentStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit() {
    if (!agreedToTerms) {
      setStepError("You must agree to the declaration before submitting.");
      return;
    }
    setErrors({});
    setStepError(null);

    startTransition(async () => {
      const result = await submitPublicApplicationAction({
        applicationType,
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
        beceIndexNumber: applicationType === "PLACEMENT" ? beceIndexNumber : "",
        enrollmentCode: applicationType === "PLACEMENT" ? enrollmentCode : "",
        placementSchoolCode: applicationType === "PLACEMENT" ? placementSchoolCode : "",
        notes,
      });

      if (result.error) {
        toast.error(result.error);
        if (result.details) {
          setErrors(result.details as Record<string, string[]>);
          // Go to the step with the first error
          const errorKeys = Object.keys(result.details);
          const step1Fields = ["firstName", "lastName", "dateOfBirth", "gender", "beceIndexNumber", "enrollmentCode"];
          if (errorKeys.some((k) => step1Fields.includes(k))) {
            setCurrentStep(0);
          } else {
            setCurrentStep(1);
          }
        }
      } else if (result.data) {
        toast.success("Application submitted successfully!");
        const params = new URLSearchParams({
          ref: result.data.applicationNumber,
          name: `${result.data.firstName} ${result.data.lastName}`,
        });
        router.push(`/apply/success?${params.toString()}`);
      }
    });
  }

  // Helper to get programme name by ID
  function getProgrammeName(id: string): string {
    return programmes.find((p) => p.id === id)?.name ?? "Not selected";
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    i < currentStep
                      ? "bg-primary text-primary-foreground"
                      : i === currentStep
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                        : "bg-muted-foreground/20 text-muted-foreground"
                  }`}
                >
                  {i < currentStep ? "\u2713" : i + 1}
                </div>
                <span
                  className={`text-xs hidden sm:block ${
                    i <= currentStep ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {step}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-3 ${
                    i < currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {stepError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {stepError}
        </div>
      )}

      {/* Step 1: Application Type & Applicant Info */}
      {currentStep === 0 && (
        <div className="space-y-6">
          {/* Application Type Selection */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Application Type</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                  applicationType === "STANDARD"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <input
                  type="radio"
                  name="applicationType"
                  value="STANDARD"
                  checked={applicationType === "STANDARD"}
                  onChange={() => setApplicationType("STANDARD")}
                  className="sr-only"
                />
                <div>
                  <div className="font-medium">Standard Application</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Regular admission application for general applicants
                  </p>
                </div>
              </label>
              <label
                className={`flex cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                  applicationType === "PLACEMENT"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <input
                  type="radio"
                  name="applicationType"
                  value="PLACEMENT"
                  checked={applicationType === "PLACEMENT"}
                  onChange={() => setApplicationType("PLACEMENT")}
                  className="sr-only"
                />
                <div>
                  <div className="font-medium">CSSPS Placement</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    For students placed through the national CSSPS system
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Placement-specific fields */}
          {applicationType === "PLACEMENT" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <h2 className="text-lg font-semibold mb-4">CSSPS Placement Details</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelClass}>
                    BECE Index Number <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={beceIndexNumber}
                    onChange={(e) =>
                      setBeceIndexNumber(e.target.value.replace(/\D/g, ""))
                    }
                    className={inputClass}
                    placeholder="e.g., 0120045067"
                    maxLength={12}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    10 digits, or 12 digits with 2-digit year prefix. No slashes.
                  </p>
                  {errors.beceIndexNumber && (
                    <p className={errorClass}>{errors.beceIndexNumber[0]}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>
                    Enrollment Code <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={enrollmentCode}
                    onChange={(e) => setEnrollmentCode(e.target.value)}
                    className={inputClass}
                    placeholder="Enter enrollment code"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    As provided by the school placement system
                  </p>
                  {errors.enrollmentCode && (
                    <p className={errorClass}>{errors.enrollmentCode[0]}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Placement School Code</label>
                  <input
                    type="text"
                    value={placementSchoolCode}
                    onChange={(e) => setPlacementSchoolCode(e.target.value)}
                    className={inputClass}
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Verify placement probe */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleVerifyPlacement}
                  disabled={
                    isVerifyingPlacement || !beceIndexNumber.trim() || !enrollmentCode.trim()
                  }
                  className="rounded-md border border-primary bg-background px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
                >
                  {isVerifyingPlacement ? "Verifying…" : "Verify placement"}
                </button>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                  ✓ Application fee: WAIVED (Free SHS)
                </div>
              </div>

              {placementVerifyResult && (
                <div
                  className={`mt-3 rounded-md border p-3 text-sm ${
                    placementVerifyResult.valid
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-red-200 bg-red-50 text-red-900"
                  }`}
                >
                  {placementVerifyResult.valid ? (
                    <>
                      <div className="font-medium">Placement looks valid.</div>
                      {placementVerifyResult.warnings.length > 0 && (
                        <ul className="mt-1 list-disc pl-5 text-xs text-amber-800">
                          {placementVerifyResult.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="font-medium">Could not verify placement.</div>
                      <ul className="mt-1 list-disc pl-5 text-xs">
                        {placementVerifyResult.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Applicant Information */}
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
                {errors.jhsAggregate && <p className={errorClass}>{errors.jhsAggregate[0]}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Programme & Guardian */}
      {currentStep === 1 && (
        <div className="space-y-6">
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
                />
                {errors.guardianName && <p className={errorClass}>{errors.guardianName[0]}</p>}
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
                />
                {errors.guardianPhone && <p className={errorClass}>{errors.guardianPhone[0]}</p>}
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
                {errors.guardianEmail && <p className={errorClass}>{errors.guardianEmail[0]}</p>}
              </div>
              <div>
                <label className={labelClass}>
                  Relationship <span className="text-destructive">*</span>
                </label>
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
                {errors.guardianRelationship && (
                  <p className={errorClass}>{errors.guardianRelationship[0]}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>
                  Address <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={guardianAddress}
                  onChange={(e) => setGuardianAddress(e.target.value)}
                  className={inputClass}
                  placeholder="Enter guardian address"
                />
                {errors.guardianAddress && (
                  <p className={errorClass}>{errors.guardianAddress[0]}</p>
                )}
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

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Additional Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputClass} min-h-[80px]`}
              placeholder="Any additional information about the application..."
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Application Summary</h2>

            <div className="space-y-6">
              {/* Application Type */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Application Type</h3>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    applicationType === "PLACEMENT"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {applicationType === "PLACEMENT" ? "CSSPS Placement" : "Standard"}
                </span>
              </div>

              {/* Placement Details */}
              {applicationType === "PLACEMENT" && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Placement Details</h3>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">BECE Index Number</dt>
                      <dd className="font-medium">{beceIndexNumber}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Enrollment Code</dt>
                      <dd className="font-medium">{enrollmentCode}</dd>
                    </div>
                    {placementSchoolCode && (
                      <div>
                        <dt className="text-muted-foreground">School Code</dt>
                        <dd className="font-medium">{placementSchoolCode}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Applicant Information */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Applicant Information</h3>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Full Name</dt>
                    <dd className="font-medium">
                      {firstName} {lastName} {otherNames && `(${otherNames})`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Date of Birth</dt>
                    <dd className="font-medium">{dateOfBirth}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Gender</dt>
                    <dd className="font-medium">{gender}</dd>
                  </div>
                  {previousSchool && (
                    <div>
                      <dt className="text-muted-foreground">Previous School</dt>
                      <dd className="font-medium">{previousSchool}</dd>
                    </div>
                  )}
                  {jhsIndexNumber && (
                    <div>
                      <dt className="text-muted-foreground">JHS Index Number</dt>
                      <dd className="font-medium">{jhsIndexNumber}</dd>
                    </div>
                  )}
                  {jhsAggregate && (
                    <div>
                      <dt className="text-muted-foreground">JHS Aggregate</dt>
                      <dd className="font-medium">{jhsAggregate}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Programme Preferences */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Programme & Boarding</h3>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">1st Choice</dt>
                    <dd className="font-medium">{programmePreference1Id ? getProgrammeName(programmePreference1Id) : "Not selected"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">2nd Choice</dt>
                    <dd className="font-medium">{programmePreference2Id ? getProgrammeName(programmePreference2Id) : "Not selected"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Boarding Status</dt>
                    <dd className="font-medium">{boardingStatus === "BOARDING" ? "Boarding" : "Day"}</dd>
                  </div>
                </dl>
              </div>

              {/* Guardian Information */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Guardian Information</h3>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium">{guardianName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="font-medium">{guardianPhone}</dd>
                  </div>
                  {guardianEmail && (
                    <div>
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="font-medium">{guardianEmail}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground">Relationship</dt>
                    <dd className="font-medium">{guardianRelationship}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Address</dt>
                    <dd className="font-medium">{guardianAddress}</dd>
                  </div>
                  {guardianOccupation && (
                    <div>
                      <dt className="text-muted-foreground">Occupation</dt>
                      <dd className="font-medium">{guardianOccupation}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {notes && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
                  <p className="text-sm">{notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Declaration */}
          <div className="rounded-lg border border-border bg-card p-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary"
              />
              <span className="text-sm">
                I declare that the information provided in this application is true and accurate
                to the best of my knowledge. I understand that providing false information may
                result in the cancellation of this application.
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="rounded-md border border-border px-6 py-2 text-sm font-medium hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Back
        </button>
        {currentStep < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !agreedToTerms}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Submitting..." : "Submit Application"}
          </button>
        )}
      </div>
    </div>
  );
}
