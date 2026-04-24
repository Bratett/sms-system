"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import {
  getMessageThreadAction,
} from "@/modules/messaging/actions/thread.action";
import {
  postMessageAction,
  reportMessageAction,
} from "@/modules/messaging/actions/message.action";
import { getMessageAttachmentUrlAction } from "@/modules/messaging/actions/attachment.action";

type ThreadRow = {
  id: string;
  studentId: string;
  studentName: string;
  teacherUserId: string;
  teacherName: string;
  status: "ACTIVE" | "ARCHIVED";
  locked: boolean;
  lastMessageAt: Date | string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
};

type ThreadDetail = {
  id: string;
  studentId: string;
  studentName: string;
  teacher: { id: string; name: string };
  status: "ACTIVE" | "ARCHIVED";
  locked: boolean;
  lockReason: string | null;
  messages: Array<{
    id: string;
    authorUserId: string;
    body: string;
    attachmentKey: string | null;
    attachmentName: string | null;
    attachmentSize: number | null;
    attachmentMime: string | null;
    systemNote: boolean;
    createdAt: Date | string;
  }>;
  isParticipant: boolean;
  isAdmin: boolean;
};

export function MessagesClient({
  threads,
  role,
}: {
  threads: ThreadRow[];
  role: "parent" | "teacher" | "admin";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ThreadDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");

  const openThread = (threadId: string) => {
    setLoadingThread(true);
    start(async () => {
      const res = await getMessageThreadAction(threadId);
      setLoadingThread(false);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setSelected(res.data as ThreadDetail);
      router.refresh();
    });
  };

  const sendReply = () => {
    if (!selected) return;
    const text = body.trim();
    if (!text) return;
    start(async () => {
      const res = await postMessageAction({ threadId: selected.id, body: text });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setBody("");
      openThread(selected.id);
    });
  };

  const reportMessage = (messageId: string) => {
    const reason = window.prompt("Reason for reporting this message?");
    if (!reason) return;
    start(async () => {
      const res = await reportMessageAction({ messageId, reason });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Message reported. An admin will review it.");
    });
  };

  const downloadAttachment = (messageId: string) => {
    start(async () => {
      const res = await getMessageAttachmentUrlAction(messageId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.data.url, "_blank");
    });
  };

  const heading =
    role === "parent"
      ? { title: "Messages", description: "Conversations with your children's teachers." }
      : role === "teacher"
      ? { title: "Messages", description: "Conversations with parents about your students." }
      : { title: "Messages — Admin review", description: "Read-only view of all school threads." };

  return (
    <div className="space-y-4">
      <PageHeader title={heading.title} description={heading.description} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white md:col-span-1">
          {threads.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No conversations yet.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => openThread(t.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selected?.id === t.id ? "bg-teal-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{t.studentName}</p>
                        <p className="text-xs text-gray-500 truncate">{t.teacherName}</p>
                        <p className="text-xs text-gray-500 truncate mt-1">{t.lastMessagePreview ?? "(no messages yet)"}</p>
                      </div>
                      {t.unreadCount > 0 && (
                        <span className="shrink-0 rounded-full bg-teal-600 text-white text-xs font-semibold px-2 py-0.5">
                          {t.unreadCount}
                        </span>
                      )}
                    </div>
                    {t.status === "ARCHIVED" && (
                      <span className="mt-1 inline-block text-xs text-gray-400">Archived</span>
                    )}
                    {t.locked && (
                      <span className="mt-1 inline-block text-xs text-red-600">Locked</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white md:col-span-2 min-h-[400px]">
          {loadingThread ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading…</div>
          ) : !selected ? (
            <div className="p-12 text-center text-sm text-gray-500">Select a conversation.</div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="border-b border-gray-100 p-4">
                <p className="font-semibold">{selected.studentName}</p>
                <p className="text-xs text-gray-500">
                  with {selected.teacher.name}
                  {selected.status === "ARCHIVED" && " • Archived"}
                  {selected.locked && ` • Locked: ${selected.lockReason ?? ""}`}
                </p>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-3">
                {selected.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-lg p-3 text-sm ${
                      m.systemNote
                        ? "mx-auto text-center italic text-gray-500 bg-gray-50"
                        : "bg-gray-100"
                    }`}
                  >
                    {!m.systemNote && (
                      <p className="text-xs text-gray-400 mb-1">
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.attachmentKey && (
                      <button
                        onClick={() => downloadAttachment(m.id)}
                        className="mt-2 text-xs text-teal-600 hover:underline"
                      >
                        📎 {m.attachmentName ?? "attachment"}
                        {m.attachmentSize ? ` (${Math.round(m.attachmentSize / 1024)} KB)` : ""}
                      </button>
                    )}
                    {!m.systemNote && (
                      <button
                        onClick={() => reportMessage(m.id)}
                        className="mt-1 ml-2 text-xs text-gray-400 hover:text-red-600"
                        aria-label="Report message"
                      >
                        Report
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {selected.isParticipant && selected.status === "ACTIVE" && !selected.locked && (
                <div className="border-t border-gray-100 p-3">
                  <div className="flex gap-2">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write a reply…"
                      rows={2}
                      className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={sendReply}
                      disabled={pending || !body.trim()}
                      className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
