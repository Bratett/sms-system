"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getParentChildrenAction } from "@/modules/portal/actions/parent.action";
import { submitMedicalDisclosureAction } from "@/modules/parent-requests/actions/medical-disclosure.action";
import { getParentRequestAttachmentUploadUrlAction } from "@/modules/parent-requests/actions/attachment.action";
import {
  PortalAttachmentUpload,
  type PortalAttachmentMeta,
} from "@/components/portal/attachment-upload";

type Child = { id: string; firstName: string; lastName: string };

export function NewMedicalModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState<"ALLERGY" | "CONDITION" | "MEDICATION">("ALLERGY");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [attachment, setAttachment] = useState<PortalAttachmentMeta | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const res = await getParentChildrenAction();
      setLoading(false);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setChildren(res.data as Child[]);
      if (res.data.length > 0) setStudentId(res.data[0].id);
    })();
  }, []);

  const submit = () => {
    if (!studentId || !title.trim() || !description.trim()) return;
    start(async () => {
      const res = await submitMedicalDisclosureAction({
        studentId,
        category,
        title: title.trim(),
        description: description.trim(),
        isUrgent,
        ...(attachment ?? {}),
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Medical disclosure submitted.");
      onCreated();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold">Disclose medical info</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading children…</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-gray-500">No linked children.</p>
        ) : (
          <>
            <label className="block text-sm">
              <span className="font-medium">Child</span>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">Category</legend>
              {(["ALLERGY", "CONDITION", "MEDICATION"] as const).map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="cat"
                    value={c}
                    checked={category === c}
                    onChange={() => setCategory(c)}
                  />
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </label>
              ))}
            </fieldset>

            <label className="block text-sm">
              <span className="font-medium">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Peanut allergy"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Severity, onset, medication/response, etc."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
              />
              Mark as urgent (notifies the nurse immediately via SMS)
            </label>

            <PortalAttachmentUpload
              requestUploadUrl={(input) =>
                getParentRequestAttachmentUploadUrlAction({ kind: "medical", ...input })
              }
              value={attachment}
              onChange={setAttachment}
              disabled={pending}
            />
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || !studentId || !title.trim() || !description.trim()}
            className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
