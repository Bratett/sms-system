"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { updateStudentAction, enrollStudentAction } from "@/modules/student/actions/student.action";
import { getStudentPerformanceTrendsAction } from "@/modules/academics/actions/trends.action";
import {
  createGuardianAction,
  linkGuardianToStudentAction,
  unlinkGuardianFromStudentAction,
} from "@/modules/student/actions/guardian.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  altPhone: string | null;
  email: string | null;
  occupation: string | null;
  address: string | null;
  relationship: string | null;
  isPrimary: boolean;
}

interface Enrollment {
  id: string;
  classArmId: string;
  classArmName: string | null;
  className: string | null;
  yearGroup: number | null;
  programmeName: string | null;
  academicYearName: string | null;
  enrollmentDate: Date;
  status: string;
}

interface StudentData {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  dateOfBirth: Date;
  gender: string;
  nationality: string | null;
  hometown: string | null;
  region: string | null;
  religion: string | null;
  bloodGroup: string | null;
  medicalConditions: string | null;
  allergies: string | null;
  photoUrl: string | null;
  boardingStatus: string;
  status: string;
  enrollmentDate: Date;
  createdAt: Date;
  updatedAt: Date;
  guardians: Guardian[];
  enrollments: Enrollment[];
  houseAssignment: { id: string; houseId: string } | null;
}

interface GuardianOption {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
}

interface ClassArmOption {
  id: string;
  label: string;
  className: string;
  academicYearId: string;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

// ─── Component ──────────────────────────────────────────────────────

export function StudentProfile({
  student,
  allGuardians,
  classArmOptions,
  academicYears,
}: {
  student: StudentData;
  allGuardians: GuardianOption[];
  classArmOptions: ClassArmOption[];
  academicYears: AcademicYear[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState(0);

  // Enrollment modal
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollAcademicYearId, setEnrollAcademicYearId] = useState(
    academicYears.find((ay) => ay.isCurrent)?.id ?? "",
  );
  const [enrollClassArmId, setEnrollClassArmId] = useState("");

  // Guardian link modal
  const [showGuardianModal, setShowGuardianModal] = useState(false);
  const [guardianMode, setGuardianMode] = useState<"link" | "new">("link");
  const [selectedGuardianId, setSelectedGuardianId] = useState("");
  const [guardianIsPrimary, setGuardianIsPrimary] = useState(false);
  const [newGuardian, setNewGuardian] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    altPhone: "",
    email: "",
    occupation: "",
    address: "",
    relationship: "",
  });
  const [guardianFormError, setGuardianFormError] = useState<string | null>(null);

  // Status update
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState(student.status);

  const tabs = [
    { title: "Personal", index: 0 },
    { title: "Guardians", index: 1 },
    { title: "Academic", index: 2 },
    { title: "Finance", index: 3 },
    { title: "Attendance", index: 4 },
  ];

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  // Filter class arms by selected academic year for enrollment
  const filteredClassArms = enrollAcademicYearId
    ? classArmOptions.filter((arm) => arm.academicYearId === enrollAcademicYearId)
    : classArmOptions;

  // Group them by class
  const classGroups = filteredClassArms.reduce(
    (acc, arm) => {
      if (!acc[arm.className]) acc[arm.className] = [];
      acc[arm.className].push(arm);
      return acc;
    },
    {} as Record<string, ClassArmOption[]>,
  );

  // Current enrollment
  const currentEnrollment = student.enrollments.find((e) => e.status === "ACTIVE");

  // Guardians not yet linked to this student
  const linkedGuardianIds = new Set(student.guardians.map((g) => g.id));
  const availableGuardians = allGuardians.filter((g) => !linkedGuardianIds.has(g.id));

  // ─── Handlers ───────────────────────────────────────────────────

  function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollClassArmId || !enrollAcademicYearId) return;
    startTransition(async () => {
      const result = await enrollStudentAction(student.id, enrollClassArmId, enrollAcademicYearId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Student enrolled successfully.");
        setShowEnrollModal(false);
        router.refresh();
      }
    });
  }

  function handleLinkGuardian(e: React.FormEvent) {
    e.preventDefault();
    setGuardianFormError(null);

    if (guardianMode === "link") {
      if (!selectedGuardianId) {
        setGuardianFormError("Please select a guardian.");
        return;
      }
      startTransition(async () => {
        const result = await linkGuardianToStudentAction(
          student.id,
          selectedGuardianId,
          guardianIsPrimary,
        );
        if ("error" in result) {
          setGuardianFormError(result.error);
        } else {
          toast.success("Guardian linked successfully.");
          setShowGuardianModal(false);
          router.refresh();
        }
      });
    } else {
      // Create new guardian + link
      if (!newGuardian.firstName.trim() || !newGuardian.lastName.trim()) {
        setGuardianFormError("Guardian first and last names are required.");
        return;
      }
      if (!newGuardian.phone.trim()) {
        setGuardianFormError("Guardian phone number is required.");
        return;
      }
      startTransition(async () => {
        const createResult = await createGuardianAction({
          firstName: newGuardian.firstName.trim(),
          lastName: newGuardian.lastName.trim(),
          phone: newGuardian.phone.trim(),
          altPhone: newGuardian.altPhone.trim() || undefined,
          email: newGuardian.email.trim() || undefined,
          occupation: newGuardian.occupation.trim() || undefined,
          address: newGuardian.address.trim() || undefined,
          relationship: newGuardian.relationship.trim() || undefined,
        });
        if ("error" in createResult) {
          setGuardianFormError(createResult.error);
          return;
        }
        if ("data" in createResult && createResult.data) {
          const linkResult = await linkGuardianToStudentAction(
            student.id,
            createResult.data.id,
            guardianIsPrimary,
          );
          if ("error" in linkResult) {
            setGuardianFormError(linkResult.error);
          } else {
            toast.success("Guardian created and linked successfully.");
            setShowGuardianModal(false);
            router.refresh();
          }
        }
      });
    }
  }

  function handleUnlinkGuardian(guardianId: string, guardianName: string) {
    if (!confirm(`Remove ${guardianName} as guardian?`)) return;
    startTransition(async () => {
      const result = await unlinkGuardianFromStudentAction(student.id, guardianId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Guardian removed.");
        router.refresh();
      }
    });
  }

  function handleStatusUpdate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateStudentAction(student.id, {
        status: newStatus as "ACTIVE" | "SUSPENDED" | "WITHDRAWN",
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Student status updated.");
        setShowStatusModal(false);
        router.refresh();
      }
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <>
      {/* Status + Quick Actions Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <StatusBadge status={student.status} />
        <StatusBadge
          status={student.boardingStatus}
          className={
            student.boardingStatus === "BOARDING"
              ? "bg-purple-100 text-purple-700"
              : "bg-sky-100 text-sky-700"
          }
        />
        {currentEnrollment && (
          <span className="text-sm text-muted-foreground">
            Class: <span className="font-medium text-foreground">{currentEnrollment.classArmName}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowStatusModal(true)}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Change Status
          </button>
          <button
            onClick={() => setShowEnrollModal(true)}
            className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Enroll / Transfer
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.index}
              onClick={() => setActiveTab(tab.index)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.index
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-border bg-card p-6">
        {/* ─── Personal Tab ──────────────────────────────── */}
        {activeTab === 0 && (
          <div className="space-y-6">
            <div className="flex items-start gap-6">
              {/* Photo placeholder */}
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground">
                {student.firstName[0]}
                {student.lastName[0]}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold">
                  {student.firstName} {student.otherNames ? `${student.otherNames} ` : ""}
                  {student.lastName}
                </h3>
                <p className="text-sm text-muted-foreground font-mono">{student.studentId}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <InfoItem label="Gender" value={student.gender} />
              <InfoItem label="Date of Birth" value={formatDate(student.dateOfBirth)} />
              <InfoItem label="Nationality" value={student.nationality} />
              <InfoItem label="Hometown" value={student.hometown} />
              <InfoItem label="Region" value={student.region} />
              <InfoItem label="Religion" value={student.religion} />
              <InfoItem label="Blood Group" value={student.bloodGroup} />
              <InfoItem label="Boarding Status" value={student.boardingStatus} />
              <InfoItem label="Enrolled" value={formatDate(student.enrollmentDate)} />
            </div>

            {(student.medicalConditions || student.allergies) && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Medical Information</h4>
                {student.medicalConditions && (
                  <p className="text-sm text-yellow-700">
                    <span className="font-medium">Conditions:</span> {student.medicalConditions}
                  </p>
                )}
                {student.allergies && (
                  <p className="text-sm text-yellow-700 mt-1">
                    <span className="font-medium">Allergies:</span> {student.allergies}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Guardians Tab ─────────────────────────────── */}
        {activeTab === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Guardians / Parents</h3>
              <button
                onClick={() => {
                  setGuardianMode("link");
                  setSelectedGuardianId("");
                  setGuardianIsPrimary(false);
                  setNewGuardian({
                    firstName: "",
                    lastName: "",
                    phone: "",
                    altPhone: "",
                    email: "",
                    occupation: "",
                    address: "",
                    relationship: "",
                  });
                  setGuardianFormError(null);
                  setShowGuardianModal(true);
                }}
                className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
              >
                + Add Guardian
              </button>
            </div>

            {student.guardians.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No guardians linked. Click &quot;+ Add Guardian&quot; to add one.
              </p>
            ) : (
              <div className="space-y-3">
                {student.guardians.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-start justify-between rounded-lg border border-border p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {g.firstName} {g.lastName}
                        </span>
                        {g.isPrimary && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Primary
                          </span>
                        )}
                        {g.relationship && (
                          <span className="text-xs text-muted-foreground">({g.relationship})</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>Phone: {g.phone}</span>
                        {g.altPhone && <span>Alt: {g.altPhone}</span>}
                        {g.email && <span>Email: {g.email}</span>}
                      </div>
                      {g.occupation && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Occupation: {g.occupation}
                        </p>
                      )}
                      {g.address && (
                        <p className="mt-1 text-xs text-muted-foreground">Address: {g.address}</p>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        handleUnlinkGuardian(g.id, `${g.firstName} ${g.lastName}`)
                      }
                      disabled={isPending}
                      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Academic Tab ──────────────────────────────── */}
        {activeTab === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Enrollment History</h3>
              <button
                onClick={() => setShowEnrollModal(true)}
                className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
              >
                Enroll / Transfer
              </button>
            </div>

            {student.enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No enrollment records found.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium">Academic Year</th>
                    <th className="px-3 py-2 text-left font-medium">Class</th>
                    <th className="px-3 py-2 text-left font-medium">Programme</th>
                    <th className="px-3 py-2 text-left font-medium">Enrolled</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {student.enrollments.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2">{e.academicYearName || "---"}</td>
                      <td className="px-3 py-2 font-medium">{e.classArmName || "---"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {e.programmeName || "---"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDate(e.enrollmentDate)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Performance Trends */}
            <PerformanceTrendsSection studentId={student.id} />
          </div>
        )}

        {/* ─── Finance Tab ───────────────────────────────── */}
        {activeTab === 3 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium">Finance Module</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Coming in Phase 5. Fee management, billing, and payment tracking.
            </p>
          </div>
        )}

        {/* ─── Attendance Tab ────────────────────────────── */}
        {activeTab === 4 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium">Attendance Module</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Coming in Phase 4. Daily attendance tracking and reporting.
            </p>
          </div>
        )}
      </div>

      {/* ─── Enrollment Modal ─────────────────────────────────── */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Enroll / Transfer Student</h2>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleEnroll} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Academic Year</label>
                <select
                  value={enrollAcademicYearId}
                  onChange={(e) => {
                    setEnrollAcademicYearId(e.target.value);
                    setEnrollClassArmId("");
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select academic year</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name} {ay.isCurrent ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class</label>
                <select
                  value={enrollClassArmId}
                  onChange={(e) => setEnrollClassArmId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select class</option>
                  {Object.entries(classGroups).map(([className, arms]) => (
                    <optgroup key={className} label={className}>
                      {arms.map((arm) => (
                        <option key={arm.id} value={arm.id}>
                          {arm.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !enrollClassArmId}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Enrolling..." : "Enroll Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Guardian Modal ───────────────────────────────────── */}
      {showGuardianModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Add Guardian</h2>
              <button
                onClick={() => setShowGuardianModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleLinkGuardian} className="p-6 space-y-4">
              {guardianFormError && (
                <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                  {guardianFormError}
                </div>
              )}

              {/* Mode Switch */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGuardianMode("link")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    guardianMode === "link"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Link Existing
                </button>
                <button
                  type="button"
                  onClick={() => setGuardianMode("new")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    guardianMode === "new"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Create New
                </button>
              </div>

              {guardianMode === "link" ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Select Guardian</label>
                  <select
                    value={selectedGuardianId}
                    onChange={(e) => setSelectedGuardianId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Choose a guardian</option>
                    {availableGuardians.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.phone})
                        {g.relationship ? ` - ${g.relationship}` : ""}
                      </option>
                    ))}
                  </select>
                  {availableGuardians.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No guardians available to link. Create a new one instead.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newGuardian.firstName}
                        onChange={(e) =>
                          setNewGuardian({ ...newGuardian, firstName: e.target.value })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newGuardian.lastName}
                        onChange={(e) =>
                          setNewGuardian({ ...newGuardian, lastName: e.target.value })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={newGuardian.phone}
                        onChange={(e) =>
                          setNewGuardian({ ...newGuardian, phone: e.target.value })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="e.g. 0241234567"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Alt Phone</label>
                      <input
                        type="tel"
                        value={newGuardian.altPhone}
                        onChange={(e) =>
                          setNewGuardian({ ...newGuardian, altPhone: e.target.value })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={newGuardian.email}
                      onChange={(e) =>
                        setNewGuardian({ ...newGuardian, email: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">Relationship</label>
                      <select
                        value={newGuardian.relationship}
                        onChange={(e) =>
                          setNewGuardian({ ...newGuardian, relationship: e.target.value })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Uncle">Uncle</option>
                        <option value="Aunt">Aunt</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Grandparent">Grandparent</option>
                        <option value="Guardian">Guardian</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Occupation</label>
                      <input
                        type="text"
                        value={newGuardian.occupation}
                        onChange={(e) =>
                          setNewGuardian({ ...newGuardian, occupation: e.target.value })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Address</label>
                    <textarea
                      value={newGuardian.address}
                      onChange={(e) =>
                        setNewGuardian({ ...newGuardian, address: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={guardianIsPrimary}
                  onChange={(e) => setGuardianIsPrimary(e.target.checked)}
                  className="rounded border-input"
                />
                <label htmlFor="isPrimary" className="text-sm">
                  Set as primary guardian
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowGuardianModal(false)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending
                    ? "Saving..."
                    : guardianMode === "link"
                      ? "Link Guardian"
                      : "Create & Link Guardian"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Status Modal ─────────────────────────────────────── */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Change Student Status</h2>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleStatusUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                  <option value="TRANSFERRED">Transferred</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="GRADUATED">Graduated</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Updating..." : "Update Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Helper ─────────────────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || "---"}</dd>
    </div>
  );
}

// ─── Performance Trends Section ──────────────────────────────────────

function PerformanceTrendsSection({ studentId }: { studentId: string }) {
  const [trends, setTrends] = useState<Array<{
    termName: string;
    termNumber: number;
    academicYear: string;
    averageScore: number | null;
    position: number | null;
    overallGrade: string | null;
  }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function loadTrends() {
    startTransition(async () => {
      const result = await getStudentPerformanceTrendsAction(studentId);
      if ("data" in result && result.data) {
        setTrends(result.data);
      }
      setLoaded(true);
    });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Performance Trends</h3>
        {!loaded && (
          <button
            onClick={loadTrends}
            disabled={isPending}
            className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load Trends"}
          </button>
        )}
      </div>

      {loaded && trends.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No performance data available yet.</p>
      )}

      {trends.length > 0 && (
        <div className="space-y-4">
          {/* Visual bar chart */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="space-y-3">
              {trends.map((t, i) => {
                const score = t.averageScore ?? 0;
                const barColor = score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-blue-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-muted-foreground truncate" title={`${t.academicYear} - ${t.termName}`}>
                      {t.academicYear} {t.termName}
                    </div>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                    <div className="w-20 text-right text-sm font-medium">
                      {score.toFixed(1)}% <span className="text-xs text-muted-foreground">({t.overallGrade ?? "-"})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trends table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Term</th>
                <th className="px-3 py-2 text-right font-medium">Average</th>
                <th className="px-3 py-2 text-right font-medium">Grade</th>
                <th className="px-3 py-2 text-right font-medium">Position</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((t, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2">{t.academicYear} - {t.termName}</td>
                  <td className="px-3 py-2 text-right font-medium">{t.averageScore?.toFixed(1) ?? "-"}</td>
                  <td className="px-3 py-2 text-right">{t.overallGrade ?? "-"}</td>
                  <td className="px-3 py-2 text-right">{t.position ? `${t.position}${getOrdinal(t.position)}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
