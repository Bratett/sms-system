"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission, type Permission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import type { Session } from "next-auth";
import { upsertRsvpSchema, type UpsertRsvpInput } from "../schemas/event.schema";

// Reuse the assertAlumnusAccess helper pattern from sub-project A
// (src/modules/alumni/actions/alumni-self.action.ts). Inlined here to avoid
// cross-module export coupling, per plan.
async function assertAlumnusAccess<S extends Record<string, true>>(
  ctx: { session: Session; schoolId: string },
  permission: Permission,
  select: S,
): Promise<{ student: { [K in keyof S]: unknown } } | { error: string }> {
  const denied = assertPermission(ctx.session, permission);
  if (denied) return denied;
  const student = await db.student.findFirst({
    where: {
      userId: ctx.session.user.id,
      schoolId: ctx.schoolId,
      status: "GRADUATED",
    },
    select,
  });
  if (!student) {
    console.error("alumni: status check failed", {
      userId: ctx.session.user.id,
      permission,
    });
    return { error: "Alumni access not available." };
  }
  return { student: student as unknown as { [K in keyof S]: unknown } };
}

async function resolveAlumniProfileId(studentId: string): Promise<string | null> {
  const profile = await db.alumniProfile.findUnique({
    where: { studentId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

// ─── List my events ─────────────────────────────────────────────────

/** @no-audit Read-only alumnus events listing. */
export async function getMyAlumniEventsAction(filters?: {
  tab?: "upcoming" | "past";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const access = await assertAlumnusAccess(ctx, PERMISSIONS.ALUMNI_EVENTS_READ, { id: true });
  if ("error" in access) return access;
  const studentId = (access.student as { id: string }).id;
  const alumniProfileId = await resolveAlumniProfileId(studentId);
  if (!alumniProfileId) return { error: "Alumni profile not found" };

  const tab = filters?.tab ?? "upcoming";
  const now = new Date();

  const where: Record<string, unknown> =
    tab === "upcoming"
      ? {
          schoolId: ctx.schoolId,
          status: "PUBLISHED",
          startAt: { gte: now },
        }
      : {
          schoolId: ctx.schoolId,
          status: { in: ["PUBLISHED", "CANCELED"] },
          startAt: { lt: now },
        };

  const events = await db.alumniEvent.findMany({
    where,
    orderBy: { startAt: tab === "upcoming" ? "asc" : "desc" },
  });

  if (events.length === 0) return { data: [] };

  const eventIds = events.map((e) => e.id);

  // Own RSVPs for these events
  const myRsvps = await db.alumniEventRsvp.findMany({
    where: { eventId: { in: eventIds }, alumniProfileId },
  });
  const rsvpByEvent = new Map(myRsvps.map((r) => [r.eventId, r]));

  // Headcount aggregates for capacity hints
  const aggregates = await db.alumniEventRsvp.groupBy({
    by: ["eventId", "response", "waitlisted"],
    where: { eventId: { in: eventIds } },
    _count: { _all: true },
    _sum: { guestCount: true },
  });
  const headcountByEvent = new Map<string, number>();
  for (const a of aggregates) {
    if (a.response === "YES" && !a.waitlisted) {
      const head = a._count._all + (a._sum.guestCount ?? 0);
      headcountByEvent.set(a.eventId, (headcountByEvent.get(a.eventId) ?? 0) + head);
    }
  }

  const data = events.map((e) => {
    const myRsvp = rsvpByEvent.get(e.id);
    return {
      id: e.id,
      title: e.title,
      startAt: e.startAt,
      endAt: e.endAt,
      location: e.location,
      virtualLink: e.virtualLink,
      status: e.status,
      capacity: e.capacity,
      confirmedHeadcount: headcountByEvent.get(e.id) ?? 0,
      myRsvp: myRsvp
        ? {
            response: myRsvp.response,
            guestCount: myRsvp.guestCount,
            waitlisted: myRsvp.waitlisted,
          }
        : null,
    };
  });

  return { data };
}

// ─── Detail ─────────────────────────────────────────────────────────

/** @no-audit Read-only alumnus event detail. */
export async function getMyAlumniEventDetailAction(eventId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const access = await assertAlumnusAccess(ctx, PERMISSIONS.ALUMNI_EVENTS_READ, { id: true });
  if ("error" in access) return access;
  const studentId = (access.student as { id: string }).id;
  const alumniProfileId = await resolveAlumniProfileId(studentId);
  if (!alumniProfileId) return { error: "Alumni profile not found" };

  const event = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!event || event.status === "DRAFT") {
    return { error: "Event not found" };
  }

  const myRsvp = await db.alumniEventRsvp.findUnique({
    where: { eventId_alumniProfileId: { eventId, alumniProfileId } },
  });

  return {
    data: {
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        location: event.location,
        virtualLink: event.virtualLink,
        capacity: event.capacity,
        maxGuestsPerRsvp: event.maxGuestsPerRsvp,
        rsvpDeadline: event.rsvpDeadline,
        status: event.status,
      },
      myRsvp: myRsvp
        ? {
            response: myRsvp.response,
            guestCount: myRsvp.guestCount,
            waitlisted: myRsvp.waitlisted,
          }
        : null,
    },
  };
}

// ─── Upsert RSVP ────────────────────────────────────────────────────

export async function upsertMyEventRsvpAction(input: UpsertRsvpInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const access = await assertAlumnusAccess(ctx, PERMISSIONS.ALUMNI_EVENTS_RSVP, { id: true });
  if ("error" in access) return access;
  const studentId = (access.student as { id: string }).id;
  const alumniProfileId = await resolveAlumniProfileId(studentId);
  if (!alumniProfileId) return { error: "Alumni profile not found" };

  const parsed = upsertRsvpSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { eventId, response, guestCount } = parsed.data;

  const event = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!event || event.status !== "PUBLISHED") {
    return { error: "Event not available" };
  }
  const now = new Date();
  if (event.startAt <= now) {
    return { error: "Event has already taken place" };
  }
  if (event.rsvpDeadline && event.rsvpDeadline <= now) {
    return { error: "RSVP deadline has passed" };
  }
  if (guestCount > event.maxGuestsPerRsvp) {
    return {
      error: `At most ${event.maxGuestsPerRsvp} guest${event.maxGuestsPerRsvp === 1 ? "" : "s"} allowed per RSVP`,
    };
  }

  // Compute waitlisted
  let waitlisted = false;
  if (response === "YES" && event.capacity !== null) {
    const headcountAgg = await db.alumniEventRsvp.aggregate({
      where: {
        eventId,
        response: "YES",
        waitlisted: false,
        NOT: { alumniProfileId }, // exclude self
      },
      _count: { _all: true },
      _sum: { guestCount: true },
    });
    const currentHeadcount =
      (headcountAgg._count._all ?? 0) + (headcountAgg._sum.guestCount ?? 0);
    const newIncoming = 1 + guestCount;
    if (currentHeadcount + newIncoming > event.capacity) {
      waitlisted = true;
    }
  }

  // Detect create vs update for audit action label
  const previous = await db.alumniEventRsvp.findUnique({
    where: { eventId_alumniProfileId: { eventId, alumniProfileId } },
  });

  const rsvp = await db.alumniEventRsvp.upsert({
    where: { eventId_alumniProfileId: { eventId, alumniProfileId } },
    create: {
      eventId,
      alumniProfileId,
      response,
      guestCount,
      waitlisted,
    },
    update: {
      response,
      guestCount,
      waitlisted,
      respondedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: previous ? "UPDATE" : "CREATE",
    entity: "AlumniEventRsvp",
    entityId: rsvp.id,
    module: "alumni",
    description: previous
      ? `Alumnus updated RSVP: ${response}`
      : `Alumnus submitted RSVP: ${response}`,
    previousData: previous,
    newData: rsvp,
  });

  return { data: rsvp };
}
