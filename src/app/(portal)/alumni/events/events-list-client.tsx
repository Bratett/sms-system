"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { getMyAlumniEventsAction } from "@/modules/alumni-events/actions/alumni-events.action";

type Row = {
  id: string;
  title: string;
  startAt: Date | string;
  endAt: Date | string | null;
  location: string | null;
  virtualLink: string | null;
  status: "DRAFT" | "PUBLISHED" | "CANCELED";
  capacity: number | null;
  confirmedHeadcount: number;
  myRsvp: { response: "YES" | "NO" | "MAYBE"; guestCount: number; waitlisted: boolean } | null;
};

type Tab = "upcoming" | "past";

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function rsvpLabel(myRsvp: Row["myRsvp"]): string {
  if (!myRsvp) return "Not responded";
  if (myRsvp.response === "YES") {
    if (myRsvp.guestCount > 0) {
      return `YES — bringing ${myRsvp.guestCount} guest${myRsvp.guestCount === 1 ? "" : "s"}`;
    }
    return "YES";
  }
  return myRsvp.response;
}

export function EventsListClient({ initialRows }: { initialRows: Row[] }) {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [tab, setTab] = useState<Tab>("upcoming");
  const requestId = useRef(0);

  function switchTab(newTab: Tab) {
    setTab(newTab);
    const id = ++requestId.current;
    start(async () => {
      const res = await getMyAlumniEventsAction({ tab: newTab });
      if (id !== requestId.current) return; // stale response
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setRows(res.data as Row[]);
    });
  }

  const isPast = tab === "past";

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">Alumni events</h1>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => switchTab("upcoming")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "upcoming"
              ? "border-b-2 border-teal-600 text-teal-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Upcoming
        </button>
        <button
          type="button"
          onClick={() => switchTab("past")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "past"
              ? "border-b-2 border-teal-600 text-teal-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Past
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          {tab === "upcoming"
            ? "No upcoming alumni events. Check back soon."
            : "No past events to show."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((r) => {
            const locationSummary = r.virtualLink
              ? r.location
                ? "Online + venue"
                : "Online"
              : r.location ?? "Location TBA";
            const fillingUp =
              r.capacity !== null && r.confirmedHeadcount >= r.capacity * 0.8;
            const full = r.capacity !== null && r.confirmedHeadcount >= r.capacity;
            return (
              <Link
                key={r.id}
                href={`/alumni/events/${r.id}`}
                className={`rounded-xl border p-4 hover:bg-gray-50 ${
                  isPast ? "border-gray-200 bg-white opacity-70" : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{r.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(r.startAt)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{locationSummary}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                      r.myRsvp?.response === "YES"
                        ? "bg-green-100 text-green-800"
                        : r.myRsvp?.response === "MAYBE"
                          ? "bg-yellow-100 text-yellow-800"
                          : r.myRsvp?.response === "NO"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {rsvpLabel(r.myRsvp)}
                  </span>
                </div>
                {!isPast && full && (
                  <p className="mt-2 text-xs text-yellow-700">Waitlist only</p>
                )}
                {!isPast && !full && fillingUp && (
                  <p className="mt-2 text-xs text-yellow-700">Filling up</p>
                )}
                {r.status === "CANCELED" && (
                  <p className="mt-2 text-xs text-red-600">Canceled</p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {pending && <p className="text-xs text-gray-500">Loading…</p>}
    </div>
  );
}
