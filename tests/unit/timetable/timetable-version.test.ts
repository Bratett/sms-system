import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createTimetableVersionAction,
  getTimetableVersionsAction,
  publishTimetableVersionAction,
  restoreTimetableVersionAction,
} from "@/modules/timetable/actions/timetable-version.action";

// ─── createTimetableVersionAction ─────────────────────────────────────

describe("createTimetableVersionAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createTimetableVersionAction({
      termId: "t1",
      academicYearId: "ay1",
      name: "v1",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject when no slots exist", async () => {
    prismaMock.timetableSlot.findMany.mockResolvedValue([]);
    const result = await createTimetableVersionAction({
      termId: "t1",
      academicYearId: "ay1",
      name: "v1",
    });
    expect(result).toEqual({ error: "No timetable slots found for this term. Nothing to snapshot." });
  });

  it("should create a snapshot with slot data", async () => {
    const slots = [
      { classArmId: "ca1", subjectId: "s1", teacherId: "t1", periodId: "p1", roomId: "r1", dayOfWeek: 1 },
      { classArmId: "ca1", subjectId: "s2", teacherId: "t2", periodId: "p2", roomId: null, dayOfWeek: 1 },
    ];
    prismaMock.timetableSlot.findMany.mockResolvedValue(slots as never);
    prismaMock.timetableVersion.create.mockResolvedValue({
      id: "ver-1",
      name: "Before midterm",
    } as never);

    const result = await createTimetableVersionAction({
      termId: "t1",
      academicYearId: "ay1",
      name: "Before midterm",
    });

    expect(result.data).toBeDefined();
    expect(result.data?.slotCount).toBe(2);
    expect(prismaMock.timetableVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Before midterm",
          slots: slots,
        }),
      }),
    );
  });
});

// ─── getTimetableVersionsAction ───────────────────────────────────────

describe("getTimetableVersionsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should return versions with creator names", async () => {
    prismaMock.timetableVersion.findMany.mockResolvedValue([
      {
        id: "ver-1",
        name: "Initial",
        status: "PUBLISHED",
        slots: [{ classArmId: "ca1" }, { classArmId: "ca2" }],
        createdBy: "user-1",
        publishedAt: new Date(),
        createdAt: new Date(),
      },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", firstName: "Admin", lastName: "User" },
    ] as never);

    const result = await getTimetableVersionsAction("t1");
    expect(result.data).toHaveLength(1);
    expect(result.data![0]).toMatchObject({
      name: "Initial",
      status: "PUBLISHED",
      slotCount: 2,
      createdBy: "Admin User",
    });
  });
});

// ─── publishTimetableVersionAction ────────────────────────────────────

describe("publishTimetableVersionAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject when version not found", async () => {
    prismaMock.timetableVersion.findUnique.mockResolvedValue(null);
    const result = await publishTimetableVersionAction("nonexistent");
    expect(result).toEqual({ error: "Version not found." });
  });

  it("should reject already published versions", async () => {
    prismaMock.timetableVersion.findUnique.mockResolvedValue({
      id: "ver-1",
      status: "PUBLISHED",
    } as never);
    const result = await publishTimetableVersionAction("ver-1");
    expect(result).toEqual({ error: "Version is already published." });
  });

  it("should archive existing published and publish the new one", async () => {
    prismaMock.timetableVersion.findUnique.mockResolvedValue({
      id: "ver-2",
      status: "DRAFT",
      schoolId: "default-school",
      termId: "t1",
      name: "v2",
    } as never);
    prismaMock.timetableVersion.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.timetableVersion.update.mockResolvedValue({} as never);

    const result = await publishTimetableVersionAction("ver-2");
    expect(result).toEqual({ success: true });
    expect(prismaMock.timetableVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED" }),
        data: { status: "ARCHIVED" },
      }),
    );
    expect(prismaMock.timetableVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });
});

// ─── restoreTimetableVersionAction ────────────────────────────────────

describe("restoreTimetableVersionAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject when version not found", async () => {
    prismaMock.timetableVersion.findUnique.mockResolvedValue(null);
    const result = await restoreTimetableVersionAction("nonexistent");
    expect(result).toEqual({ error: "Version not found." });
  });

  it("should reject when version has no slot data", async () => {
    prismaMock.timetableVersion.findUnique.mockResolvedValue({
      id: "ver-1",
      slots: [],
      schoolId: "default-school",
      termId: "t1",
      academicYearId: "ay1",
      name: "empty",
    } as never);
    const result = await restoreTimetableVersionAction("ver-1");
    expect(result).toEqual({ error: "Version has no slot data to restore." });
  });

  it("should clear existing slots and recreate from snapshot", async () => {
    const snapshotSlots = [
      { classArmId: "ca1", subjectId: "s1", teacherId: "t1", periodId: "p1", roomId: "r1", dayOfWeek: 1 },
      { classArmId: "ca1", subjectId: "s2", teacherId: "t2", periodId: "p2", roomId: null, dayOfWeek: 2 },
    ];

    prismaMock.timetableVersion.findUnique.mockResolvedValue({
      id: "ver-1",
      slots: snapshotSlots,
      schoolId: "default-school",
      termId: "t1",
      academicYearId: "ay1",
      name: "snapshot",
    } as never);
    prismaMock.timetableSlot.deleteMany.mockResolvedValue({ count: 5 } as never);
    prismaMock.timetableSlot.createMany.mockResolvedValue({ count: 2 } as never);

    const result = await restoreTimetableVersionAction("ver-1");
    expect(result.data?.restored).toBe(2);
    expect(prismaMock.timetableSlot.deleteMany).toHaveBeenCalled();
    expect(prismaMock.timetableSlot.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ classArmId: "ca1", subjectId: "s1" }),
        ]),
      }),
    );
  });
});
