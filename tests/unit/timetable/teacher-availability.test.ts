import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getTeacherAvailabilityAction,
  setTeacherAvailabilityAction,
  getTeacherPreferenceAction,
  saveTeacherPreferenceAction,
} from "@/modules/timetable/actions/teacher-availability.action";

// ─── getTeacherAvailabilityAction ─────────────────────────────────────

describe("getTeacherAvailabilityAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getTeacherAvailabilityAction("t1", "term-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return availability entries", async () => {
    prismaMock.teacherAvailability.findMany.mockResolvedValue([
      { id: "a1", dayOfWeek: 1, periodId: "p1", isAvailable: true, reason: null },
      { id: "a2", dayOfWeek: 1, periodId: "p2", isAvailable: false, reason: "PTA meeting" },
    ] as never);

    const result = await getTeacherAvailabilityAction("t1", "term-1");
    expect(result.data).toHaveLength(2);
    expect(result.data![1]).toMatchObject({
      isAvailable: false,
      reason: "PTA meeting",
    });
  });
});

// ─── setTeacherAvailabilityAction ─────────────────────────────────────

describe("setTeacherAvailabilityAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await setTeacherAvailabilityAction({
      teacherId: "t1",
      termId: "term-1",
      entries: [],
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should upsert availability entries", async () => {
    prismaMock.teacherAvailability.upsert.mockResolvedValue({} as never);

    const result = await setTeacherAvailabilityAction({
      teacherId: "t1",
      termId: "term-1",
      entries: [
        { dayOfWeek: 1, periodId: "p1", isAvailable: true },
        { dayOfWeek: 1, periodId: "p2", isAvailable: false, reason: "Busy" },
        { dayOfWeek: 2, periodId: "p1", isAvailable: true },
      ],
    });

    expect(result.data?.updated).toBe(3);
    expect(prismaMock.teacherAvailability.upsert).toHaveBeenCalledTimes(3);
  });
});

// ─── getTeacherPreferenceAction ───────────────────────────────────────

describe("getTeacherPreferenceAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should return null when no preferences exist", async () => {
    prismaMock.teacherPreference.findUnique.mockResolvedValue(null);
    const result = await getTeacherPreferenceAction("t1", "term-1");
    expect(result.data).toBeNull();
  });

  it("should return preferences when they exist", async () => {
    prismaMock.teacherPreference.findUnique.mockResolvedValue({
      id: "pref-1",
      maxPeriodsPerDay: 6,
      maxConsecutivePeriods: 3,
      preferredPeriodIds: ["p1", "p2"],
      avoidPeriodIds: ["p5"],
      notes: "Prefers mornings",
    } as never);

    const result = await getTeacherPreferenceAction("t1", "term-1");
    expect(result.data).toMatchObject({
      maxPeriodsPerDay: 6,
      maxConsecutivePeriods: 3,
      notes: "Prefers mornings",
    });
  });
});

// ─── saveTeacherPreferenceAction ──────────────────────────────────────

describe("saveTeacherPreferenceAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should upsert teacher preferences", async () => {
    prismaMock.teacherPreference.upsert.mockResolvedValue({} as never);

    const result = await saveTeacherPreferenceAction({
      teacherId: "t1",
      termId: "term-1",
      maxPeriodsPerDay: 5,
      maxConsecutivePeriods: 2,
      notes: "No afternoons",
    });

    expect(result).toEqual({ success: true });
    expect(prismaMock.teacherPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teacherId_termId: { teacherId: "t1", termId: "term-1" },
        },
      }),
    );
  });
});
