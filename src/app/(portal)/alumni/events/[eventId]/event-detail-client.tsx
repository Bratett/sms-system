"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertMyEventRsvpAction } from "@/modules/alumni-events/actions/alumni-events.action";

type Event = {
  id: string;
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
};

type MyRsvp = {
  response: "YES" | "NO" | "MAYBE";
  guestCount: number;
  waitlisted: boolean;
} | null;

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventDetailClient({
  event,
  myRsvp: initialMyRsvp,
}: {
  event: Event;
  myRsvp: MyRsvp;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [response, setResponse] = useState<"YES" | "NO" | "MAYBE">(
    initialMyRsvp?.response ?? "YES",
  );
  const [guestCount, setGuestCount] = useState<number>(initialMyRsvp?.guestCount ?? 0);
  const [myRsvp, setMyRsvp] = useState<MyRsvp>(initialMyRsvp);

  const now = new Date();
  const isCanceled = event.status === "CANCELED";
  const deadlinePassed = event.rsvpDeadline && new Date(event.rsvpDeadline) <= now;
  const eventStarted = new Date(event.startAt) <= now;
  const locked = isCanceled || deadlinePassed || eventStarted;

  function handleSubmit() {
    start(async () => {
      const res = await upsertMyEventRsvpAction({
        eventId: event.id,
        response,
        guestCount: response === "YES" ? guestCount : 0,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("RSVP saved.");
      setMyRsvp({
        response: res.data.response as "YES" | "NO" | "MAYBE",
        guestCount: res.data.guestCount,
        waitlisted: res.data.waitlisted,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <p className="text-sm text-gray-700">
          {formatDate(event.startAt)}
          {event.endAt ? ` — ${formatDate(event.endAt)}` : ""}
        </p>
        {event.location && <p className="text-sm">📍 {event.location}</p>}
        {event.virtualLink && (
          <p className="text-sm">
            💻{" "}
            <a
              href={event.virtualLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-700 hover:underline"
            >
              Join meeting
            </a>
          </p>
        )}
        {event.description && (
          <p className="text-sm whitespace-pre-wrap">{event.description}</p>
        )}
      </header>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold">Your RSVP</h2>

        {isCanceled ? (
          <p className="text-sm text-red-700">This event was canceled by the school.</p>
        ) : deadlinePassed ? (
          <p className="text-sm text-gray-700">
            RSVP closed on {formatDate(event.rsvpDeadline)}.
            {myRsvp && (
              <>
                {" "}You said: <strong>{myRsvp.response}</strong>
                {myRsvp.guestCount > 0 ? ` (with ${myRsvp.guestCount} guest${myRsvp.guestCount === 1 ? "" : "s"})` : ""}.
              </>
            )}
          </p>
        ) : eventStarted ? (
          <p className="text-sm text-gray-700">
            Event has already taken place.
            {myRsvp && (
              <>
                {" "}You said: <strong>{myRsvp.response}</strong>.
              </>
            )}
          </p>
        ) : (
          <>
            <div className="flex gap-3">
              {(["YES", "NO", "MAYBE"] as const).map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="response"
                    value={r}
                    checked={response === r}
                    onChange={() => setResponse(r)}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            {response === "YES" && event.maxGuestsPerRsvp > 0 && (
              <label className="block">
                <span className="text-sm font-medium">Number of guests</span>
                <input
                  type="number"
                  min={0}
                  max={event.maxGuestsPerRsvp}
                  value={guestCount}
                  onChange={(e) =>
                    setGuestCount(
                      Math.min(
                        event.maxGuestsPerRsvp,
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    )
                  }
                  className="mt-1 w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                />
                <span className="ml-2 text-xs text-gray-500">
                  Up to {event.maxGuestsPerRsvp}
                </span>
              </label>
            )}

            {myRsvp?.waitlisted && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                This event is at capacity. You&apos;re on the waitlist; the school will let you know if a spot opens.
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || locked}
              className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-sm disabled:opacity-50"
            >
              {pending ? "Saving…" : myRsvp ? "Update RSVP" : "Save RSVP"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
