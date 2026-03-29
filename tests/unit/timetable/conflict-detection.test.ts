import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { createTimetableSlotAction } from "@/modules/timetable/actions/timetable.action";

describe("createTimetableSlotAction — conflict detection", () => {
  const validSlotData = {
    academicYearId: "ay-1",
    termId: "term-1",
    classArmId: "ca-1",
    subjectId: "sub-1",
    teacherId: "teacher-1",
    periodId: "period-1",
    roomId: "room-1",
    dayOfWeek: 1, // Monday
  };

  const createdSlot = {
    id: "slot-1",
    schoolId: "default-school",
    ...validSlotData,
    createdAt: new Date(),
    updatedAt: new Date(),
    subject: { name: "Mathematics" },
    teacher: { firstName: "John", lastName: "Doe" },
    period: { name: "Period 1" },
    room: { name: "Room A1" },
    classArm: { name: "A", class: { name: "SHS 1" } },
  };

  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should create a slot successfully when no conflicts exist", async () => {
    // No class arm conflict
    prismaMock.timetableSlot.findUnique.mockResolvedValue(null);
    // No teacher conflict
    prismaMock.timetableSlot.findFirst.mockResolvedValue(null);
    // Create the slot
    prismaMock.timetableSlot.create.mockResolvedValue(createdSlot as never);

    const result = await createTimetableSlotAction(validSlotData);

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
  });

  it("should reject when class arm already has a slot at same period+day+term", async () => {
    // Class arm conflict exists
    prismaMock.timetableSlot.findUnique.mockResolvedValue({
      id: "existing-slot",
      subject: { name: "English" },
    } as never);

    const result = await createTimetableSlotAction(validSlotData);

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Class arm conflict");
    expect(result.error).toContain("English");
  });

  it("should reject when teacher is already assigned at same period+day+term", async () => {
    // No class arm conflict
    prismaMock.timetableSlot.findUnique.mockResolvedValue(null);
    // Teacher conflict exists
    prismaMock.timetableSlot.findFirst.mockResolvedValue({
      id: "existing-slot",
      subject: { name: "Science" },
      classArm: { name: "B", class: { name: "SHS 2" } },
    } as never);

    const result = await createTimetableSlotAction(validSlotData);

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Teacher conflict");
    expect(result.error).toContain("Science");
  });

  it("should reject when room is already booked at same period+day+term", async () => {
    // No class arm conflict
    prismaMock.timetableSlot.findUnique.mockResolvedValue(null);
    // No teacher conflict (first call), room conflict (second call)
    prismaMock.timetableSlot.findFirst
      .mockResolvedValueOnce(null) // teacher check
      .mockResolvedValueOnce({
        id: "existing-slot",
        subject: { name: "Physics" },
        classArm: { name: "C", class: { name: "SHS 3" } },
      } as never); // room check

    const result = await createTimetableSlotAction(validSlotData);

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Room conflict");
    expect(result.error).toContain("Physics");
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();

    const result = await createTimetableSlotAction(validSlotData);

    expect(result).toEqual({ error: "Unauthorized" });
  });
});
