"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  upsertNotificationTemplateAction,
  deleteNotificationTemplateAction,
  previewNotificationTemplateAction,
} from "@/modules/communication/actions/notification-template.action";

type ChannelStr = "IN_APP" | "SMS" | "EMAIL" | "WHATSAPP" | "PUSH";

interface TemplateRow {
  id: string;
  scope: "school" | "global";
  schoolId: string | null;
  key: string;
  channel: string;
  locale: string;
  subject: string | null;
  body: string;
  variables: string[];
  active: boolean;
  updatedAt: Date | string;
}

export function TemplatesClient({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [filterKey, setFilterKey] = useState<string>("");
  const [filterChannel, setFilterChannel] = useState<string>("ALL");
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [preview, setPreview] = useState<{ subject: string | null; body: string } | null>(
    null,
  );

  const visible = useMemo(() => {
    return templates.filter(
      (t) =>
        (!filterKey || t.key.toLowerCase().includes(filterKey.toLowerCase())) &&
        (filterChannel === "ALL" || t.channel === filterChannel),
    );
  }, [templates, filterKey, filterChannel]);

  function handleEdit(tpl: TemplateRow) {
    setEditing({ ...tpl });
    setPreview(null);
  }

  function handleCreateOverride(tpl: TemplateRow) {
    // Clone the global default into a school-scoped draft.
    setEditing({ ...tpl, scope: "school", id: "" });
    setPreview(null);
  }

  function handleSave() {
    if (!editing) return;
    startTransition(async () => {
      const result = await upsertNotificationTemplateAction({
        key: editing.key,
        channel: editing.channel as ChannelStr,
        locale: editing.locale,
        subject: editing.subject,
        body: editing.body,
        variables: editing.variables,
        active: editing.active,
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Template saved.");
        setEditing(null);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!editing || !editing.id || editing.scope !== "school") return;
    if (
      !confirm(
        "Delete this override? The global default will apply again until you create a new override.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteNotificationTemplateAction(editing.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Override deleted. Default restored.");
        setEditing(null);
        router.refresh();
      }
    });
  }

  function handlePreview() {
    if (!editing) return;
    startTransition(async () => {
      const sample = sampleDataFor(editing.variables);
      const result = await previewNotificationTemplateAction({
        subject: editing.subject,
        body: editing.body,
        data: sample,
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setPreview(result.data);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={filterKey}
          onChange={(e) => setFilterKey(e.target.value)}
          placeholder="Filter by key (e.g. fee_reminder)"
          className="min-w-64 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All channels</option>
          <option value="EMAIL">Email</option>
          <option value="SMS">SMS</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="IN_APP">In-app</option>
          <option value="PUSH">Push</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-semibold">Key</th>
              <th className="px-4 py-2 font-semibold">Channel</th>
              <th className="px-4 py-2 font-semibold">Locale</th>
              <th className="px-4 py-2 font-semibold">Scope</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No templates match the current filter.
                </td>
              </tr>
            ) : (
              visible.map((t) => (
                <tr key={`${t.key}:${t.channel}:${t.locale}:${t.scope}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">{t.key}</td>
                  <td className="px-4 py-2">{t.channel}</td>
                  <td className="px-4 py-2">{t.locale}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        t.scope === "school"
                          ? "rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                          : "rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      }
                    >
                      {t.scope}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {t.active ? (
                      <span className="text-green-700">active</span>
                    ) : (
                      <span className="text-gray-500">inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {t.scope === "school" ? (
                      <button
                        onClick={() => handleEdit(t)}
                        className="text-sm text-blue-600 underline"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCreateOverride(t)}
                        className="text-sm text-blue-600 underline"
                      >
                        Create override
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">
              {editing.id ? "Edit" : "Create"} school override for{" "}
              <span className="font-mono">{editing.key}</span>
            </h2>

            {editing.channel !== "SMS" && editing.channel !== "WHATSAPP" && (
              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium">Subject</span>
                <input
                  type="text"
                  value={editing.subject ?? ""}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  className="w-full rounded border border-gray-300 p-2"
                />
              </label>
            )}

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium">
                Body (supports {"{{variable}}"} and {"{{{raw}}}"})
              </span>
              <textarea
                rows={10}
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                className="w-full rounded border border-gray-300 p-2 font-mono text-sm"
              />
            </label>

            {editing.variables.length > 0 && (
              <p className="mb-3 text-xs text-gray-500">
                Documented variables: {editing.variables.map((v) => `{{${v}}}`).join(", ")}
              </p>
            )}

            <label className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
              <span className="text-sm">Active</span>
            </label>

            {preview && (
              <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                {preview.subject && (
                  <div className="mb-2">
                    <div className="text-xs text-gray-500">Subject</div>
                    <div className="font-medium">{preview.subject}</div>
                  </div>
                )}
                <div className="text-xs text-gray-500">Body</div>
                <pre className="whitespace-pre-wrap font-sans">{preview.body}</pre>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                {editing.id && editing.scope === "school" && (
                  <button
                    onClick={handleDelete}
                    disabled={pending}
                    className="rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete override
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePreview}
                  disabled={pending}
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  Preview with sample data
                </button>
                <button
                  onClick={() => {
                    setEditing(null);
                    setPreview(null);
                  }}
                  className="rounded px-3 py-2 text-sm text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={pending}
                  className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Produce a plausible sample data blob for preview — if a variable list was
 * provided on the template we use friendly placeholders; otherwise we ship
 * the common school set.
 */
function sampleDataFor(variables: string[]): Record<string, unknown> {
  const base: Record<string, unknown> = {
    studentName: "Ama Owusu",
    guardianName: "Mr. Kwame Owusu",
    amount: "250.00",
    termName: "Term 1, 2026/27",
    schoolName: "Ghana SHS Demo",
    date: "2026-04-16",
    status: "APPROVED",
  };
  if (variables.length === 0) return base;
  const out: Record<string, unknown> = {};
  for (const v of variables) {
    out[v] = base[v] ?? `{{${v}}}`;
  }
  return out;
}
