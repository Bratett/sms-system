"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  reviewApplicationAction,
  enrollApplicationAction,
} from "@/modules/admissions/actions/admission.action";
import { formatDate } from "@/lib/utils";

interface ApplicationDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
}

interface Application {
  id: string;
  applicationNumber: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  dateOfBirth: Date;
  gender: string;
  previousSchool: string | null;
  jhsIndexNumber: string | null;
  jhsAggregate: number | null;
  programmePreference1Id: string | null;
  programmePreference1Name: string | null;
  programmePreference2Id: string | null;
  programmePreference2Name: string | null;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string | null;
  guardianRelationship: string | null;
  guardianAddress: string | null;
  guardianOccupation: string | null;
  boardingStatus: string;
  applicationType: string;
  applicationSource: string;
  beceIndexNumber: string | null;
  enrollmentCode: string | null;
  placementSchoolCode: string | null;
  status: string;
  notes: string | null;
  submittedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  enrolledStudentId: string | null;
  documents: ApplicationDocument[];
}

interface ClassArmOption {
  id: string;
  label: string;
}

interface Programme {
  id: string;
  name: string;
}

interface ApplicationDetailProps {
  application: Application;
  classArmOptions: ClassArmOption[];
  programmes: Programme[];
}

export function ApplicationDetail({
  application,
  classArmOptions,
}: ApplicationDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Review panel state
  const [reviewNotes, setReviewNotes] = useState("");

  // Enrollment panel state
  const [selectedClassArmId, setSelectedClassArmId] = useState("");

  const canReview =
    application.status === "SUBMITTED" || application.status === "UNDER_REVIEW";
  const canEnroll = application.status === "ACCEPTED";

  function handleReview(status: "ACCEPTED" | "REJECTED" | "UNDER_REVIEW" | "SHORTLISTED") {
    startTransition(async () => {
      const result = await reviewApplicationAction(application.id, {
        status,
        notes: reviewNotes,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Application ${status.toLowerCase().replace("_", " ")} successfully.`);
        router.refresh();
      }
    });
  }

  function handleEnroll() {
    if (!selectedClassArmId) {
      toast.error("Please select a class arm.");
      return;
    }
    startTransition(async () => {
      const result = await enrollApplicationAction(application.id, selectedClassArmId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Student enrolled successfully.");
        router.refresh();
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      {/* Application Header */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">
                {application.firstName} {application.lastName}
                {application.otherNames ? ` ${application.otherNames}` : ""}
              </h2>
              <StatusBadge status={application.status} />
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  application.applicationType === "PLACEMENT"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {application.applicationType === "PLACEMENT" ? "Placement" : "Standard"}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  application.applicationSource === "PORTAL"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {application.applicationSource === "PORTAL" ? "Online Portal" : "Staff Entry"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground font-mono">
              {application.applicationNumber}
            </p>
          </div>
          {application.enrolledStudentId && (
            <div className="text-sm text-muted-foreground">
              Enrolled Student ID: {application.enrolledStudentId}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left side - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Applicant Info */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">Applicant Information</h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Full Name</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {application.firstName} {application.lastName}
                  {application.otherNames ? ` ${application.otherNames}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Date of Birth</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {formatDate(application.dateOfBirth)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Gender</dt>
                <dd className="mt-0.5 text-sm font-medium">{application.gender}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Previous School</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {application.previousSchool || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">JHS Index Number</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {application.jhsIndexNumber || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">JHS Aggregate</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {application.jhsAggregate ?? "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Boarding Status</dt>
                <dd className="mt-0.5 text-sm font-medium">{application.boardingStatus}</dd>
              </div>
            </dl>
          </div>

          {/* Placement Details (only shown for placement applications) */}
          {application.applicationType === "PLACEMENT" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
              <h3 className="text-lg font-semibold mb-4 text-amber-900">
                CSSPS Placement Details
              </h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-amber-700">BECE Index Number</dt>
                  <dd className="mt-0.5 text-sm font-medium font-mono">
                    {application.beceIndexNumber || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-amber-700">Enrollment Code</dt>
                  <dd className="mt-0.5 text-sm font-medium font-mono">
                    {application.enrollmentCode || "-"}
                  </dd>
                </div>
                {application.placementSchoolCode && (
                  <div>
                    <dt className="text-sm text-amber-700">Placement School Code</dt>
                    <dd className="mt-0.5 text-sm font-medium font-mono">
                      {application.placementSchoolCode}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Programme Preferences */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">Programme Preferences</h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">First Choice</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {application.programmePreference1Name || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Second Choice</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {application.programmePreference2Name || "-"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Guardian Info */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">Guardian Information</h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Name</dt>
                <dd className="mt-0.5 text-sm font-medium">{application.guardianName}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Phone</dt>
                <dd className="mt-0.5 text-sm font-medium">{application.guardianPhone}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {application.guardianEmail || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Relationship</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {application.guardianRelationship || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Address</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {application.guardianAddress || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Occupation</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {application.guardianOccupation || "-"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Notes */}
          {application.notes && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {application.notes}
              </p>
            </div>
          )}

          {/* Documents */}
          {application.documents.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Documents</h3>
              <div className="space-y-2">
                {application.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{doc.documentType}</p>
                      <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right side - Actions */}
        <div className="space-y-6">
          {/* Review History */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">Application Timeline</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-muted-foreground">Submitted</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {formatDate(application.submittedAt)}
                </dd>
              </div>
              {application.reviewedAt && (
                <div>
                  <dt className="text-sm text-muted-foreground">Reviewed</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {formatDate(application.reviewedAt)}
                  </dd>
                </div>
              )}
              {application.reviewedBy && (
                <div>
                  <dt className="text-sm text-muted-foreground">Reviewed By</dt>
                  <dd className="mt-0.5 text-sm font-medium">{application.reviewedBy}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-muted-foreground">Current Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={application.status} />
                </dd>
              </div>
            </dl>
          </div>

          {/* Review Panel */}
          {canReview && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Review Application</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Review Notes</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className={`${inputClass} min-h-[80px]`}
                    placeholder="Add review notes..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleReview("ACCEPTED")}
                    disabled={isPending}
                    className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleReview("REJECTED")}
                    disabled={isPending}
                    className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleReview("SHORTLISTED")}
                    disabled={isPending}
                    className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Shortlist
                  </button>
                  <button
                    onClick={() => handleReview("UNDER_REVIEW")}
                    disabled={isPending}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Under Review
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Enrollment Panel */}
          {canEnroll && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <h3 className="text-lg font-semibold mb-4 text-green-900">
                Enroll Student
              </h3>
              <p className="mb-4 text-sm text-green-800">
                This application has been accepted. Select a class arm to enroll the
                student.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-green-900">
                    Class Arm <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={selectedClassArmId}
                    onChange={(e) => setSelectedClassArmId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select class arm</option>
                    {classArmOptions.map((ca) => (
                      <option key={ca.id} value={ca.id}>
                        {ca.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleEnroll}
                  disabled={isPending || !selectedClassArmId}
                  className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isPending ? "Enrolling..." : "Enroll Student"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
