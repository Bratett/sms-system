"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  getSickBayAdmissionAction,
  dischargeSickBayAction,
  referSickBayAction,
  updateSickBayAdmissionAction,
  addMedicationLogAction,
} from "@/modules/boarding/actions/sick-bay.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Medication {
  id: string;
  medicationName: string;
  dosage: string;
  administeredBy: string;
  administeredAt: Date;
  notes: string | null;
}

interface Admission {
  id: string;
  admissionNumber: string;
  student: {
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
    boardingStatus: string;
    photoUrl: string | null;
  } | null;
  hostel: { id: string; name: string } | null;
  admittedBy: string;
  admittedAt: Date;
  symptoms: string;
  initialDiagnosis: string | null;
  temperature: number | null;
  severity: string;
  status: string;
  treatmentNotes: string | null;
  dischargedBy: string | null;
  dischargedAt: Date | null;
  dischargeNotes: string | null;
  referredTo: string | null;
  parentNotified: boolean;
  medications: Medication[];
}

// ─── Badge Helpers ──────────────────────────────────────────────────

function getSeverityBadge(severity: string) {
  const map: Record<string, string> = {
    MILD: "bg-green-100 text-green-700",
    MODERATE: "bg-yellow-100 text-yellow-700",
    SEVERE: "bg-orange-100 text-orange-700",
    EMERGENCY: "bg-red-100 text-red-700",
  };
  return map[severity] ?? "bg-gray-100 text-gray-700";
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    ADMITTED: "bg-blue-100 text-blue-700",
    UNDER_OBSERVATION: "bg-yellow-100 text-yellow-700",
    DISCHARGED: "bg-green-100 text-green-700",
    REFERRED: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

// ─── Component ──────────────────────────────────────────────────────

export default function SickBayDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isPending, startTransition] = useTransition();
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Medication form
  const [medForm, setMedForm] = useState({
    medicationName: "",
    dosage: "",
    notes: "",
  });

  // Refer form
  const [showReferForm, setShowReferForm] = useState(false);
  const [referredTo, setReferredTo] = useState("");
  const [referNotes, setReferNotes] = useState("");

  useEffect(() => {
    loadAdmission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function loadAdmission() {
    startTransition(async () => {
      setLoading(true);
      const result = await getSickBayAdmissionAction(id);
      if (result.error || !result.data) {
        setError(result.error || "Admission not found.");
      } else {
        setAdmission(result.data);
      }
      setLoading(false);
    });
  }

  function formatDateTime(date: Date | string) {
    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ─── Actions ────────────────────────────────────────────────────

  function handleDischarge() {
    const notes = prompt("Discharge notes (optional):");
    startTransition(async () => {
      const result = await dischargeSickBayAction(id, notes || undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Student discharged from sick bay.");
        loadAdmission();
      }
    });
  }

  function handleRefer() {
    if (!referredTo.trim()) {
      toast.error("Please enter the referral destination.");
      return;
    }
    startTransition(async () => {
      const result = await referSickBayAction(id, referredTo, referNotes || undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Student referred successfully.");
        setShowReferForm(false);
        setReferredTo("");
        setReferNotes("");
        loadAdmission();
      }
    });
  }

  function handleUpdateStatus(status: "ADMITTED" | "UNDER_OBSERVATION") {
    startTransition(async () => {
      const result = await updateSickBayAdmissionAction(id, { status });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Status updated to ${status.replace(/_/g, " ")}.`);
        loadAdmission();
      }
    });
  }

  function handleAddMedication() {
    if (!medForm.medicationName.trim()) {
      toast.error("Medication name is required.");
      return;
    }
    if (!medForm.dosage.trim()) {
      toast.error("Dosage is required.");
      return;
    }

    startTransition(async () => {
      const result = await addMedicationLogAction({
        sickBayAdmissionId: id,
        medicationName: medForm.medicationName,
        dosage: medForm.dosage,
        notes: medForm.notes || undefined,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Medication logged.");
        setMedForm({ medicationName: "", dosage: "", notes: "" });
        loadAdmission();
      }
    });
  }

  // ─── Loading / Error States ─────────────────────────────────────

  if (loading && !admission) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/boarding/sick-bay" className="text-primary hover:underline text-sm">
            Back to Sick Bay
          </Link>
        </div>
        <p className="text-muted-foreground">Loading admission details...</p>
      </div>
    );
  }

  if (error || !admission) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admission Not Found</h1>
        <p className="text-muted-foreground">
          {error || "The sick bay admission could not be found."}
        </p>
        <Link href="/boarding/sick-bay" className="text-primary hover:underline text-sm">
          Back to Sick Bay
        </Link>
      </div>
    );
  }

  const isActive = admission.status === "ADMITTED" || admission.status === "UNDER_OBSERVATION";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admission {admission.admissionNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Sick bay admission details and medication log.
          </p>
        </div>
        <Link
          href="/boarding/sick-bay"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Back to Sick Bay
        </Link>
      </div>

      {/* Admission Details Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Admission Details</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Student</p>
            <p className="text-sm font-medium">
              {admission.student
                ? `${admission.student.firstName} ${admission.student.lastName}`
                : "Unknown"}
            </p>
            {admission.student && (
              <p className="text-xs text-muted-foreground">{admission.student.studentId}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Hostel</p>
            <p className="text-sm font-medium">{admission.hostel?.name ?? "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Admitted By</p>
            <p className="text-sm font-medium">{admission.admittedBy}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Admitted At</p>
            <p className="text-sm font-medium">{formatDateTime(admission.admittedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Severity</p>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSeverityBadge(admission.severity)}`}
            >
              {admission.severity}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(admission.status)}`}
            >
              {admission.status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-xs text-muted-foreground">Symptoms</p>
            <p className="text-sm">{admission.symptoms}</p>
          </div>
          {admission.initialDiagnosis && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Initial Diagnosis</p>
              <p className="text-sm">{admission.initialDiagnosis}</p>
            </div>
          )}
          {admission.temperature !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Temperature</p>
              <p className="text-sm font-medium">{admission.temperature} C</p>
            </div>
          )}
          {admission.treatmentNotes && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Treatment Notes</p>
              <p className="text-sm">{admission.treatmentNotes}</p>
            </div>
          )}
          {admission.dischargedAt && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Discharged At</p>
                <p className="text-sm font-medium">{formatDateTime(admission.dischargedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Discharged By</p>
                <p className="text-sm font-medium">{admission.dischargedBy ?? "---"}</p>
              </div>
            </>
          )}
          {admission.dischargeNotes && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Discharge Notes</p>
              <p className="text-sm">{admission.dischargeNotes}</p>
            </div>
          )}
          {admission.referredTo && (
            <div>
              <p className="text-xs text-muted-foreground">Referred To</p>
              <p className="text-sm font-medium">{admission.referredTo}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Parent Notified</p>
            <p className="text-sm font-medium">{admission.parentNotified ? "Yes" : "No"}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {isActive && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDischarge}
            disabled={isPending}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Discharge
          </button>
          <button
            onClick={() => setShowReferForm(!showReferForm)}
            disabled={isPending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Refer
          </button>
          {admission.status === "ADMITTED" && (
            <button
              onClick={() => handleUpdateStatus("UNDER_OBSERVATION")}
              disabled={isPending}
              className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
            >
              Move to Observation
            </button>
          )}
          {admission.status === "UNDER_OBSERVATION" && (
            <button
              onClick={() => handleUpdateStatus("ADMITTED")}
              disabled={isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Move to Admitted
            </button>
          )}
        </div>
      )}

      {/* Refer Form (inline) */}
      {showReferForm && isActive && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Referral Details</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Referred To</label>
            <input
              type="text"
              value={referredTo}
              onChange={(e) => setReferredTo(e.target.value)}
              className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Hospital, clinic, or specialist..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <textarea
              value={referNotes}
              onChange={(e) => setReferNotes(e.target.value)}
              className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={2}
              placeholder="Referral notes..."
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefer}
              disabled={isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? "Referring..." : "Confirm Referral"}
            </button>
            <button
              onClick={() => {
                setShowReferForm(false);
                setReferredTo("");
                setReferNotes("");
              }}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Medication Log */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">
          Medication Log ({admission.medications.length})
        </h2>

        {admission.medications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No medications recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {admission.medications.map((med) => (
              <div
                key={med.id}
                className="flex items-start gap-3 rounded-md border border-border p-3"
              >
                <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{med.medicationName}</p>
                    <span className="text-xs text-muted-foreground">({med.dosage})</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    By {med.administeredBy} at {formatDateTime(med.administeredAt)}
                  </p>
                  {med.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{med.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Medication Form */}
        {isActive && (
          <div className="mt-6 border-t border-border pt-4 space-y-3">
            <h3 className="text-sm font-semibold">Add Medication</h3>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1">Medication Name</label>
                <input
                  type="text"
                  value={medForm.medicationName}
                  onChange={(e) =>
                    setMedForm((p) => ({ ...p, medicationName: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Paracetamol"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Dosage</label>
                <input
                  type="text"
                  value={medForm.dosage}
                  onChange={(e) =>
                    setMedForm((p) => ({ ...p, dosage: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. 500mg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes (optional)</label>
              <input
                type="text"
                value={medForm.notes}
                onChange={(e) => setMedForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Additional notes..."
              />
            </div>
            <button
              onClick={handleAddMedication}
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Adding..." : "Add Medication"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
