"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  getMessageThreadAction,
} from "@/modules/messaging/actions/thread.action";
import {
  lockThreadAction,
  unlockThreadAction,
} from "@/modules/messaging/actions/message-moderation.action";

type ThreadRow = {
  id: string;
  studentName: string;
  teacherName: string;
  status: "ACTIVE" | "ARCHIVED";
  locked: boolean;
  lastMessageAt: Date | string | null;
  unreadCount: number;
};

export function MessagingAdminClient({ threads }: { threads: ThreadRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [viewing, setViewing] = useState<{
    id: string;
    studentName: string;
    teacherName: string;
    status: string;
    locked: boolean;
    lockReason: string | null;
    messages: Array<{ id: string; body: string; createdAt: Date | string; systemNote: boolean }>;
  } | null>(null);

  const openThread = (id: string) => {
    start(async () => {
      const res = await getMessageThreadAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setViewing({
        id: res.data.id,
        studentName: res.data.studentName,
        teacherName: res.data.teacher.name,
        status: res.data.status,
        locked: res.data.locked,
        lockReason: res.data.lockReason,
        messages: res.data.messages.map((m) => ({
          id: m.id,
          body: m.body,
          createdAt: m.createdAt,
          systemNote: m.systemNote ?? false,
        })),
      });
    });
  };

  const onLock = (threadId: string) => {
    const reason = window.prompt("Reason for locking?");
    if (!reason) return;
    start(async () => {
      const res = await lockThreadAction({ threadId, reason });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Thread locked.");
      router.refresh();
      if (viewing?.id === threadId) openThread(threadId);
    });
  };

  const onUnlock = (threadId: string) => {
    start(async () => {
      const res = await unlockThreadAction(threadId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Thread unlocked.");
      router.refresh();
      if (viewing?.id === threadId) openThread(threadId);
    });
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Messaging Admin</h1>
        <Link
          href="/students/messaging/reports"
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
        >
          Report queue
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 text-left">Student</th>
                <th className="p-3 text-left">Teacher</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {threads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No threads.
                  </td>
                </tr>
              ) : (
                threads.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/40">
                    <td className="p-3 font-medium">{t.studentName}</td>
                    <td className="p-3 text-muted-foreground">{t.teacherName}</td>
                    <td className="p-3">
                      <span className="text-xs">
                        {t.status}
                        {t.locked && " • LOCKED"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openThread(t.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 min-h-[400px]">
          {!viewing ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Select a thread to view.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{viewing.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    with {viewing.teacherName}{viewing.locked ? " • LOCKED" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {viewing.locked ? (
                    <button
                      onClick={() => onUnlock(viewing.id)}
                      disabled={pending}
                      className="text-xs rounded-lg bg-primary text-primary-foreground px-3 py-1"
                    >
                      Unlock
                    </button>
                  ) : (
                    <button
                      onClick={() => onLock(viewing.id)}
                      disabled={pending}
                      className="text-xs rounded-lg bg-red-600 text-white px-3 py-1"
                    >
                      Lock
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-auto">
                {viewing.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg p-2 text-sm ${m.systemNote ? "bg-muted italic text-muted-foreground text-center" : "bg-muted/40"}`}
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
