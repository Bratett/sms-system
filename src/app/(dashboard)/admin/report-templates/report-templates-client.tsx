"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createReportTemplateAction,
  updateReportTemplateAction,
  deleteReportTemplateAction,
  setDefaultTemplateAction,
} from "@/modules/academics/actions/report-template.action";

const TEMPLATE_TYPES = [
  "TERMINAL",
  "ANNUAL",
  "TRANSCRIPT",
  "PROGRESS",
] as const;

type TemplateType = (typeof TEMPLATE_TYPES)[number];

interface SectionsConfig {
  showAttendance: boolean;
  showConduct: boolean;
  showActivities: boolean;
  showCABreakdown: boolean;
  showAwards: boolean;
}

interface FormData {
  name: string;
  type: TemplateType;
  sections: SectionsConfig;
}

const DEFAULT_SECTIONS: SectionsConfig = {
  showAttendance: true,
  showConduct: true,
  showActivities: false,
  showCABreakdown: false,
  showAwards: false,
};

export function ReportTemplatesClient({
  initialTemplates,
}: {
  initialTemplates: any[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    type: "TERMINAL",
    sections: { ...DEFAULT_SECTIONS },
  });

  function handleCreate() {
    setEditingItem(null);
    setFormData({
      name: "",
      type: "TERMINAL",
      sections: { ...DEFAULT_SECTIONS },
    });
    setShowModal(true);
  }

  function handleEdit(template: any) {
    setEditingItem(template);
    const parsed =
      typeof template.sections === "string"
        ? JSON.parse(template.sections)
        : template.sections ?? {};
    setFormData({
      name: template.name,
      type: template.type,
      sections: {
        showAttendance: parsed.showAttendance ?? true,
        showConduct: parsed.showConduct ?? true,
        showActivities: parsed.showActivities ?? false,
        showCABreakdown: parsed.showCABreakdown ?? false,
        showAwards: parsed.showAwards ?? false,
      },
    });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        name: formData.name,
        type: formData.type,
        frameworkId: "default",
        sections: formData.sections,
      };
      if (editingItem) {
        const result = await updateReportTemplateAction(
          editingItem.id,
          payload
        );
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Template updated successfully");
      } else {
        const result = await createReportTemplateAction(payload);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Template created successfully");
      }
      setShowModal(false);
      setEditingItem(null);
      router.refresh();
    });
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      const result = await setDefaultTemplateAction(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Template set as default");
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const result = await deleteReportTemplateAction(deleteId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Template deleted successfully");
      setDeleteId(null);
      router.refresh();
    });
  }

  function toggleSection(key: keyof SectionsConfig) {
    setFormData((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [key]: !prev.sections[key],
      },
    }));
  }

  const sectionLabels: Record<keyof SectionsConfig, string> = {
    showAttendance: "Attendance",
    showConduct: "Conduct",
    showActivities: "Activities",
    showCABreakdown: "CA Breakdown",
    showAwards: "Awards",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Report Templates</h1>
          <p className="text-sm text-muted-foreground">
            Configure report card templates and their sections.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          Create Template
        </button>
      </div>

      {/* Table */}
      {initialTemplates.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          No report templates found. Create one to get started.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Framework ID
                  </th>
                  <th className="px-4 py-3 text-center font-medium">Default</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialTemplates.map((template: any) => (
                  <tr
                    key={template.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{template.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-xs font-medium">
                        {template.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {template.frameworkId ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {template.isDefault ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium">
                          Default
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(template)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        {!template.isDefault && (
                          <button
                            onClick={() => handleSetDefault(template.id)}
                            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                            disabled={isPending}
                          >
                            Set Default
                          </button>
                        )}
                        {!template.isDefault && (
                          <button
                            onClick={() => setDeleteId(template.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                            disabled={isPending}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Delete Template</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete this template? This action cannot
              be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">
              {editingItem ? "Edit Template" : "Create Template"}
            </h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Template name"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: e.target.value as TemplateType,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {TEMPLATE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Sections
                </label>
                <div className="space-y-2">
                  {(
                    Object.keys(sectionLabels) as Array<keyof SectionsConfig>
                  ).map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={formData.sections[key]}
                        onClick={() => toggleSection(key)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          formData.sections[key]
                            ? "bg-primary"
                            : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            formData.sections[key]
                              ? "translate-x-4"
                              : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      <span className="text-sm">{sectionLabels[key]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingItem(null);
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending
                    ? "Saving..."
                    : editingItem
                      ? "Update"
                      : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
