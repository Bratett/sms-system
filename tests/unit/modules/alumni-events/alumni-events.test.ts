import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  getMyAlumniEventsAction,
  getMyAlumniEventDetailAction,
  upsertMyEventRsvpAction,
} from "@/modules/alumni-events/actions/alumni-events.action";

const ALUMNI_PERMS = ["alumni:events:read", "alumni:events:rsvp"];

const sampleStudent = { id: "s-1" };
const sampleProfile = { id: "ap-1" };

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

const sampleEvent = {
  id: "e-1",
  schoolId: "default-school",
  title: "Reunion",
  description: null,
  startAt: futureDate,
  endAt: null,
  location: "Hall",
  virtualLink: null,
  capacity: null,
  maxGuestsPerRsvp: 2,
  rsvpDeadline: null,
  status: "PUBLISHED" as const,
  publishedAt: new Date(),
  canceledAt: null,
  createdByUserId: "u-admin",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getMyAlumniEventsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.alumniEvent.findMany.mockReset();
    prismaMock.alumniEventRsvp.findMany.mockReset();
    prismaMock.alumniEventRsvp.groupBy.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getMyAlumniEventsAction({ tab: "upcoming" });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects non-graduated user", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const res = await getMyAlumniEventsAction({ tab: "upcoming" });
    expect(res).toEqual({ error: "Alumni access not available." });
  });

  it("upcoming tab filters published + future events; includes own RSVP", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findMany.mockResolvedValue([sampleEvent] as never);
    prismaMock.alumniEventRsvp.findMany.mockResolvedValue([
      {
        eventId: "e-1",
        response: "YES",
        guestCount: 1,
        waitlisted: false,
      },
    ] as never);
    prismaMock.alumniEventRsvp.groupBy.mockResolvedValue([] as never);

    const res = await getMyAlumniEventsAction({ tab: "upcoming" });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data[0].myRsvp?.response).toBe("YES");

    expect(prismaMock.alumniEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "default-school",
          status: "PUBLISHED",
          startAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
  });

  it("past tab filters past events; includes CANCELED", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findMany.mockResolvedValue([] as never);
    prismaMock.alumniEventRsvp.findMany.mockResolvedValue([] as never);
    prismaMock.alumniEventRsvp.groupBy.mockResolvedValue([] as never);

    await getMyAlumniEventsAction({ tab: "past" });

    expect(prismaMock.alumniEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["PUBLISHED", "CANCELED"] },
          startAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });
});

describe("getMyAlumniEventDetailAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEventRsvp.findUnique.mockReset();
  });

  it("returns 404 for DRAFT event", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "DRAFT",
    } as never);

    const res = await getMyAlumniEventDetailAction("e-1");
    expect(res).toEqual({ error: "Event not found" });
  });

  it("happy path returns event + own RSVP", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEventRsvp.findUnique.mockResolvedValue({
      response: "MAYBE",
      guestCount: 0,
      waitlisted: false,
    } as never);

    const res = await getMyAlumniEventDetailAction("e-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.event.id).toBe("e-1");
    expect(res.data.myRsvp?.response).toBe("MAYBE");
  });
});

describe("upsertMyEventRsvpAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ALUMNI_PERMS });
    prismaMock.student.findFirst.mockReset();
    prismaMock.alumniProfile.findUnique.mockReset();
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEventRsvp.findUnique.mockReset();
    prismaMock.alumniEventRsvp.upsert.mockReset();
    prismaMock.alumniEventRsvp.aggregate.mockReset();
    vi.mocked(audit).mockClear();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects RSVP on DRAFT event with generic 404", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "DRAFT",
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    expect(res).toEqual({ error: "Event not available" });
  });

  it("rejects RSVP after rsvpDeadline", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      rsvpDeadline: pastDate,
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    expect((res as { error: string }).error).toMatch(/deadline/i);
  });

  it("rejects RSVP after startAt", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      startAt: pastDate,
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    expect((res as { error: string }).error).toMatch(/already taken place/i);
  });

  it("rejects when guestCount exceeds maxGuestsPerRsvp", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      maxGuestsPerRsvp: 1,
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 5 });
    expect((res as { error: string }).error).toMatch(/at most 1 guest/i);
  });

  it("happy path with no capacity sets waitlisted=false", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEventRsvp.findUnique.mockResolvedValue(null as never);
    prismaMock.alumniEventRsvp.upsert.mockResolvedValue({
      id: "r-1",
      eventId: "e-1",
      alumniProfileId: "ap-1",
      response: "YES",
      guestCount: 0,
      waitlisted: false,
      respondedAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.waitlisted).toBe(false);
    expect(prismaMock.alumniEventRsvp.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ waitlisted: false }),
      }),
    );
  });

  it("capacity exceeded sets waitlisted=true", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      capacity: 2,
    } as never);
    prismaMock.alumniEventRsvp.findUnique.mockResolvedValue(null as never);
    // Existing headcount = 2 (one YES with 1 guest = 2 spots used)
    prismaMock.alumniEventRsvp.aggregate.mockResolvedValue({
      _count: { _all: 1 },
      _sum: { guestCount: 1 },
    } as never);
    prismaMock.alumniEventRsvp.upsert.mockResolvedValue({
      id: "r-2",
      eventId: "e-1",
      alumniProfileId: "ap-1",
      response: "YES",
      guestCount: 0,
      waitlisted: true,
      respondedAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 0 });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.waitlisted).toBe(true);
  });

  it("idempotent upsert (second call updates same row)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(sampleStudent as never);
    prismaMock.alumniProfile.findUnique.mockResolvedValue(sampleProfile as never);
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEventRsvp.findUnique.mockResolvedValue({
      id: "r-1",
      response: "MAYBE",
      guestCount: 0,
      waitlisted: false,
    } as never);
    prismaMock.alumniEventRsvp.upsert.mockResolvedValue({
      id: "r-1",
      response: "YES",
      guestCount: 1,
      waitlisted: false,
    } as never);

    const res = await upsertMyEventRsvpAction({ eventId: "e-1", response: "YES", guestCount: 1 });
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.response).toBe("YES");
    expect(prismaMock.alumniEventRsvp.upsert).toHaveBeenCalled();
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });
});
