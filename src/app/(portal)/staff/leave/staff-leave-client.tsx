"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestMyLeaveAction } from "@/modules/hr/actions/self-service.action";

interface Props {
  leaveBalances: { id: string; leaveTypeName: string; totalDays: number; usedDays: number; remainingDays: number }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leaveRequests: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leaveTypes: any[];
  gender: string;
}

export function StaffLeaveClient({ leaveBalances, leaveRequests, leaveTypes, gender }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
  const [message, setMessage] = useState("");

  function handleSubmit() {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) {
      setMessage("Please fill all required fields.");
      return;
    }
    startTransition(async () => {
      const res = await requestMyLeaveAction(form);
      if ("error" in res) {
        setMessage(res.error as string);
      } else {
        setMessage("Leave request submitted successfully!");
        setShowForm(false);
        setForm({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
        router.refresh();
      }
    });
  }

  const applicableTypes = leaveTypes.filter(
    (lt) => lt.status === "ACTIVE" && (!lt.applicableGender || lt.applicableGender === gender),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">My Leave</h2>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
          {showForm ? "Cancel" : "Request Leave"}
        </button>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.includes("success") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      )}

      {/* Leave Balances */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {leaveBalances.map((lb) => (
          <div key={lb.id} className="rounded-lg border bg-white p-4">
            <p className="text-sm font-medium text-gray-600">{lb.leaveTypeName}</p>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span>Total: {lb.totalDays}</span>
              <span>Used: {lb.usedDays}</span>
              <span className="font-bold text-teal-600">Left: {lb.remainingDays}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Leave Request Form */}
      {showForm && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="font-semibold">New Leave Request</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Leave Type</label>
            <select value={form.leaveTypeId} onChange={(e) => setForm((p) => ({ ...p, leaveTypeId: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">Select type</option>
              {applicableTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>{lt.name} ({lt.defaultDays} days)</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason (optional)</label>
            <textarea value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm" rows={2} />
          </div>
          <button onClick={handleSubmit} disabled={isPending}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
            {isPending ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      )}

      {/* Leave History */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="p-4 border-b"><h3 className="font-semibold text-sm">Leave History</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Start</th>
                <th className="px-4 py-3 text-left font-medium">End</th>
                <th className="px-4 py-3 text-center font-medium">Days</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No leave requests.</td></tr>
              ) : (
                leaveRequests.map((lr) => (
                  <tr key={lr.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{lr.leaveTypeName}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(lr.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(lr.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-3 text-center">{lr.daysRequested}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        lr.status === "APPROVED" ? "bg-green-100 text-green-700" :
                        lr.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                        lr.status === "REJECTED" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>{lr.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
