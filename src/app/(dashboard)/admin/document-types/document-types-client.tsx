"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  listDocumentTypesAction,
  createDocumentTypeAction,
  updateDocumentTypeAction,
  deactivateDocumentTypeAction,
} from "@/modules/student/actions/document.action";

type DocumentType = Extract<
  Awaited<ReturnType<typeof listDocumentTypesAction>>,
  { data: unknown }
>["data"][number];

type AppliesTo = "ALL" | "BOARDING_ONLY" | "DAY_ONLY";

interface FormData {
  name: string;
  description: string;
  isRequired: boolean;
  expiryMonths: string;
  appliesTo: AppliesTo;
  sortOrder: number;
}

const APPLIES_TO_LABEL: Record<AppliesTo, string> = {
  ALL: "All students",
  BOARDING_ONLY: "Boarding only",
  DAY_ONLY: "Day only",
};

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  isRequired: false,
  expiryMonths: "",
  appliesTo: "ALL",
  sortOrder: 0,
};

export function DocumentTypesClient({
  types,
  error,
}: {
  types: DocumentType[];
  error: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<DocumentType | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  function handleCreate() {
    setEditingType(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  }

  function handleEdit(type: DocumentType) {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description ?? "",
      isRequired: type.isRequired,
      expiryMonths: type.expiryMonths == null ? "" : String(type.expiryMonths),
      appliesTo: type.appliesTo as AppliesTo,
      sortOrder: type.sortOrder ?? 0,
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleClose() {
    setShowModal(false);
    setEditingType(null);
    setFormError(null);
  }

  function handleDeactivate(type: DocumentType) {
    if (
      !confirm(
        `Deactivate document type "${type.name}"? It will no longer appear in the catalog, but historical documents remain linked.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deactivateDocumentTypeAction(type.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Document type "${type.name}" deactivated.`);
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setFormError("Name is required.");
      return;
    }

    let expiryMonths: number | null = null;
    if (formData.expiryMonths.trim() !== "") {
      const parsed = Number(formData.expiryMonths);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        setFormError("Expiry months must be a positive whole number.");
        return;
      }
      expiryMonths = parsed;
    }

    const sortOrder = Number.isFinite(formData.sortOrder)
      ? Math.trunc(formData.sortOrder)
      : 0;

    setFormError(null);

    startTransition(async () => {
      if (editingType) {
        const result = await updateDocumentTypeAction({
          id: editingType.id,
          name: trimmedName,
          description: formData.description.trim() || null,
          isRequired: formData.isRequired,
          expiryMonths,
          appliesTo: formData.appliesTo,
          sortOrder,
        });
        if ("error" in result) {
          setFormError(result.error);
        } else {
          toast.success(`Document type "${trimmedName}" updated.`);
          handleClose();
          router.refresh();
        }
      } else {
        const result = await createDocumentTypeAction({
          name: trimmedName,
          description: formData.description.trim() || undefined,
          isRequired: formData.isRequired,
          expiryMonths,
          appliesTo: formData.appliesTo,
          sortOrder,
        });
        if ("error" in result) {
          setFormError(result.error);
        } else {
          toast.success(`Document type "${trimmedName}" created.`);
          handleClose();
          router.refresh();
        }
      }
    });
  }

  return (
    <>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {types.length} document type{types.length === 1 ? "" : "s"} configured
        </p>
        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add type
        </button>
      </div>

      {types.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No document types defined yet. Click &quot;Add type&quot; to create one.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Required</th>
                  <th className="px-4 py-3 text-left font-medium">Expiry (months)</th>
                  <th className="px-4 py-3 text-left font-medium">Applies to</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {types.map((type) => (
                  <tr key={type.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{type.name}</div>
                      {type.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {type.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {type.isRequired ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          Required
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Optional</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {type.expiryMonths ? (
                        <span>{type.expiryMonths}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {APPLIES_TO_LABEL[type.appliesTo as AppliesTo] ?? type.appliesTo}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={type.status} />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                          onClick={() => handleEdit(type)}
                        >
                          Edit
                        </button>
                        {type.status === "ACTIVE" && (
                          <button
                            type="button"
                            className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                            onClick={() => handleDeactivate(type)}
                            disabled={isPending}
                          >
                            Deactivate
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingType
                  ? `Edit Document Type: ${editingType.name}`
                  : "Add Document Type"}
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Birth Certificate"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Short note shown to staff when uploading"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="document-type-required"
                  type="checkbox"
                  checked={formData.isRequired}
                  onChange={(e) =>
                    setFormData({ ...formData, isRequired: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-input"
                />
                <label
                  htmlFor="document-type-required"
                  className="text-sm font-medium"
                >
                  Required for applicable students
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Expiry (months)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={formData.expiryMonths}
                    onChange={(e) =>
                      setFormData({ ...formData, expiryMonths: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Leave blank for no expiry"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Sort order
                  </label>
                  <input
                    type="number"
                    step={1}
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sortOrder: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Applies to</label>
                <select
                  value={formData.appliesTo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      appliesTo: e.target.value as AppliesTo,
                    })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ALL">All students</option>
                  <option value="BOARDING_ONLY">Boarding only</option>
                  <option value="DAY_ONLY">Day only</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending
                    ? "Saving..."
                    : editingType
                      ? "Update type"
                      : "Create type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
