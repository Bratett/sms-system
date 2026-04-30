"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  publishAlumniEventAction,
  cancelAlumniEventAction,
} from "@/modules/alumni-events/actions/admin-events.action";
import { EventFormModal } from "../event-form-modal";

type Event = {
  id: string;
  schoolId: string;
  title: string;
  description: string | null;
  startAt: Date | string;
  endAt: Date | string | null;
  location: string | null;
  virtualLink: string | null;
  capacity: number | null;
  maxGuestsPerRsvp: number;
  rsvpDeadline: Date | string | null;
  status: "DRAFT" | "PUBLISHED" | "CANCELED";
  publishedAt: Date | string | null;
  canceledAt: Date | string | null;
};

type RsvpRow = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  graduationYear: number;
  currentEmployer: string | null;
  response: "YES" | "NO" | "MAYBE";
  guestCount: number;
  waitlisted: boolean;
  respondedAt: Date | string;
};

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateInputFormat(d: Date | string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().slice(0, 16);
}

export function EventDetailClient({
  event,
  rsvps,
}: {
  event: Event;
  rsvps: RsvpRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);

  const waitlistHeadcount = rsvps
    .filter((r) => r.response === "YES" && r.waitlisted)
    .reduce((acc, r) => acc + 1 + r.guestCount, 0);
  const confirmedHeadcount = rsvps
    .filter((r) => r.response === "YES" && !r.waitlisted)
    .reduce((acc, r) => acc + 1 + r.guestCount, 0);

  function handlePublish() {
    if (!window.confirm("Publish this event? This will email all alumni in the school.")) return;
    start(async () => {
      const res = await publishAlumniEventAction(event.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Event published.");
      router.refresh();
    });
  }

  function handleCancel() {
    if (!window.confirm("Cancel this event? Existing RSVPs will be preserved.")) return;
    start(async () => {
      const res = await cancelAlumniEventAction(event.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Event canceled.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 p-6">
      <header className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{event.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(event.startAt)}
              {event.endAt ? ` — ${formatDate(event.endAt)}` : ""}
            </p>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              event.status === "PUBLISHED"
                ? "bg-green-100 text-green-800"
                : event.status === "DRAFT"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {event.status}
          </span>
        </div>

        {event.location && (
          <p className="text-sm">📍 {event.location}</p>
        )}
        {event.virtualLink && (
          <p className="text-sm">
            💻{" "}
            <a
              href={event.virtualLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {event.virtualLink}
            </a>
          </p>
        )}
        {event.description && (
          <p className="text-sm whitespace-pre-wrap">{event.description}</p>
        )}

        {event.capacity !== null && (
          <div>
            <p className="text-xs text-muted-foreground">
              {confirmedHeadcount} / {event.capacity} confirmed
              {waitlistHeadcount > 0 ? ` · ${waitlistHeadcount} waitlisted` : ""}
            </p>
            <div className="w-full h-2 bg-muted rounded-full mt-1">
              <div
                className="h-2 bg-primary rounded-full"
                style={{
                  width: `${Math.min(100, (confirmedHeadcount / event.capacity) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {event.status === "DRAFT" && (
            <>
              <button
                type="button"
                onClick={handlePublish}
                disabled={pending}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
              >
                Publish
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Edit
              </button>
            </>
          )}
          {event.status === "PUBLISHED" && (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={pending}
                className="rounded-lg border border-red-300 text-red-700 px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel event
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Edit
              </button>
            </>
          )}
          {event.status === "CANCELED" && (
            <p className="text-sm text-muted-foreground">
              Canceled on {formatDate(event.canceledAt)}
            </p>
          )}
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">RSVPs ({rsvps.length})</h2>
          <button
            type="button"
            onClick={() => downloadCsv(rsvps, event.title)}
            className="text-xs text-primary hover:underline"
          >
            Download CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Class</th>
              <th className="p-3 text-left">Response</th>
              <th className="p-3 text-left">Guests</th>
              <th className="p-3 text-left">Responded</th>
            </tr>
          </thead>
          <tbody>
            {rsvps.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No RSVPs yet.
                </td>
              </tr>
            ) : (
              rsvps.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-medium">
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="p-3 text-muted-foreground">Class of {r.graduationYear}</td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.response === "YES"
                          ? "bg-green-100 text-green-800"
                          : r.response === "MAYBE"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.response}
                    </span>
                    {r.waitlisted && (
                      <span className="ml-1 text-xs text-muted-foreground">(waitlist)</span>
                    )}
                  </td>
                  <td className="p-3">{r.guestCount}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(r.respondedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EventFormModal
          mode="edit"
          initial={{
            id: event.id,
            title: event.title,
            description: event.description ?? "",
            startAt: toDateInputFormat(event.startAt),
            endAt: toDateInputFormat(event.endAt),
            location: event.location ?? "",
            virtualLink: event.virtualLink ?? "",
            capacity: event.capacity?.toString() ?? "",
            maxGuestsPerRsvp: event.maxGuestsPerRsvp,
            rsvpDeadline: toDateInputFormat(event.rsvpDeadline),
          }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function downloadCsv(rsvps: RsvpRow[], eventTitle: string) {
  const csv = [
    "Name,Class,Response,Guests,Waitlisted,RespondedAt",
    ...rsvps.map((r) =>
      [
        JSON.stringify(`${r.firstName} ${r.lastName}`),
        r.graduationYear,
        r.response,
        r.guestCount,
        r.waitlisted,
        new Date(r.respondedAt).toISOString(),
      ].join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rsvps-${eventTitle.replace(/[^a-z0-9]/gi, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
