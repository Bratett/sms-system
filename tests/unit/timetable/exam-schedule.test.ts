import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createExamScheduleAction,
  getExamSchedulesAction,
} from "@/modules/timetable/actions/exam-schedule.action";

describe("createExamScheduleAction", () => {
  const validExamData = {
    academicYearId: "ay-1",
    termId: "term-1",
    subjectId: "sub-math",
    classId: "class-shs1",
    date: new Date("2026-06-15"),
    startTime: "09:00",
    endTime: "11:00",
    roomId: "room-1",
    invigilatorId: "staff-1",
    notes: "End of term exam",
  };

  const createdExam = {
    id: "exam-1",
    schoolId: "default-school",
    ...validExamData,
    createdAt: new Date(),
    updatedAt: new Date(),
    subject: { name: "Mathematics" },
    class: { name: "SHS 1" },
    room: { name: "Exam Hall A" },
    invigilator: { firstName: "Jane", lastName: "Smith" },
  };

  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should create an exam schedule successfully", async () => {
    prismaMock.examSchedule.create.mockResolvedValue(createdExam as never);

    const result = await createExamScheduleAction(validExamData);

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(prismaMock.examSchedule.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.examSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "default-school",
          subjectId: "sub-math",
          classId: "class-shs1",
          startTime: "09:00",
          endTime: "11:00",
        }),
      }),
    );
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();

    const result = await createExamScheduleAction(validExamData);

    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject when no school is configured", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await createExamScheduleAction(validExamData);

    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });
});

describe("getExamSchedulesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should list exam schedules with term filter", async () => {
    const examSchedules = [
      {
        id: "exam-1",
        schoolId: "default-school",
        date: new Date("2026-06-15"),
        startTime: "09:00",
        endTime: "11:00",
        notes: null,
        subject: { id: "sub-1", name: "Mathematics", code: "MATH" },
        class: { id: "class-1", name: "SHS 1" },
        room: { id: "room-1", name: "Exam Hall A", building: "Main Block" },
        invigilator: { id: "staff-1", firstName: "Jane", lastName: "Smith" },
        term: { id: "term-1", name: "Term 1" },
        academicYear: { id: "ay-1", name: "2025/2026" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    prismaMock.examSchedule.findMany.mockResolvedValue(examSchedules as never);

    const result = await getExamSchedulesAction({ termId: "term-1" });

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(result.data).toHaveLength(1);
    expect(prismaMock.examSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "default-school",
          termId: "term-1",
        }),
      }),
    );
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();

    const result = await getExamSchedulesAction({ termId: "term-1" });

    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return empty array when no schedules match", async () => {
    prismaMock.examSchedule.findMany.mockResolvedValue([] as never);

    const result = await getExamSchedulesAction({ termId: "term-nonexistent" });

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual([]);
  });
});
