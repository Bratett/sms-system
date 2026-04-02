import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";

vi.mock("@/lib/notifications/dispatcher", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/events", () => ({
  NOTIFICATION_EVENTS: {
    SUBSTITUTION_ASSIGNED: "substitution_assigned",
  },
}));

import {
  createSubstitutionAction,
  approveSubstitutionAction,
  rejectSubstitutionAction,
  getSubstitutionsAction,
  getAvailableSubstitutesAction,
} from "@/modules/timetable/actions/substitution.action";

// ─── createSubstitutionAction ─────────────────────────────────────────

describe("createSubstitutionAction", () => {
  const slot = {
    id: "slot-1",
    teacherId: "teacher-original",
    periodId: "period-1",
    subject: { name: "Mathematics" },
    classArm: { name: "A", class: { name: "SHS 1" } },
    period: { name: "Period 1", startTime: "08:00", endTime: "08:45" },
  };

  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createSubstitutionAction({
      timetableSlotId: "slot-1",
      substituteTeacherId: "teacher-sub",
      date: "2026-04-01",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject when no school is configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null);
    const result = await createSubstitutionAction({
      timetableSlotId: "slot-1",
      substituteTeacherId: "teacher-sub",
      date: "2026-04-01",
    });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should reject when timetable slot not found", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue(null);
    const result = await createSubstitutionAction({
      timetableSlotId: "nonexistent",
      substituteTeacherId: "teacher-sub",
      date: "2026-04-01",
    });
    expect(result).toEqual({ error: "Timetable slot not found." });
  });

  it("should reject duplicate substitution on same slot and date", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue(slot as never);
    prismaMock.timetableSubstitution.findUnique.mockResolvedValue({ id: "existing" } as never);

    const result = await createSubstitutionAction({
      timetableSlotId: "slot-1",
      substituteTeacherId: "teacher-sub",
      date: "2026-04-01",
    });
    expect(result).toEqual({ error: "A substitution already exists for this slot on this date." });
  });

  it("should create substitution successfully", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue(slot as never);
    prismaMock.timetableSubstitution.findUnique.mockResolvedValue(null);
    prismaMock.term.findFirst.mockResolvedValue({ id: "term-1" } as never);
    prismaMock.timetableSlot.findFirst.mockResolvedValue(null); // no conflict
    prismaMock.timetableSubstitution.create.mockResolvedValue({
      id: "sub-1",
      schoolId: "default-school",
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "teacher-sub",
      firstName: "John",
      lastName: "Doe",
      email: "john@school.edu.gh",
    } as never);

    const result = await createSubstitutionAction({
      timetableSlotId: "slot-1",
      substituteTeacherId: "teacher-sub",
      date: "2026-04-01",
      reason: "Sick leave",
    });

    expect(result.data).toBeDefined();
    expect(result.data?.id).toBe("sub-1");
    expect(prismaMock.timetableSubstitution.create).toHaveBeenCalled();
  });
});

// ─── approveSubstitutionAction ────────────────────────────────────────

describe("approveSubstitutionAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await approveSubstitutionAction("sub-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject when substitution not found", async () => {
    prismaMock.timetableSubstitution.findUnique.mockResolvedValue(null);
    const result = await approveSubstitutionAction("nonexistent");
    expect(result).toEqual({ error: "Substitution not found." });
  });

  it("should reject non-pending substitutions", async () => {
    prismaMock.timetableSubstitution.findUnique.mockResolvedValue({
      id: "sub-1",
      status: "APPROVED",
    } as never);
    const result = await approveSubstitutionAction("sub-1");
    expect(result).toEqual({ error: "Substitution is not pending." });
  });

  it("should approve a pending substitution", async () => {
    prismaMock.timetableSubstitution.findUnique.mockResolvedValue({
      id: "sub-1",
      status: "PENDING",
    } as never);
    prismaMock.timetableSubstitution.update.mockResolvedValue({} as never);

    const result = await approveSubstitutionAction("sub-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.timetableSubstitution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({ status: "APPROVED" }),
      }),
    );
  });
});

// ─── rejectSubstitutionAction ─────────────────────────────────────────

describe("rejectSubstitutionAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject non-pending substitutions", async () => {
    prismaMock.timetableSubstitution.findUnique.mockResolvedValue({
      id: "sub-1",
      status: "COMPLETED",
    } as never);
    const result = await rejectSubstitutionAction("sub-1");
    expect(result).toEqual({ error: "Substitution is not pending." });
  });

  it("should reject a pending substitution", async () => {
    prismaMock.timetableSubstitution.findUnique.mockResolvedValue({
      id: "sub-1",
      status: "PENDING",
    } as never);
    prismaMock.timetableSubstitution.update.mockResolvedValue({} as never);

    const result = await rejectSubstitutionAction("sub-1");
    expect(result).toEqual({ success: true });
  });
});

// ─── getSubstitutionsAction ───────────────────────────────────────────

describe("getSubstitutionsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should return paginated substitutions", async () => {
    prismaMock.timetableSubstitution.findMany.mockResolvedValue([
      {
        id: "sub-1",
        date: new Date("2026-04-01"),
        status: "PENDING",
        reason: "Sick",
        originalTeacherId: "t1",
        substituteTeacherId: "t2",
        createdAt: new Date(),
        timetableSlot: {
          subject: { name: "Math" },
          classArm: { name: "A", class: { name: "SHS 1" } },
          period: { name: "Period 1", startTime: "08:00", endTime: "08:45" },
        },
      },
    ] as never);
    prismaMock.timetableSubstitution.count.mockResolvedValue(1 as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "t1", firstName: "Jane", lastName: "Smith" },
      { id: "t2", firstName: "John", lastName: "Doe" },
    ] as never);

    const result = await getSubstitutionsAction({});
    expect(result.data).toHaveLength(1);
    expect(result.data![0]).toMatchObject({
      subject: "Math",
      className: "SHS 1 A",
      originalTeacher: "Jane Smith",
      substituteTeacher: "John Doe",
    });
    expect(result.pagination?.total).toBe(1);
  });
});

// ─── getAvailableSubstitutesAction ────────────────────────────────────

describe("getAvailableSubstitutesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should return teachers not scheduled for the given period", async () => {
    prismaMock.term.findFirst.mockResolvedValue({ id: "term-1" } as never);
    prismaMock.timetableSlot.findMany.mockResolvedValue([
      { teacherId: "t1" },
    ] as never);
    prismaMock.staff.findMany.mockResolvedValue([
      { userId: "t1", firstName: "Jane", lastName: "Smith" },
      { userId: "t2", firstName: "John", lastName: "Doe" },
      { userId: "t3", firstName: "Ama", lastName: "Mensah" },
    ] as never);

    const result = await getAvailableSubstitutesAction({
      periodId: "p1",
      dayOfWeek: 1,
      date: "2026-04-01",
    });

    expect(result.data).toHaveLength(2);
    expect(result.data!.map((t) => t.id)).toEqual(["t2", "t3"]);
  });
});
