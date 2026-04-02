"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";
import { requestStudentExeatAction, getMyExeatsAction } from "@/modules/portal/actions/student-portal.action";
import { toast } from "sonner";

interface ExeatData {
  id: string;
  exeatNumber: string;
  type: string;
  reason: string;
  departureDate: Date;
  departureTime: string | null;
  expectedReturnDate: Date;
  actualReturnDate: Date | null;
  actualReturnTime: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  status: string;
  requestedAt: Date;
  approvalCount: number;
}

interface ExeatClientProps {
  exeats: ExeatData[];
  isBoardingStudent: boolean;
}

const exeatTypes = [
  { value: "NORMAL", label: "Normal" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "MEDICAL", label: "Medical" },
  { value: "WEEKEND", label: "Weekend" },
  { value: "VACATION", label: "Vacation" },
] as const;

export function ExeatClient({ exeats: initialExeats, isBoardingStudent }: ExeatClientProps) {
  const [exeats, setExeats] = useState(initialExeats);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    reason: "",
    type: "NORMAL" as "NORMAL" | "EMERGENCY" | "MEDICAL" | "WEEKEND" | "VACATION",
    departureDate: "",
    departureTime: "",
    expectedReturnDate: "",
    guardianName: "",
    guardianPhone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.reason || !formData.departureDate || !formData.expectedReturnDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestStudentExeatAction({
        reason: formData.reason,
        type: formData.type,
        departureDate: formData.departureDate,
        departureTime: formData.departureTime || undefined,
        expectedReturnDate: formData.expectedReturnDate,
        guardianName: formData.guardianName || undefined,
        guardianPhone: formData.guardianPhone || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Exeat request ${"data" in result ? result.data?.exeatNumber : ""} submitted successfully.`);
        setShowForm(false);
        setFormData({
          reason: "",
          type: "NORMAL",
          departureDate: "",
          departureTime: "",
          expectedReturnDate: "",
          guardianName: "",
          guardianPhone: "",
        });

        // Refresh exeats list
        const refreshResult = await getMyExeatsAction();
        if ("data" in refreshResult && refreshResult.data) {
          setExeats(refreshResult.data as unknown as ExeatData[]);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isBoardingStudent) {
    return (
      <div className="space-y-6">
        <PageHeader title="Exeat Requests" />
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">Not Available</h3>
          <p className="mt-1 text-sm text-gray-500">
            Exeat requests are only available for boarding students.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exeat Requests"
        description="View and submit exeat requests."
        actions={
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Request Exeat
            </button>
          ) : undefined
        }
      />

      {/* New Exeat Form */}
      {showForm && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900">New Exeat Request</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as typeof formData.type })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {exeatTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Departure Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.departureDate}
                  onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Departure Time</label>
                <input
                  type="time"
                  value={formData.departureTime}
                  onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Expected Return Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.expectedReturnDate}
                  onChange={(e) => setFormData({ ...formData, expectedReturnDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Guardian Name
                </label>
                <input
                  type="text"
                  value={formData.guardianName}
                  onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                  placeholder="Leave blank to use primary guardian"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Guardian Phone
                </label>
                <input
                  type="tel"
                  value={formData.guardianPhone}
                  onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                  placeholder="Leave blank to use primary guardian"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
                placeholder="Please provide a reason for your exeat request..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Exeats List */}
      {exeats.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">No Exeat Requests</h3>
          <p className="mt-1 text-sm text-gray-500">
            You have not submitted any exeat requests yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {exeats.map((exeat) => (
            <div
              key={exeat.id}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {exeat.exeatNumber}
                    </span>
                    <StatusBadge status={exeat.status} />
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {exeat.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{exeat.reason}</p>
                </div>

                <div className="text-right text-sm">
                  <p className="text-gray-500">
                    Departure: <span className="font-medium text-gray-700">{formatDate(exeat.departureDate)}</span>
                    {exeat.departureTime && ` at ${exeat.departureTime}`}
                  </p>
                  <p className="text-gray-500">
                    Return: <span className="font-medium text-gray-700">{formatDate(exeat.expectedReturnDate)}</span>
                  </p>
                  {exeat.actualReturnDate && (
                    <p className="text-green-600">
                      Returned: {formatDate(exeat.actualReturnDate)}
                      {exeat.actualReturnTime && ` at ${exeat.actualReturnTime}`}
                    </p>
                  )}
                </div>
              </div>

              {exeat.guardianName && (
                <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
                  Guardian: {exeat.guardianName}
                  {exeat.guardianPhone && ` (${exeat.guardianPhone})`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
