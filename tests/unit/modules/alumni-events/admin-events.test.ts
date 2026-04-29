import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { audit } from "@/lib/audit";
import {
  createAlumniEventDraftAction,
  updateAlumniEventAction,
  publishAlumniEventAction,
  cancelAlumniEventAction,
  getAlumniEventListAction,
  getAlumniEventDetailAction,
} from "@/modules/alumni-events/actions/admin-events.action";
import { notifyAlumniEventPublished } from "@/modules/alumni-events/events-notifications";

vi.mock("@/modules/alumni-events/events-notifications", () => ({
  notifyAlumniEventPublished: vi.fn().mockResolvedValue({ recipientCount: 0 }),
}));

const ADMIN_PERMS_WRITE = ["graduation:records:create"];
const ADMIN_PERMS_READ = ["graduation:records:read"];

const sampleEvent = {
  id: "e-1",
  schoolId: "default-school",
  title: "Class of 2026 Reunion",
  description: null,
  startAt: new Date("2027-06-15T18:00:00Z"),
  endAt: null,
  location: "Main Hall",
  virtualLink: null,
  capacity: null,
  maxGuestsPerRsvp: 0,
  rsvpDeadline: null,
  status: "DRAFT",
  publishedAt: null,
  canceledAt: null,
  createdByUserId: "test-user-id",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("createAlumniEventDraftAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_WRITE });
    prismaMock.alumniEvent.create.mockReset();
    vi.mocked(audit).mockClear();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await createAlumniEventDraftAction({
      title: "X",
      startAt: new Date("2027-06-15"),
    });
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("rejects empty title", async () => {
    const res = await createAlumniEventDraftAction({
      title: "",
      startAt: new Date("2027-06-15"),
    });
    expect("error" in res).toBe(true);
  });

  it("rejects endAt before startAt", async () => {
    const res = await createAlumniEventDraftAction({
      title: "X",
      startAt: new Date("2027-06-15"),
      endAt: new Date("2027-06-14"),
    });
    expect("error" in res).toBe(true);
  });

  it("happy path creates DRAFT event and audits", async () => {
    prismaMock.alumniEvent.create.mockResolvedValue(sampleEvent as never);

    const res = await createAlumniEventDraftAction({
      title: "Class of 2026 Reunion",
      startAt: new Date("2027-06-15T18:00:00Z"),
      location: "Main Hall",
    });

    expect("data" in res).toBe(true);
    expect(prismaMock.alumniEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Class of 2026 Reunion",
          status: "DRAFT",
          schoolId: "default-school",
          createdByUserId: "test-user-id",
        }),
      }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });
});

describe("updateAlumniEventAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_WRITE });
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEvent.update.mockReset();
    vi.mocked(audit).mockClear();
  });

  it("rejects when event not found in school", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(null as never);
    const res = await updateAlumniEventAction("e-1", { title: "New" });
    expect(res).toEqual({ error: "Event not found" });
  });

  it("rejects edits when event is CANCELED", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "CANCELED",
    } as never);
    const res = await updateAlumniEventAction("e-1", { title: "New" });
    expect((res as { error: string }).error).toMatch(/cannot edit.*canceled/i);
  });

  it("happy path partial update only writes supplied fields", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEvent.update.mockResolvedValue({
      ...sampleEvent,
      title: "Updated",
    } as never);

    await updateAlumniEventAction("e-1", { title: "Updated" });

    expect(prismaMock.alumniEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e-1" },
        data: { title: "Updated" },
      }),
    );
  });
});

describe("publishAlumniEventAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_WRITE });
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEvent.update.mockReset();
    vi.mocked(notifyAlumniEventPublished).mockClear();
    vi.mocked(notifyAlumniEventPublished).mockResolvedValue({ recipientCount: 5 });
  });

  it("idempotent: PUBLISHED event returns without re-firing fan-out", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "PUBLISHED",
    } as never);

    await publishAlumniEventAction("e-1");

    expect(prismaMock.alumniEvent.update).not.toHaveBeenCalled();
    expect(vi.mocked(notifyAlumniEventPublished)).not.toHaveBeenCalled();
  });

  it("rejects publish on CANCELED event", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "CANCELED",
    } as never);

    const res = await publishAlumniEventAction("e-1");
    expect((res as { error: string }).error).toMatch(/cannot publish.*canceled/i);
  });

  it("happy path: flips DRAFT→PUBLISHED and fires fan-out", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEvent.update.mockResolvedValue({
      ...sampleEvent,
      status: "PUBLISHED",
      publishedAt: new Date(),
    } as never);

    await publishAlumniEventAction("e-1");

    expect(prismaMock.alumniEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e-1" },
        data: expect.objectContaining({
          status: "PUBLISHED",
          publishedAt: expect.any(Date),
        }),
      }),
    );
    expect(vi.mocked(notifyAlumniEventPublished)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "e-1",
        schoolId: "default-school",
        eventTitle: "Class of 2026 Reunion",
      }),
    );
  });

  it("fan-out failure does not roll back publish", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEvent.update.mockResolvedValue({
      ...sampleEvent,
      status: "PUBLISHED",
    } as never);
    vi.mocked(notifyAlumniEventPublished).mockRejectedValueOnce(new Error("hub down"));

    const res = await publishAlumniEventAction("e-1");

    expect("data" in res).toBe(true);  // publish still committed
  });
});

describe("cancelAlumniEventAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_WRITE });
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEvent.update.mockReset();
  });

  it("idempotent: already-CANCELED returns existing", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "CANCELED",
    } as never);

    await cancelAlumniEventAction("e-1");
    expect(prismaMock.alumniEvent.update).not.toHaveBeenCalled();
  });

  it("happy path: flips to CANCELED with canceledAt set", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue({
      ...sampleEvent,
      status: "PUBLISHED",
    } as never);
    prismaMock.alumniEvent.update.mockResolvedValue({
      ...sampleEvent,
      status: "CANCELED",
      canceledAt: new Date(),
    } as never);

    await cancelAlumniEventAction("e-1");

    expect(prismaMock.alumniEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANCELED",
          canceledAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe("getAlumniEventListAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_READ });
    prismaMock.alumniEvent.findMany.mockReset();
    prismaMock.alumniEvent.count.mockReset();
    prismaMock.alumniEventRsvp.groupBy.mockReset();
  });

  it("rejects unauthorized", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const res = await getAlumniEventListAction({});
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("returns rows with computed yesCount + confirmedHeadcount", async () => {
    prismaMock.alumniEvent.findMany.mockResolvedValue([sampleEvent] as never);
    prismaMock.alumniEvent.count.mockResolvedValue(1 as never);
    prismaMock.alumniEventRsvp.groupBy.mockResolvedValue([
      { eventId: "e-1", response: "YES", _count: { _all: 3 }, _sum: { guestCount: 2 } },
    ] as never);

    const res = await getAlumniEventListAction({});
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data[0].yesCount).toBe(3);
    expect(res.data[0].confirmedHeadcount).toBeGreaterThan(0);
  });
});

describe("getAlumniEventDetailAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ADMIN_PERMS_READ });
    prismaMock.alumniEvent.findFirst.mockReset();
    prismaMock.alumniEventRsvp.findMany.mockReset();
    prismaMock.student.findMany.mockReset();
  });

  it("returns event + sorted RSVP table", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(sampleEvent as never);
    prismaMock.alumniEventRsvp.findMany.mockResolvedValue([
      {
        id: "r-1",
        response: "NO",
        guestCount: 0,
        waitlisted: false,
        respondedAt: new Date(),
        alumniProfile: {
          studentId: "s-1",
          graduationYear: 2026,
          currentEmployer: "Acme",
        },
      },
      {
        id: "r-2",
        response: "YES",
        guestCount: 1,
        waitlisted: false,
        respondedAt: new Date(),
        alumniProfile: {
          studentId: "s-2",
          graduationYear: 2025,
          currentEmployer: "Co",
        },
      },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s-1", firstName: "A", lastName: "B", photoUrl: null },
      { id: "s-2", firstName: "C", lastName: "D", photoUrl: null },
    ] as never);

    const res = await getAlumniEventDetailAction("e-1");
    if (!("data" in res)) throw new Error("expected data");
    expect(res.data.rsvps[0].response).toBe("YES");  // YES first
    expect(res.data.rsvps[1].response).toBe("NO");
  });

  it("returns Event not found for cross-school", async () => {
    prismaMock.alumniEvent.findFirst.mockResolvedValue(null as never);
    const res = await getAlumniEventDetailAction("e-1");
    expect(res).toEqual({ error: "Event not found" });
  });
});
