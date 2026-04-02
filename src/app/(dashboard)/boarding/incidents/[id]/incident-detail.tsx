"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  updateIncidentAction,
  escalateIncidentAction,
} from "@/modules/boarding/actions/incident.action";

// ─── Types ──────────────────────────────────────────────────────────

interface StudentInfo {
  id: string;
  name: string;
  studentNumber: string;
}

interface IncidentData {
  id: string;
  incidentNumber: string;
  schoolId: string;
  hostelId: string;
  hostelName: string;
  dormitoryId: string | null;
  dormitoryName: string | null;
  studentIds: string[];
  students: StudentInfo[];
  reportedBy: string;
  reporterName: string;
  date: Date;
  time: string | null;
  category: string;
  severity: string;
  title: string;
  description: string;
  actionTaken: string | null;
  status: string;
  resolvedBy: string | null;
  resolverName: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
  linkedDisciplineId: string | null;
  parentNotified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Helpers ────────────────────────────────────────────────────────

function getSeverityBadgeClass(severity: string) {
  const map: Record<string, string> = {
    MINOR: "bg-gray-100 text-gray-700",
    MODERATE: "bg-yellow-100 text-yellow-700",
    MAJOR: "bg-orange-100 text-orange-700",
    CRITICAL: "bg-red-100 text-red-700",
  };
  return map[severity] ?? "bg-gray-100 text-gray-700";
}

function getStatusBadgeClass(status: string) {
  const map: Record<string, string> = {
    REPORTED: "bg-yellow-100 text-yellow-700",
    INVESTIGATING: "bg-blue-100 text-blue-700",
    ACTION_TAKEN: "bg-purple-100 text-purple-700",
    RESOLVED: "bg-green-100 text-green-700",
    ESCALATED: "bg-red-100 text-red-700",
    DISMISSED: "bg-gray-100 text-gray-500",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

function formatCategory(category: string) {
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

// ─── Component ──────────────────────────────────────────────────────

export function IncidentDetail({ incident }: { incident: IncidentData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [resolution, setResolution] = useState("");

  // ─── Status Update ──────────────────────────────────────────────

  function handleUpdateStatus() {
    if (!newStatus) {
      toast.error("Please select a status.");
      return;
    }

    startTransition(async () => {
      const result = await updateIncidentAction(incident.id, {
        status: newStatus,
        actionTaken: actionTaken || undefined,
        resolution: resolution || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Incident status updated.");
        setShowStatusModal(false);
        setNewStatus("");
        setActionTaken("");
        setResolution("");
        router.refresh();
      }
    });
  }

  // ─── Escalate ───────────────────────────────────────────────────

  function handleEscalate() {
    startTransition(async () => {
      const result = await escalateIncidentAction(incident.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Incident escalated to discipline module.");
        router.refresh();
      }
    });
  }

  const canUpdateStatus =
    incident.status !== "RESOLVED" &&
    incident.status !== "ESCALATED" &&
    incident.status !== "DISMISSED";

  const canEscalate =
    incident.status !== "RESOLVED" &&
    incident.status !== "ESCALATED" &&
    incident.status !== "DISMISSED";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header Info */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{incident.incidentNumber}</h2>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClass(
                  incident.status,
                )}`}
              >
                {incident.status.replace(/_/g, " ")}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getSeverityBadgeClass(
                  incident.severity,
                )}`}
              >
                {incident.severity}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Reported on {formatDateTime(incident.createdAt)} by {incident.reporterName}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {canUpdateStatus && (
              <button
                onClick={() => setShowStatusModal(true)}
                disabled={isPending}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Update Status
              </button>
            )}
            {canEscalate && (
              <button
                onClick={handleEscalate}
                disabled={isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Escalate to Discipline
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Incident Details */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold mb-3">Incident Details</h3>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Title</p>
            <p className="text-sm font-medium mt-0.5">{incident.title}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Description</p>
            <p className="text-sm mt-1 whitespace-pre-wrap">{incident.description}</p>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="text-sm font-medium">{formatDate(incident.date)}</p>
              {incident.time && (
                <p className="text-xs text-muted-foreground">{incident.time}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="text-sm font-medium">{formatCategory(incident.category)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Severity</p>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSeverityBadgeClass(
                  incident.severity,
                )}`}
              >
                {incident.severity}
              </span>
            </div>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Hostel</p>
              <p className="text-sm font-medium">{incident.hostelName}</p>
            </div>
            {incident.dormitoryName && (
              <div>
                <p className="text-xs text-muted-foreground">Dormitory</p>
                <p className="text-sm font-medium">{incident.dormitoryName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Parent Notified</p>
              <p className="text-sm font-medium">{incident.parentNotified ? "Yes" : "No"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Students Involved */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold mb-3">Students Involved</h3>
        {incident.students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students linked.</p>
        ) : (
          <div className="space-y-2">
            {incident.students.map((student) => (
              <div
                key={student.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{student.name}</p>
                  <p className="text-xs text-muted-foreground">{student.studentNumber}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Taken & Resolution */}
      {(incident.actionTaken || incident.resolution) && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="font-semibold mb-3">Actions & Resolution</h3>
          <div className="space-y-4">
            {incident.actionTaken && (
              <div>
                <p className="text-xs text-muted-foreground">Action Taken</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{incident.actionTaken}</p>
              </div>
            )}
            {incident.resolution && (
              <div>
                <p className="text-xs text-muted-foreground">Resolution</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{incident.resolution}</p>
              </div>
            )}
            {incident.resolverName && (
              <div className="grid gap-3 grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Resolved By</p>
                  <p className="text-sm font-medium">{incident.resolverName}</p>
                </div>
                {incident.resolvedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Resolved At</p>
                    <p className="text-sm font-medium">{formatDateTime(incident.resolvedAt)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Linked Discipline Record */}
      {incident.linkedDisciplineId && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h3 className="font-semibold mb-2 text-red-800">Escalated to Discipline</h3>
          <p className="text-sm text-red-700">
            This incident has been escalated to the discipline module.
          </p>
          <p className="text-sm text-red-700 mt-1">
            Discipline Record ID:{" "}
            <span className="font-mono font-medium">{incident.linkedDisciplineId}</span>
          </p>
        </div>
      )}

      {/* ─── Status Update Modal ──────────────────────────────────── */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Update Incident Status</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select status</option>
                  {incident.status === "REPORTED" && (
                    <option value="INVESTIGATING">Investigating</option>
                  )}
                  {(incident.status === "REPORTED" || incident.status === "INVESTIGATING") && (
                    <option value="ACTION_TAKEN">Action Taken</option>
                  )}
                  {(incident.status === "INVESTIGATING" || incident.status === "ACTION_TAKEN") && (
                    <option value="RESOLVED">Resolved</option>
                  )}
                  <option value="DISMISSED">Dismissed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Action Taken (optional)
                </label>
                <textarea
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Describe action taken..."
                />
              </div>

              {(newStatus === "RESOLVED" || newStatus === "DISMISSED") && (
                <div>
                  <label className="block text-sm font-medium mb-1">Resolution</label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Resolution details..."
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setNewStatus("");
                  setActionTaken("");
                  setResolution("");
                }}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={isPending || !newStatus}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Updating..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
