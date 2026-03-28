"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendSmsAction, sendBulkSmsAction } from "@/modules/communication/actions/sms.action";

// ─── Types ──────────────────────────────────────────────────────────

interface SmsLogRow {
  id: string;
  recipientPhone: string;
  recipientName: string | null;
  message: string;
  status: string;
  sentAt: Date | string | null;
  createdAt: Date | string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

function getSmsStatusBadge(status: string) {
  const map: Record<string, string> = {
    QUEUED: "bg-gray-100 text-gray-700",
    SENT: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

function formatDate(dateStr: Date | string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component ──────────────────────────────────────────────────────

export function SmsClient({
  logs: initialLogs,
  pagination,
}: {
  logs: SmsLogRow[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [logs] = useState<SmsLogRow[]>(initialLogs);
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");

  // Single SMS form
  const [singleForm, setSingleForm] = useState({
    recipientPhone: "",
    recipientName: "",
    message: "",
  });

  // Bulk SMS form
  const [bulkForm, setBulkForm] = useState({
    numbers: "",
    message: "",
  });

  // ─── Handlers ─────────────────────────────────────────────────────

  function handleSendSingle() {
    if (!singleForm.recipientPhone.trim()) {
      toast.error("Phone number is required.");
      return;
    }
    if (!singleForm.message.trim()) {
      toast.error("Message is required.");
      return;
    }

    startTransition(async () => {
      const result = await sendSmsAction({
        recipientPhone: singleForm.recipientPhone,
        recipientName: singleForm.recipientName || undefined,
        message: singleForm.message,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("SMS queued for delivery.");
      setSingleForm({ recipientPhone: "", recipientName: "", message: "" });
      router.refresh();
    });
  }

  function handleSendBulk() {
    if (!bulkForm.numbers.trim()) {
      toast.error("At least one phone number is required.");
      return;
    }
    if (!bulkForm.message.trim()) {
      toast.error("Message is required.");
      return;
    }

    const numbers = bulkForm.numbers
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (numbers.length === 0) {
      toast.error("No valid phone numbers found.");
      return;
    }

    const recipients = numbers.map((phone) => ({ phone }));

    startTransition(async () => {
      const result = await sendBulkSmsAction({
        recipients,
        message: bulkForm.message,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data?.count ?? 0} SMS messages queued.`);
      setBulkForm({ numbers: "", message: "" });
      router.refresh();
    });
  }

  const singleCharCount = singleForm.message.length;
  const bulkCharCount = bulkForm.message.length;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* SMS Sender */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-base font-semibold">Send SMS</h3>

        {/* Tabs */}
        <div className="mb-4 flex items-center gap-4 border-b">
          <button
            onClick={() => setActiveTab("single")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "single"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Single Recipient
          </button>
          <button
            onClick={() => setActiveTab("bulk")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "bulk"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Bulk Send
          </button>
        </div>

        {/* Single */}
        {activeTab === "single" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Phone Number *</label>
                <input
                  type="tel"
                  value={singleForm.recipientPhone}
                  onChange={(e) => setSingleForm({ ...singleForm, recipientPhone: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. 0241234567"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Recipient Name</label>
                <input
                  type="text"
                  value={singleForm.recipientName}
                  onChange={(e) => setSingleForm({ ...singleForm, recipientName: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Message *</label>
              <textarea
                value={singleForm.message}
                onChange={(e) => setSingleForm({ ...singleForm, message: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Type your message..."
              />
              <p
                className={`mt-1 text-xs ${singleCharCount > 160 ? "text-red-600" : "text-muted-foreground"}`}
              >
                {singleCharCount}/160 characters
                {singleCharCount > 160 && ` (${Math.ceil(singleCharCount / 160)} SMS parts)`}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSendSingle}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Sending..." : "Send SMS"}
              </button>
            </div>
          </div>
        )}

        {/* Bulk */}
        {activeTab === "bulk" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Phone Numbers * (one per line)
              </label>
              <textarea
                value={bulkForm.numbers}
                onChange={(e) => setBulkForm({ ...bulkForm, numbers: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                rows={5}
                placeholder={"0241234567\n0271234567\n0201234567"}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {bulkForm.numbers.split("\n").filter((n) => n.trim()).length} numbers
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Message *</label>
              <textarea
                value={bulkForm.message}
                onChange={(e) => setBulkForm({ ...bulkForm, message: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Type your message..."
              />
              <p
                className={`mt-1 text-xs ${bulkCharCount > 160 ? "text-red-600" : "text-muted-foreground"}`}
              >
                {bulkCharCount}/160 characters
                {bulkCharCount > 160 && ` (${Math.ceil(bulkCharCount / 160)} SMS parts)`}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSendBulk}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Sending..." : "Send Bulk SMS"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SMS Logs */}
      <div>
        <h3 className="mb-4 text-base font-semibold">SMS Log</h3>
        <div className="overflow-hidden rounded-lg border">
          <table className="min-w-full divide-y">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  Recipient
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  Message
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y bg-card">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{log.recipientPhone}</p>
                      {log.recipientName && (
                        <p className="text-xs text-muted-foreground">{log.recipientName}</p>
                      )}
                    </div>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-sm text-muted-foreground">
                    <p className="line-clamp-2">{log.message}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSmsStatusBadge(log.status)}`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No SMS logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pagination.total > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Showing {logs.length} of {pagination.total} messages
          </p>
        )}
      </div>
    </div>
  );
}
