"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
  getEligibleCounterpartsAction,
  createMessageThreadAction,
  type CounterpartOption,
} from "@/modules/messaging/actions/thread.action";

export function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (threadId: string) => void;
}) {
  const [options, setOptions] = useState<CounterpartOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CounterpartOption | null>(null);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const res = await getEligibleCounterpartsAction();
      setLoading(false);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setOptions(res.data);
    })();
  }, []);

  const submit = () => {
    if (!selected || !body.trim()) return;
    start(async () => {
      const res = await createMessageThreadAction({
        studentId: selected.studentId,
        teacherUserId: selected.teacherUserId,
        initialBody: body.trim(),
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Conversation started.");
      onCreated(res.data.id);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold">New conversation</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading options…</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-gray-500">
            No eligible recipients. This usually means the class teacher or housemaster hasn&apos;t been assigned yet — contact the school.
          </p>
        ) : (
          <>
            <ul className="space-y-2 max-h-48 overflow-auto">
              {options.map((o, idx) => (
                <li key={`${o.studentId}-${o.teacherUserId}-${idx}`}>
                  <label className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="counterpart"
                      checked={
                        selected?.studentId === o.studentId &&
                        selected?.teacherUserId === o.teacherUserId
                      }
                      onChange={() => setSelected(o)}
                      className="mt-1"
                    />
                    <div className="text-sm">
                      <p className="font-medium">{o.studentName}</p>
                      <p className="text-xs text-gray-500">
                        with {o.teacherName} ({o.role === "class_teacher" ? "Class Teacher" : "Housemaster"})
                      </p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the first message…"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || !selected || !body.trim() || loading}
            className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Start conversation
          </button>
        </div>
      </div>
    </div>
  );
}
