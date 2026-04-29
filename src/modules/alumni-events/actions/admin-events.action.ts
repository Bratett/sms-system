"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  createAlumniEventSchema,
  updateAlumniEventSchema,
  type CreateAlumniEventInput,
  type UpdateAlumniEventInput,
} from "../schemas/event.schema";
import { notifyAlumniEventPublished } from "../events-notifications";

// ─── Create draft ───────────────────────────────────────────────────

export async function createAlumniEventDraftAction(input: CreateAlumniEventInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_CREATE);
  if (denied) return denied;

  const parsed = createAlumniEventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const event = await db.alumniEvent.create({
    data: {
      schoolId: ctx.schoolId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt ?? null,
      location: parsed.data.location ?? null,
      virtualLink: parsed.data.virtualLink ?? null,
      capacity: parsed.data.capacity ?? null,
      maxGuestsPerRsvp: parsed.data.maxGuestsPerRsvp,
      rsvpDeadline: parsed.data.rsvpDeadline ?? null,
      status: "DRAFT",
      createdByUserId: ctx.session.user.id,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "AlumniEvent",
    entityId: event.id,
    module: "alumni",
    description: `Created alumni event draft: ${event.title}`,
    newData: event,
  });

  return { data: event };
}

// ─── Update ─────────────────────────────────────────────────────────

export async function updateAlumniEventAction(
  eventId: string,
  input: UpdateAlumniEventInput,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_CREATE);
  if (denied) return denied;

  const parsed = updateAlumniEventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const previous = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!previous) return { error: "Event not found" };

  if (previous.status === "CANCELED") {
    return { error: "Cannot edit a canceled event" };
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.startAt !== undefined) data.startAt = parsed.data.startAt;
  if (parsed.data.endAt !== undefined) data.endAt = parsed.data.endAt;
  if (parsed.data.location !== undefined) data.location = parsed.data.location;
  if (parsed.data.virtualLink !== undefined) {
    data.virtualLink = parsed.data.virtualLink === "" ? null : parsed.data.virtualLink;
  }
  if (parsed.data.capacity !== undefined) data.capacity = parsed.data.capacity;
  if (parsed.data.maxGuestsPerRsvp !== undefined) data.maxGuestsPerRsvp = parsed.data.maxGuestsPerRsvp;
  if (parsed.data.rsvpDeadline !== undefined) data.rsvpDeadline = parsed.data.rsvpDeadline;

  const updated = await db.alumniEvent.update({
    where: { id: eventId },
    data,
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "AlumniEvent",
    entityId: eventId,
    module: "alumni",
    description: `Updated alumni event: ${updated.title}`,
    previousData: previous,
    newData: updated,
  });

  return { data: updated };
}

// ─── Publish ────────────────────────────────────────────────────────

export async function publishAlumniEventAction(eventId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_CREATE);
  if (denied) return denied;

  const previous = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!previous) return { error: "Event not found" };

  if (previous.status === "CANCELED") {
    return { error: "Cannot publish a canceled event" };
  }
  if (previous.status === "PUBLISHED") {
    return { data: previous };  // idempotent
  }

  const updated = await db.alumniEvent.update({
    where: { id: eventId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  let recipientCount = 0;
  try {
    const result = await notifyAlumniEventPublished({
      eventId: updated.id,
      schoolId: ctx.schoolId,
      eventTitle: updated.title,
      startAt: updated.startAt,
    });
    recipientCount = result.recipientCount;
  } catch (err) {
    console.error("notifyAlumniEventPublished failed", { eventId: updated.id, err });
  }

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "AlumniEvent",
    entityId: eventId,
    module: "alumni",
    description: `Published alumni event: ${updated.title}`,
    previousData: previous,
    newData: updated,
    metadata: { eventTitle: updated.title, recipientCount },
  });

  return { data: updated };
}

// ─── Cancel ─────────────────────────────────────────────────────────

export async function cancelAlumniEventAction(eventId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_CREATE);
  if (denied) return denied;

  const previous = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!previous) return { error: "Event not found" };

  if (previous.status === "CANCELED") {
    return { data: previous };  // idempotent
  }

  const updated = await db.alumniEvent.update({
    where: { id: eventId },
    data: { status: "CANCELED", canceledAt: new Date() },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "AlumniEvent",
    entityId: eventId,
    module: "alumni",
    description: `Canceled alumni event: ${updated.title}`,
    previousData: previous,
    newData: updated,
  });

  return { data: updated };
}

// ─── List ───────────────────────────────────────────────────────────

/** @no-audit Read-only admin listing. */
export async function getAlumniEventListAction(filters?: {
  status?: "DRAFT" | "PUBLISHED" | "CANCELED";
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.status) where.status = filters.status;
  if (filters?.fromDate || filters?.toDate) {
    const startAt: Record<string, Date> = {};
    if (filters?.fromDate) startAt.gte = filters.fromDate;
    if (filters?.toDate) startAt.lte = filters.toDate;
    where.startAt = startAt;
  }

  const [events, total] = await Promise.all([
    db.alumniEvent.findMany({
      where,
      orderBy: { startAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.alumniEvent.count({ where }),
  ]);

  // Fetch RSVP aggregates for the page's events.
  const eventIds = events.map((e) => e.id);
  const aggregates = eventIds.length
    ? await db.alumniEventRsvp.groupBy({
        by: ["eventId", "response", "waitlisted"],
        where: { eventId: { in: eventIds } },
        _count: { _all: true },
        _sum: { guestCount: true },
      })
    : [];

  // Build a map: eventId -> { yes, no, maybe, confirmedHeadcount, waitlistHeadcount }
  type EventStats = {
    yesCount: number;
    noCount: number;
    maybeCount: number;
    confirmedHeadcount: number;
    waitlistHeadcount: number;
  };
  const statsByEvent = new Map<string, EventStats>();
  for (const agg of aggregates) {
    const stats = statsByEvent.get(agg.eventId) ?? {
      yesCount: 0,
      noCount: 0,
      maybeCount: 0,
      confirmedHeadcount: 0,
      waitlistHeadcount: 0,
    };
    if (agg.response === "YES") {
      stats.yesCount += agg._count._all;
      const head = agg._count._all + (agg._sum.guestCount ?? 0);
      if (agg.waitlisted) stats.waitlistHeadcount += head;
      else stats.confirmedHeadcount += head;
    } else if (agg.response === "NO") {
      stats.noCount += agg._count._all;
    } else if (agg.response === "MAYBE") {
      stats.maybeCount += agg._count._all;
    }
    statsByEvent.set(agg.eventId, stats);
  }

  const data = events.map((e) => ({
    ...e,
    ...(statsByEvent.get(e.id) ?? {
      yesCount: 0,
      noCount: 0,
      maybeCount: 0,
      confirmedHeadcount: 0,
      waitlistHeadcount: 0,
    }),
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ─── Detail ─────────────────────────────────────────────────────────

/** @no-audit Read-only admin detail. */
export async function getAlumniEventDetailAction(eventId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_READ);
  if (denied) return denied;

  const event = await db.alumniEvent.findFirst({
    where: { id: eventId, schoolId: ctx.schoolId },
  });
  if (!event) return { error: "Event not found" };

  const rsvps = await db.alumniEventRsvp.findMany({
    where: { eventId },
    include: {
      alumniProfile: {
        select: {
          studentId: true,
          graduationYear: true,
          currentEmployer: true,
        },
      },
    },
  });

  // AlumniProfile has no direct student relation — fetch students separately.
  const studentIds = rsvps.map((r) => r.alumniProfile.studentId);
  const students = studentIds.length
    ? await db.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, photoUrl: true },
      })
    : [];
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Sort: YES non-waitlisted (by name) → YES waitlisted → MAYBE → NO
  const responseOrder = { YES: 0, MAYBE: 2, NO: 3 } as const;
  const sorted = [...rsvps].sort((a, b) => {
    const ra = responseOrder[a.response];
    const rb = responseOrder[b.response];
    if (a.response === "YES" && b.response === "YES") {
      if (a.waitlisted !== b.waitlisted) return a.waitlisted ? 1 : -1;
    }
    if (ra !== rb) return ra - rb;
    const sa = studentMap.get(a.alumniProfile.studentId);
    const sb = studentMap.get(b.alumniProfile.studentId);
    const an = `${sa?.firstName ?? ""} ${sa?.lastName ?? ""}`;
    const bn = `${sb?.firstName ?? ""} ${sb?.lastName ?? ""}`;
    return an.localeCompare(bn);
  });

  const flatRsvps = sorted.map((r) => {
    const s = studentMap.get(r.alumniProfile.studentId);
    return {
      id: r.id,
      studentId: r.alumniProfile.studentId,
      firstName: s?.firstName ?? "Unknown",
      lastName: s?.lastName ?? "",
      photoUrl: s?.photoUrl ?? null,
      graduationYear: r.alumniProfile.graduationYear,
      currentEmployer: r.alumniProfile.currentEmployer,
      response: r.response,
      guestCount: r.guestCount,
      waitlisted: r.waitlisted,
      respondedAt: r.respondedAt,
    };
  });

  return {
    data: { event, rsvps: flatRsvps },
  };
}
