"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { GHANA_REGIONS } from "@/lib/constants";
import { updateStaffAction, terminateStaffAction } from "@/modules/hr/actions/staff.action";
import { requestLeaveAction } from "@/modules/hr/actions/leave.action";
import { getStaffDocumentsAction, deleteStaffDocumentAction } from "@/modules/hr/actions/staff-documents.action";
import { getStaffContractsAction, renewContractAction } from "@/modules/hr/actions/contract.action";
import { getPromotionHistoryAction } from "@/modules/hr/actions/promotion.action";
import { getClassesTaughtByStaffAction } from "@/modules/academics/actions/class.action";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────

interface Employment {
  id: string;
  position: string;
  rank: string | null;
  departmentId: string | null;
  departmentName: string | null;
  startDate: Date;
  endDate: Date | null;
  appointmentType: string;
  salaryGrade: string | null;
  status: string;
}

interface LeaveBalance {
  id: string;
  leaveTypeName: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  requiresApproval: boolean;
  applicableGender: string | null;
  status: string;
}

interface LeaveRequestRow {
  id: string;
  staffId: string;
  staffName: string;
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  reason: string | null;
  status: string;
  appliedAt: Date;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

interface StaffData {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  dateOfBirth: Date | null;
  gender: string;
  phone: string;
  email: string | null;
  address: string | null;
  region: string | null;
  ghanaCardNumber: string | null;
  ssnitNumber: string | null;
  tinNumber: string | null;
  staffType: string;
  specialization: string | null;
  qualifications: { degree: string; institution: string; year?: string }[] | null;
  dateOfFirstAppointment: Date | null;
  dateOfPostingToSchool: Date | null;
  photoUrl: string | null;
  status: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  employments: Employment[];
  leaveBalances: LeaveBalance[];
  user: { id: string; username: string; email: string | null; status: string } | null;
}

interface DepartmentOption {
  id: string;
  name: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function StaffProfile({
  staff,
  departments,
  leaveTypes,
  leaveRequests,
}: {
  staff: StaffData;
  departments: DepartmentOption[];
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequestRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState(0);

  // Edit personal info
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    firstName: staff.firstName,
    lastName: staff.lastName,
    otherNames: staff.otherNames || "",
    dateOfBirth: staff.dateOfBirth
      ? new Date(staff.dateOfBirth).toISOString().split("T")[0]
      : "",
    gender: staff.gender,
    phone: staff.phone,
    email: staff.email || "",
    address: staff.address || "",
    region: staff.region || "",
    ghanaCardNumber: staff.ghanaCardNumber || "",
    ssnitNumber: staff.ssnitNumber || "",
    tinNumber: staff.tinNumber || "",
    specialization: staff.specialization || "",
  });

  // Terminate modal
  const [showTerminate, setShowTerminate] = useState(false);
  const [terminateData, setTerminateData] = useState({
    reason: "",
    endDate: "",
    type: "TERMINATED" as "TERMINATED" | "RETIRED" | "TRANSFERRED",
  });

  // Leave request modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveData, setLeaveData] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  // Dynamic data for new tabs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [documents, setDocuments] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contracts, setContracts] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [promotions, setPromotions] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [classesTaught, setClassesTaught] = useState<any[]>([]);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [contractsLoaded, setContractsLoaded] = useState(false);
  const [promotionsLoaded, setPromotionsLoaded] = useState(false);
  const [classesLoaded, setClassesLoaded] = useState(false);

  const tabs = [
    { title: "Personal Info", index: 0 },
    { title: "Employment", index: 1 },
    { title: "Qualifications", index: 2 },
    { title: "Leave", index: 3 },
    { title: "Documents", index: 4 },
    { title: "Contracts", index: 5 },
    { title: "Promotions", index: 6 },
    { title: "Classes Taught", index: 7 },
  ];

  function loadTabData(tabIndex: number) {
    setActiveTab(tabIndex);
    if (tabIndex === 4 && !docsLoaded) {
      startTransition(async () => {
        const res = await getStaffDocumentsAction(staff.id);
        if ("error" in res) toast.error(res.error);
        else if (res.data) setDocuments(res.data);
        setDocsLoaded(true);
      });
    }
    if (tabIndex === 5 && !contractsLoaded) {
      startTransition(async () => {
        const res = await getStaffContractsAction(staff.id);
        if ("error" in res) toast.error(res.error);
        else if (res.data) setContracts(res.data);
        setContractsLoaded(true);
      });
    }
    if (tabIndex === 6 && !promotionsLoaded) {
      startTransition(async () => {
        const res = await getPromotionHistoryAction(staff.id);
        if ("error" in res) toast.error(res.error);
        else if (res.data) setPromotions(res.data);
        setPromotionsLoaded(true);
      });
    }
    if (tabIndex === 7 && !classesLoaded) {
      startTransition(async () => {
        const res = await getClassesTaughtByStaffAction(staff.id);
        if ("error" in res) toast.error(res.error);
        else if (res.data) setClassesTaught(res.data);
        setClassesLoaded(true);
      });
    }
  }

  function handleSavePersonal() {
    startTransition(async () => {
      const result = await updateStaffAction(staff.id, {
        firstName: editData.firstName,
        lastName: editData.lastName,
        otherNames: editData.otherNames || undefined,
        dateOfBirth: editData.dateOfBirth || undefined,
        gender: editData.gender as "MALE" | "FEMALE",
        phone: editData.phone,
        email: editData.email || undefined,
        address: editData.address || undefined,
        region: editData.region || undefined,
        ghanaCardNumber: editData.ghanaCardNumber || undefined,
        ssnitNumber: editData.ssnitNumber || undefined,
        tinNumber: editData.tinNumber || undefined,
        specialization: editData.specialization || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Staff profile updated successfully.");
        setIsEditing(false);
        router.refresh();
      }
    });
  }

  function handleTerminate() {
    if (!terminateData.reason || !terminateData.endDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    startTransition(async () => {
      const result = await terminateStaffAction(staff.id, {
        reason: terminateData.reason,
        endDate: terminateData.endDate,
        type: terminateData.type,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Staff status updated successfully.");
        setShowTerminate(false);
        router.refresh();
      }
    });
  }

  function handleRequestLeave() {
    if (!leaveData.leaveTypeId || !leaveData.startDate || !leaveData.endDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    startTransition(async () => {
      const result = await requestLeaveAction({
        staffId: staff.id,
        leaveTypeId: leaveData.leaveTypeId,
        startDate: leaveData.startDate,
        endDate: leaveData.endDate,
        reason: leaveData.reason || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Leave request submitted successfully.");
        setShowLeaveModal(false);
        setLeaveData({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
        router.refresh();
      }
    });
  }

  function formatDate(date: Date | string | null) {
    if (!date) return "---";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div>
      {/* Status Bar */}
      <div className="mb-4 flex items-center gap-3">
        <StatusBadge status={staff.status} />
        <StatusBadge
          status={staff.staffType}
          className={
            staff.staffType === "TEACHING"
              ? "bg-blue-100 text-blue-700"
              : "bg-purple-100 text-purple-700"
          }
        />
        {staff.user && (
          <span className="text-xs text-muted-foreground">
            Login: {staff.user.username} ({staff.user.status})
          </span>
        )}
        {staff.status === "ACTIVE" && (
          <button
            onClick={() => setShowTerminate(true)}
            className="ml-auto text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Terminate / Retire
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.index}
            type="button"
            onClick={() => loadTabData(tab.index)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.index
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.title}
          </button>
        ))}
      </div>

      {/* Tab 1: Personal Info */}
      {activeTab === 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Personal Information</h3>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-primary hover:text-primary/80 font-medium"
              >
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePersonal}
                  disabled={isPending}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>

          {!isEditing ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField label="First Name" value={staff.firstName} />
              <InfoField label="Last Name" value={staff.lastName} />
              <InfoField label="Other Names" value={staff.otherNames} />
              <InfoField label="Date of Birth" value={formatDate(staff.dateOfBirth)} />
              <InfoField label="Gender" value={staff.gender} />
              <InfoField label="Phone" value={staff.phone} />
              <InfoField label="Email" value={staff.email} />
              <InfoField label="Address" value={staff.address} />
              <InfoField label="Region" value={staff.region} />
              <InfoField label="Ghana Card" value={staff.ghanaCardNumber} />
              <InfoField label="SSNIT No." value={staff.ssnitNumber} />
              <InfoField label="TIN No." value={staff.tinNumber} />
              <InfoField label="Specialization" value={staff.specialization} />
              <InfoField
                label="Date of First Appointment"
                value={formatDate(staff.dateOfFirstAppointment)}
              />
              <InfoField
                label="Date of Posting"
                value={formatDate(staff.dateOfPostingToSchool)}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <EditField
                label="First Name"
                value={editData.firstName}
                onChange={(v) => setEditData((p) => ({ ...p, firstName: v }))}
              />
              <EditField
                label="Last Name"
                value={editData.lastName}
                onChange={(v) => setEditData((p) => ({ ...p, lastName: v }))}
              />
              <EditField
                label="Other Names"
                value={editData.otherNames}
                onChange={(v) => setEditData((p) => ({ ...p, otherNames: v }))}
              />
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={editData.dateOfBirth}
                  onChange={(e) =>
                    setEditData((p) => ({ ...p, dateOfBirth: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Gender
                </label>
                <select
                  value={editData.gender}
                  onChange={(e) => setEditData((p) => ({ ...p, gender: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
              <EditField
                label="Phone"
                value={editData.phone}
                onChange={(v) => setEditData((p) => ({ ...p, phone: v }))}
              />
              <EditField
                label="Email"
                value={editData.email}
                onChange={(v) => setEditData((p) => ({ ...p, email: v }))}
              />
              <EditField
                label="Address"
                value={editData.address}
                onChange={(v) => setEditData((p) => ({ ...p, address: v }))}
              />
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Region
                </label>
                <select
                  value={editData.region}
                  onChange={(e) => setEditData((p) => ({ ...p, region: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">Select region</option>
                  {GHANA_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <EditField
                label="Ghana Card"
                value={editData.ghanaCardNumber}
                onChange={(v) => setEditData((p) => ({ ...p, ghanaCardNumber: v }))}
              />
              <EditField
                label="SSNIT No."
                value={editData.ssnitNumber}
                onChange={(v) => setEditData((p) => ({ ...p, ssnitNumber: v }))}
              />
              <EditField
                label="TIN No."
                value={editData.tinNumber}
                onChange={(v) => setEditData((p) => ({ ...p, tinNumber: v }))}
              />
              <EditField
                label="Specialization"
                value={editData.specialization}
                onChange={(v) => setEditData((p) => ({ ...p, specialization: v }))}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Employment */}
      {activeTab === 1 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Employment History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Position</th>
                  <th className="px-4 py-3 text-left font-medium">Rank</th>
                  <th className="px-4 py-3 text-left font-medium">Department</th>
                  <th className="px-4 py-3 text-center font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Salary Grade</th>
                  <th className="px-4 py-3 text-left font-medium">Start Date</th>
                  <th className="px-4 py-3 text-left font-medium">End Date</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {staff.employments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No employment records found.
                    </td>
                  </tr>
                ) : (
                  staff.employments.map((emp) => (
                    <tr key={emp.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{emp.position}</td>
                      <td className="px-4 py-3 text-muted-foreground">{emp.rank || "---"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {emp.departmentName || "---"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={emp.appointmentType} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {emp.salaryGrade || "---"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(emp.startDate)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(emp.endDate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={emp.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Qualifications */}
      {activeTab === 2 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-semibold mb-4">Qualifications</h3>
          {!staff.qualifications || staff.qualifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No qualifications recorded.</p>
          ) : (
            <div className="space-y-3">
              {staff.qualifications.map((q, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{q.degree}</p>
                    <p className="text-xs text-muted-foreground">{q.institution}</p>
                  </div>
                  {q.year && (
                    <span className="text-xs text-muted-foreground">{q.year}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Leave */}
      {activeTab === 3 && (
        <div className="space-y-6">
          {/* Leave Balances */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Leave Balances</h3>
              <button
                onClick={() => setShowLeaveModal(true)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Request Leave
              </button>
            </div>
            {staff.leaveBalances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No leave balances initialized. Contact administration.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {staff.leaveBalances.map((lb) => (
                  <div
                    key={lb.id}
                    className="rounded-md border border-border px-4 py-3"
                  >
                    <p className="text-sm font-medium">{lb.leaveTypeName}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Total: {lb.totalDays}</span>
                      <span>Used: {lb.usedDays}</span>
                      <span className="font-semibold text-foreground">
                        Remaining: {lb.remainingDays}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leave History */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold">Leave History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Start</th>
                    <th className="px-4 py-3 text-left font-medium">End</th>
                    <th className="px-4 py-3 text-center font-medium">Days</th>
                    <th className="px-4 py-3 text-left font-medium">Reason</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No leave requests found.
                      </td>
                    </tr>
                  ) : (
                    leaveRequests.map((lr) => (
                      <tr key={lr.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">{lr.leaveTypeName}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(lr.startDate)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(lr.endDate)}
                        </td>
                        <td className="px-4 py-3 text-center">{lr.daysRequested}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {lr.reason || "---"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={lr.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Documents */}
      {activeTab === 4 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Staff Documents</h3>
          </div>
          {documents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {isPending ? "Loading documents..." : "No documents uploaded yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Title</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">File</th>
                    <th className="px-4 py-3 text-left font-medium">Uploaded</th>
                    <th className="px-4 py-3 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {documents.map((doc: any) => (
                    <tr key={doc.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{doc.title}</td>
                      <td className="px-4 py-3"><StatusBadge status={doc.category} /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{doc.fileName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            startTransition(async () => {
                              const res = await deleteStaffDocumentAction(doc.id);
                              if ("error" in res) toast.error(res.error);
                              else {
                                toast.success("Document deleted.");
                                setDocuments((prev) => prev.filter((d: { id: string }) => d.id !== doc.id));
                              }
                            });
                          }}
                          disabled={isPending}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Contracts */}
      {activeTab === 5 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Contracts</h3>
          </div>
          {contracts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {isPending ? "Loading contracts..." : "No contracts recorded."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Start</th>
                    <th className="px-4 py-3 text-left font-medium">End</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {contracts.map((c: any) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{c.type.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(c.startDate)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(c.endDate)}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-center">
                        {c.status === "ACTIVE" && c.endDate && (
                          <button
                            onClick={() => {
                              const newEnd = prompt("Enter new end date (YYYY-MM-DD):");
                              if (newEnd) {
                                startTransition(async () => {
                                  const res = await renewContractAction(c.id, { newEndDate: newEnd });
                                  if ("error" in res) toast.error(res.error);
                                  else {
                                    toast.success("Contract renewed.");
                                    setContractsLoaded(false);
                                    loadTabData(5);
                                  }
                                });
                              }
                            }}
                            disabled={isPending}
                            className="text-xs text-primary hover:text-primary/80 font-medium"
                          >
                            Renew
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Classes Taught */}
      {activeTab === 7 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Classes Taught</h3>
          </div>
          {classesTaught.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {isPending ? "Loading classes..." : "No teaching assignments."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Class</th>
                    <th className="px-4 py-3 text-left font-medium">Subject</th>
                    <th className="px-4 py-3 text-left font-medium">Academic Year</th>
                    <th className="px-4 py-3 text-right font-medium">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {classesTaught.map((c: any) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/academics/class-arms/${c.classArmId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {c.className} {c.classArmName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {c.subjectName}
                        {c.subjectCode && (
                          <span className="ml-1 text-xs text-muted-foreground">({c.subjectCode})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.academicYearName}
                        {c.isCurrentYear && (
                          <span className="ml-2 text-xs text-green-700 bg-green-100 dark:bg-green-500/20 dark:text-green-300 px-1.5 rounded">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {c.enrollmentCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Promotions */}
      {activeTab === 6 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Promotion History</h3>
          </div>
          {promotions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {isPending ? "Loading promotions..." : "No promotion records."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Effective Date</th>
                    <th className="px-4 py-3 text-left font-medium">Previous Rank</th>
                    <th className="px-4 py-3 text-left font-medium">New Rank</th>
                    <th className="px-4 py-3 text-left font-medium">New Grade</th>
                    <th className="px-4 py-3 text-left font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {promotions.map((p: any) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{formatDate(p.effectiveDate)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.previousRank || "---"}</td>
                      <td className="px-4 py-3 font-medium">{p.newRank}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.newGrade || "---"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.reason || "---"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Terminate Modal */}
      {showTerminate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">End Employment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={terminateData.type}
                  onChange={(e) =>
                    setTerminateData((p) => ({
                      ...p,
                      type: e.target.value as "TERMINATED" | "RETIRED" | "TRANSFERRED",
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="TERMINATED">Terminated</option>
                  <option value="RETIRED">Retired</option>
                  <option value="TRANSFERRED">Transferred</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={terminateData.endDate}
                  onChange={(e) =>
                    setTerminateData((p) => ({ ...p, endDate: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <textarea
                  value={terminateData.reason}
                  onChange={(e) =>
                    setTerminateData((p) => ({ ...p, reason: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Provide a reason..."
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowTerminate(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleTerminate}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Request Leave</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Leave Type</label>
                <select
                  value={leaveData.leaveTypeId}
                  onChange={(e) =>
                    setLeaveData((p) => ({ ...p, leaveTypeId: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select leave type</option>
                  {leaveTypes
                    .filter(
                      (lt) =>
                        lt.status === "ACTIVE" &&
                        (!lt.applicableGender || lt.applicableGender === staff.gender),
                    )
                    .map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name} ({lt.defaultDays} days)
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={leaveData.startDate}
                    onChange={(e) =>
                      setLeaveData((p) => ({ ...p, startDate: e.target.value }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={leaveData.endDate}
                    onChange={(e) =>
                      setLeaveData((p) => ({ ...p, endDate: e.target.value }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {leaveData.startDate && leaveData.endDate && (
                <p className="text-xs text-muted-foreground">
                  Business days:{" "}
                  {calculateBusinessDays(leaveData.startDate, leaveData.endDate)}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <textarea
                  value={leaveData.reason}
                  onChange={(e) =>
                    setLeaveData((p) => ({ ...p, reason: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Reason for leave..."
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestLeave}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value || "---"}</p>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
      />
    </div>
  );
}

function calculateBusinessDays(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}
