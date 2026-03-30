import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createRoomAction,
  getRoomsAction,
  updateRoomAction,
  deleteRoomAction,
  createPeriodAction,
  getPeriodsAction,
  updatePeriodAction,
  deletePeriodAction,
  createTimetableSlotAction,
  getTimetableAction,
  updateTimetableSlotAction,
  deleteTimetableSlotAction,
} from "@/modules/timetable/actions/timetable.action";

// ═══════════════════════════════════════════════════════════════════
// ROOMS
// ═══════════════════════════════════════════════════════════════════

// ─── createRoomAction ─────────────────────────────────────────────

describe("createRoomAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createRoomAction({ name: "Room 1", type: "CLASSROOM" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await createRoomAction({ name: "Room 1", type: "CLASSROOM" });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should reject duplicate room name", async () => {
    prismaMock.room.findUnique.mockResolvedValue({
      id: "room-1",
      name: "Room 1",
    } as never);

    const result = await createRoomAction({ name: "Room 1", type: "CLASSROOM" });
    expect(result).toEqual({ error: 'A room named "Room 1" already exists.' });
  });

  it("should create room successfully", async () => {
    prismaMock.room.findUnique.mockResolvedValue(null as never);
    const mockRoom = {
      id: "room-new",
      name: "Lab 1",
      building: "Science Block",
      capacity: 40,
      type: "LABORATORY",
      schoolId: "default-school",
    };
    prismaMock.room.create.mockResolvedValue(mockRoom as never);

    const result = await createRoomAction({
      name: "Lab 1",
      building: "Science Block",
      capacity: 40,
      type: "LABORATORY",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof mockRoom }).data.name).toBe("Lab 1");
    expect(prismaMock.room.create).toHaveBeenCalled();
  });
});

// ─── getRoomsAction ───────────────────────────────────────────────

describe("getRoomsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getRoomsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getRoomsAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return rooms list", async () => {
    prismaMock.room.findMany.mockResolvedValue([
      {
        id: "room-1",
        name: "Room 1",
        building: "Main Block",
        capacity: 40,
        type: "CLASSROOM",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { timetableSlots: 3 },
      },
    ] as never);

    const result = await getRoomsAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Array<Record<string, unknown>> }).data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: "room-1",
      name: "Room 1",
      slotsCount: 3,
    });
  });

  it("should apply filters", async () => {
    prismaMock.room.findMany.mockResolvedValue([] as never);

    const result = await getRoomsAction({ type: "LABORATORY", search: "Lab" });
    expect(result).toHaveProperty("data");
    expect(prismaMock.room.findMany).toHaveBeenCalled();
  });
});

// ─── updateRoomAction ─────────────────────────────────────────────

describe("updateRoomAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateRoomAction("room-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await updateRoomAction("room-1", { name: "Updated" });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return error if room not found", async () => {
    prismaMock.room.findUnique.mockResolvedValue(null as never);
    const result = await updateRoomAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "Room not found." });
  });

  it("should reject duplicate name on rename", async () => {
    // First findUnique: existing room, second: duplicate check
    prismaMock.room.findUnique
      .mockResolvedValueOnce({
        id: "room-1",
        name: "Room 1",
        building: null,
        capacity: null,
        type: "CLASSROOM",
        isActive: true,
      } as never)
      .mockResolvedValueOnce({
        id: "room-2",
        name: "Room 2",
      } as never);

    const result = await updateRoomAction("room-1", { name: "Room 2" });
    expect(result).toEqual({ error: 'A room named "Room 2" already exists.' });
  });

  it("should update room successfully", async () => {
    prismaMock.room.findUnique
      .mockResolvedValueOnce({
        id: "room-1",
        name: "Room 1",
        building: null,
        capacity: null,
        type: "CLASSROOM",
        isActive: true,
      } as never)
      .mockResolvedValueOnce(null as never); // no duplicate

    const updated = {
      id: "room-1",
      name: "Room 1 Updated",
      building: "Block A",
      capacity: 50,
      type: "CLASSROOM",
      isActive: true,
    };
    prismaMock.room.update.mockResolvedValue(updated as never);

    const result = await updateRoomAction("room-1", {
      name: "Room 1 Updated",
      building: "Block A",
      capacity: 50,
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof updated }).data.name).toBe("Room 1 Updated");
  });
});

// ─── deleteRoomAction ─────────────────────────────────────────────

describe("deleteRoomAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteRoomAction("room-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if room not found", async () => {
    prismaMock.room.findUnique.mockResolvedValue(null as never);
    const result = await deleteRoomAction("nonexistent");
    expect(result).toEqual({ error: "Room not found." });
  });

  it("should reject deletion if room has timetable slots", async () => {
    prismaMock.room.findUnique.mockResolvedValue({
      id: "room-1",
      name: "Room 1",
      _count: { timetableSlots: 3, examSchedules: 0 },
    } as never);

    const result = await deleteRoomAction("room-1");
    expect(result).toEqual({
      error: "Cannot delete room that is assigned to timetable slots. Remove all slot assignments first.",
    });
  });

  it("should reject deletion if room has exam schedules", async () => {
    prismaMock.room.findUnique.mockResolvedValue({
      id: "room-1",
      name: "Room 1",
      _count: { timetableSlots: 0, examSchedules: 2 },
    } as never);

    const result = await deleteRoomAction("room-1");
    expect(result).toEqual({
      error: "Cannot delete room that is assigned to exam schedules. Remove all exam assignments first.",
    });
  });

  it("should delete room successfully", async () => {
    prismaMock.room.findUnique.mockResolvedValue({
      id: "room-1",
      name: "Room 1",
      _count: { timetableSlots: 0, examSchedules: 0 },
    } as never);
    prismaMock.room.delete.mockResolvedValue({} as never);

    const result = await deleteRoomAction("room-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.room.delete).toHaveBeenCalledWith({ where: { id: "room-1" } });
  });
});

// ═══════════════════════════════════════════════════════════════════
// PERIODS
// ═══════════════════════════════════════════════════════════════════

// ─── createPeriodAction ───────────────────────────────────────────

describe("createPeriodAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createPeriodAction({
      name: "Period 1",
      startTime: "08:00",
      endTime: "08:45",
      order: 1,
      type: "LESSON",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await createPeriodAction({
      name: "Period 1",
      startTime: "08:00",
      endTime: "08:45",
      order: 1,
      type: "LESSON",
    });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should reject duplicate order", async () => {
    prismaMock.period.findUnique.mockResolvedValue({
      id: "p-1",
      order: 1,
    } as never);

    const result = await createPeriodAction({
      name: "Period 1",
      startTime: "08:00",
      endTime: "08:45",
      order: 1,
      type: "LESSON",
    });
    expect(result).toEqual({ error: "A period with order 1 already exists." });
  });

  it("should create period successfully", async () => {
    prismaMock.period.findUnique.mockResolvedValue(null as never);
    const mockPeriod = {
      id: "p-new",
      name: "Period 1",
      startTime: "08:00",
      endTime: "08:45",
      order: 1,
      type: "LESSON",
      schoolId: "default-school",
    };
    prismaMock.period.create.mockResolvedValue(mockPeriod as never);

    const result = await createPeriodAction({
      name: "Period 1",
      startTime: "08:00",
      endTime: "08:45",
      order: 1,
      type: "LESSON",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof mockPeriod }).data.name).toBe("Period 1");
  });
});

// ─── getPeriodsAction ─────────────────────────────────────────────

describe("getPeriodsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getPeriodsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getPeriodsAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return periods list ordered by order", async () => {
    prismaMock.period.findMany.mockResolvedValue([
      { id: "p-1", name: "Period 1", startTime: "08:00", endTime: "08:45", order: 1, type: "LESSON" },
      { id: "p-2", name: "Break", startTime: "08:45", endTime: "09:00", order: 2, type: "BREAK" },
    ] as never);

    const result = await getPeriodsAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: unknown[] }).data;
    expect(data).toHaveLength(2);
  });
});

// ─── updatePeriodAction ───────────────────────────────────────────

describe("updatePeriodAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updatePeriodAction("p-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await updatePeriodAction("p-1", { name: "Updated" });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return error if period not found", async () => {
    prismaMock.period.findUnique.mockResolvedValue(null as never);
    const result = await updatePeriodAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "Period not found." });
  });

  it("should reject duplicate order on reorder", async () => {
    // First findUnique: existing period, second: duplicate check
    prismaMock.period.findUnique
      .mockResolvedValueOnce({
        id: "p-1",
        name: "Period 1",
        startTime: "08:00",
        endTime: "08:45",
        order: 1,
        type: "LESSON",
        isActive: true,
      } as never)
      .mockResolvedValueOnce({
        id: "p-2",
        order: 2,
      } as never);

    const result = await updatePeriodAction("p-1", { order: 2 });
    expect(result).toEqual({ error: "A period with order 2 already exists." });
  });

  it("should update period successfully", async () => {
    prismaMock.period.findUnique.mockResolvedValueOnce({
      id: "p-1",
      name: "Period 1",
      startTime: "08:00",
      endTime: "08:45",
      order: 1,
      type: "LESSON",
      isActive: true,
    } as never);

    const updated = {
      id: "p-1",
      name: "Period 1 Updated",
      startTime: "08:00",
      endTime: "09:00",
      order: 1,
      type: "LESSON",
      isActive: true,
    };
    prismaMock.period.update.mockResolvedValue(updated as never);

    const result = await updatePeriodAction("p-1", {
      name: "Period 1 Updated",
      endTime: "09:00",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof updated }).data.name).toBe("Period 1 Updated");
  });
});

// ─── deletePeriodAction ───────────────────────────────────────────

describe("deletePeriodAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deletePeriodAction("p-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if period not found", async () => {
    prismaMock.period.findUnique.mockResolvedValue(null as never);
    const result = await deletePeriodAction("nonexistent");
    expect(result).toEqual({ error: "Period not found." });
  });

  it("should reject deletion if period has timetable slots", async () => {
    prismaMock.period.findUnique.mockResolvedValue({
      id: "p-1",
      name: "Period 1",
      _count: { timetableSlots: 5 },
    } as never);

    const result = await deletePeriodAction("p-1");
    expect(result).toEqual({
      error: "Cannot delete period that has timetable slots assigned. Remove all slot assignments first.",
    });
  });

  it("should delete period successfully", async () => {
    prismaMock.period.findUnique.mockResolvedValue({
      id: "p-1",
      name: "Period 1",
      _count: { timetableSlots: 0 },
    } as never);
    prismaMock.period.delete.mockResolvedValue({} as never);

    const result = await deletePeriodAction("p-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.period.delete).toHaveBeenCalledWith({ where: { id: "p-1" } });
  });
});

// ═══════════════════════════════════════════════════════════════════
// TIMETABLE SLOTS
// ═══════════════════════════════════════════════════════════════════

const slotData = {
  academicYearId: "ay-1",
  termId: "term-1",
  classArmId: "ca-1",
  subjectId: "sub-1",
  teacherId: "teacher-1",
  periodId: "p-1",
  roomId: "room-1",
  dayOfWeek: 1,
};

// ─── createTimetableSlotAction ────────────────────────────────────

describe("createTimetableSlotAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createTimetableSlotAction(slotData);
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await createTimetableSlotAction(slotData);
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should reject class arm conflict", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue({
      id: "existing-slot",
      subject: { name: "Math" },
    } as never);

    const result = await createTimetableSlotAction(slotData);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Class arm conflict");
  });

  it("should reject teacher conflict", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue(null as never); // no class arm conflict
    prismaMock.timetableSlot.findFirst.mockResolvedValueOnce({
      id: "existing-slot",
      subject: { name: "English" },
      classArm: { name: "B", class: { name: "SHS 2" } },
    } as never);

    const result = await createTimetableSlotAction(slotData);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Teacher conflict");
  });

  it("should reject room conflict", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue(null as never); // no class arm conflict
    prismaMock.timetableSlot.findFirst
      .mockResolvedValueOnce(null as never) // no teacher conflict
      .mockResolvedValueOnce({
        id: "existing-slot",
        subject: { name: "Science" },
        classArm: { name: "A", class: { name: "SHS 1" } },
      } as never);

    const result = await createTimetableSlotAction(slotData);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Room conflict");
  });

  it("should create slot successfully when no conflicts", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue(null as never);
    prismaMock.timetableSlot.findFirst
      .mockResolvedValueOnce(null as never) // no teacher conflict
      .mockResolvedValueOnce(null as never); // no room conflict

    const mockSlot = {
      id: "slot-new",
      dayOfWeek: 1,
      subject: { name: "Math" },
      teacher: { firstName: "Ama", lastName: "Boateng" },
      period: { name: "Period 1" },
      room: { name: "Room 1" },
      classArm: { name: "A", class: { name: "SHS 1" } },
    };
    prismaMock.timetableSlot.create.mockResolvedValue(mockSlot as never);

    const result = await createTimetableSlotAction(slotData);
    expect(result).toHaveProperty("data");
    expect(prismaMock.timetableSlot.create).toHaveBeenCalled();
  });

  it("should skip room conflict check when no roomId", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue(null as never);
    prismaMock.timetableSlot.findFirst.mockResolvedValue(null as never); // no teacher conflict

    const mockSlot = {
      id: "slot-new",
      dayOfWeek: 1,
      subject: { name: "Math" },
      teacher: { firstName: "Ama", lastName: "Boateng" },
      period: { name: "Period 1" },
      room: null,
      classArm: { name: "A", class: { name: "SHS 1" } },
    };
    prismaMock.timetableSlot.create.mockResolvedValue(mockSlot as never);

    const { roomId, ...slotDataNoRoom } = slotData;
    const result = await createTimetableSlotAction(slotDataNoRoom as typeof slotData);
    expect(result).toHaveProperty("data");
    // findFirst should only be called once (teacher check), not twice (no room check)
    expect(prismaMock.timetableSlot.findFirst).toHaveBeenCalledTimes(1);
  });
});

// ─── getTimetableAction ───────────────────────────────────────────

describe("getTimetableAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getTimetableAction({});
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getTimetableAction({});
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return timetable slots", async () => {
    prismaMock.timetableSlot.findMany.mockResolvedValue([
      {
        id: "slot-1",
        dayOfWeek: 1,
        subject: { id: "sub-1", name: "Math", code: "MTH" },
        teacher: { id: "t-1", firstName: "Ama", lastName: "Boateng" },
        period: { id: "p-1", name: "Period 1", startTime: "08:00", endTime: "08:45", order: 1, type: "LESSON" },
        room: { id: "room-1", name: "Room 1", building: "Main" },
        classArm: { id: "ca-1", name: "A", class: { id: "cls-1", name: "SHS 1" } },
        term: { id: "term-1", name: "Term 1" },
        academicYear: { id: "ay-1", name: "2025/2026" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    const result = await getTimetableAction({ classArmId: "ca-1" });
    expect(result).toHaveProperty("data");
    const data = (result as { data: Array<Record<string, unknown>> }).data;
    expect(data).toHaveLength(1);
    expect(data[0]).toHaveProperty("subject");
    expect(data[0]).toHaveProperty("teacher");
    expect(data[0]).toHaveProperty("period");
  });
});

// ─── updateTimetableSlotAction ────────────────────────────────────

describe("updateTimetableSlotAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateTimetableSlotAction("slot-1", { subjectId: "sub-2" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if slot not found", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue(null as never);
    const result = await updateTimetableSlotAction("nonexistent", { subjectId: "sub-2" });
    expect(result).toEqual({ error: "Timetable slot not found." });
  });

  it("should update slot successfully when no conflicts", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue({
      id: "slot-1",
      classArmId: "ca-1",
      subjectId: "sub-1",
      teacherId: "t-1",
      periodId: "p-1",
      roomId: "room-1",
      dayOfWeek: 1,
      termId: "term-1",
    } as never);

    // No conflicts
    prismaMock.timetableSlot.findFirst.mockResolvedValue(null as never);

    const updated = {
      id: "slot-1",
      subjectId: "sub-2",
      subject: { name: "English" },
      teacher: { firstName: "Ama", lastName: "Boateng" },
      period: { name: "Period 1" },
      classArm: { name: "A", class: { name: "SHS 1" } },
    };
    prismaMock.timetableSlot.update.mockResolvedValue(updated as never);

    const result = await updateTimetableSlotAction("slot-1", { subjectId: "sub-2" });
    expect(result).toHaveProperty("data");
  });

  it("should reject teacher conflict on update", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue({
      id: "slot-1",
      classArmId: "ca-1",
      subjectId: "sub-1",
      teacherId: "t-1",
      periodId: "p-1",
      roomId: null,
      dayOfWeek: 1,
      termId: "term-1",
    } as never);

    prismaMock.timetableSlot.findFirst.mockResolvedValueOnce({
      id: "slot-2",
      subject: { name: "Science" },
      classArm: { name: "B", class: { name: "SHS 1" } },
    } as never);

    const result = await updateTimetableSlotAction("slot-1", { teacherId: "t-2" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Teacher conflict");
  });
});

// ─── deleteTimetableSlotAction ────────────────────────────────────

describe("deleteTimetableSlotAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteTimetableSlotAction("slot-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if slot not found", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue(null as never);
    const result = await deleteTimetableSlotAction("nonexistent");
    expect(result).toEqual({ error: "Timetable slot not found." });
  });

  it("should delete slot successfully", async () => {
    prismaMock.timetableSlot.findUnique.mockResolvedValue({
      id: "slot-1",
      subject: { name: "Math" },
      classArm: { name: "A", class: { name: "SHS 1" } },
      period: { name: "Period 1" },
    } as never);
    prismaMock.timetableSlot.delete.mockResolvedValue({} as never);

    const result = await deleteTimetableSlotAction("slot-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.timetableSlot.delete).toHaveBeenCalledWith({
      where: { id: "slot-1" },
    });
  });
});
