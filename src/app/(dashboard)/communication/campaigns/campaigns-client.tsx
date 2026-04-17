"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCampaignAction,
  cancelCampaignAction,
} from "@/modules/communication/actions/campaign.action";

interface CampaignRow {
  id: string;
  name: string;
  channel: string;
  status: string;
  scheduledAt: Date | string;
  dispatchedAt: Date | string | null;
  sentCount: number;
  failedCount: number;
  createdAt: Date | string;
}

export function CampaignsClient({ campaigns }: { campaigns: CampaignRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    channel: "SMS" as "SMS" | "EMAIL" | "WHATSAPP" | "IN_APP",
    subject: "",
    body: "",
    audienceKind: "ALL_GUARDIANS" as
      | "ALL_GUARDIANS"
      | "ALL_STAFF"
      | "CLASS_ARM"
      | "HOSTEL",
    classArmId: "",
    hostelId: "",
    scheduledAt: defaultScheduledAt(),
  });

  function defaultScheduledAt() {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    // Local datetime-input value, minute precision.
    return d.toISOString().slice(0, 16);
  }

  function handleCreate() {
    const audience =
      form.audienceKind === "CLASS_ARM"
        ? { kind: "CLASS_ARM" as const, classArmId: form.classArmId }
        : form.audienceKind === "HOSTEL"
          ? { kind: "HOSTEL" as const, hostelId: form.hostelId }
          : { kind: form.audienceKind };

    startTransition(async () => {
      const result = await createCampaignAction({
        name: form.name,
        channel: form.channel,
        subject: form.channel === "EMAIL" ? form.subject : null,
        body: form.body,
        audience: audience as never,
        scheduledAt: new Date(form.scheduledAt),
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Campaign scheduled.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  function handleCancel(id: string) {
    if (!confirm("Cancel this campaign?")) return;
    startTransition(async () => {
      const result = await cancelCampaignAction(id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Campaign cancelled.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white"
        >
          Schedule campaign
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Channel</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Scheduled</th>
              <th className="px-4 py-2 font-semibold">Sent</th>
              <th className="px-4 py-2 font-semibold">Failed</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No campaigns yet.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">{c.channel}</td>
                  <td className="px-4 py-2">{c.status}</td>
                  <td className="px-4 py-2 text-xs">
                    {new Date(c.scheduledAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{c.sentCount}</td>
                  <td className="px-4 py-2">{c.failedCount}</td>
                  <td className="px-4 py-2 text-right">
                    {c.status === "SCHEDULED" && (
                      <button
                        onClick={() => handleCancel(c.id)}
                        className="text-sm text-red-600 underline"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Schedule campaign</h2>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium">Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded border border-gray-300 p-2"
              />
            </label>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Channel</span>
                <select
                  value={form.channel}
                  onChange={(e) =>
                    setForm({ ...form, channel: e.target.value as typeof form.channel })
                  }
                  className="w-full rounded border border-gray-300 p-2"
                >
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="IN_APP">In-app</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Audience</span>
                <select
                  value={form.audienceKind}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      audienceKind: e.target.value as typeof form.audienceKind,
                    })
                  }
                  className="w-full rounded border border-gray-300 p-2"
                >
                  <option value="ALL_GUARDIANS">All guardians</option>
                  <option value="ALL_STAFF">All staff</option>
                  <option value="CLASS_ARM">One class arm</option>
                  <option value="HOSTEL">One hostel</option>
                </select>
              </label>
            </div>

            {form.audienceKind === "CLASS_ARM" && (
              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium">Class-arm ID</span>
                <input
                  type="text"
                  value={form.classArmId}
                  onChange={(e) => setForm({ ...form, classArmId: e.target.value })}
                  className="w-full rounded border border-gray-300 p-2"
                />
              </label>
            )}

            {form.audienceKind === "HOSTEL" && (
              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium">Hostel ID</span>
                <input
                  type="text"
                  value={form.hostelId}
                  onChange={(e) => setForm({ ...form, hostelId: e.target.value })}
                  className="w-full rounded border border-gray-300 p-2"
                />
              </label>
            )}

            {form.channel === "EMAIL" && (
              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium">Subject</span>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full rounded border border-gray-300 p-2"
                />
              </label>
            )}

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium">
                Body (supports {"{{variable}}"} substitution)
              </span>
              <textarea
                rows={6}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full rounded border border-gray-300 p-2 font-mono text-sm"
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium">Send at</span>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="rounded border border-gray-300 p-2"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded px-3 py-2 text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={pending || !form.name || !form.body}
                className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Scheduling…" : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
