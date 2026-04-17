import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getStudentsAction,
  getStudentAction,
  createStudentAction,
  updateStudentAction,
  deleteStudentAction,
  enrollStudentAction,
  getStudentStatsAction,
} from "@/modules/student/actions/student.action";

// ─── getStudentsAction ─────────────────────────────────────────────

describe("getStudentsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStudentsAction({});
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });
    const result = await getStudentsAction({});
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should return paginated students with defaults", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    prismaMock.student.count.mockResolvedValue(0 as never);

    const result = await getStudentsAction({});
    expect(result).toEqual({ students: [], total: 0, page: 1, pageSize: 25 });
  });

  it("should return students mapped with enrollment info", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      {
        id: "s1",
        studentId: "SCH/2026/0001",
        firstName: "Kwame",
        lastName: "Asante",
        otherNames: null,
        gender: "MALE",
        dateOfBirth: new Date("2008-01-01"),
        boardingStatus: "DAY",
        status: "ACTIVE",
        photoUrl: null,
        createdAt: new Date(),
        enrollments: [
          {
            classArm: {
              name: "A",
              class: { id: "cls-1", name: "SHS 1", programmeId: "prog-1" },
            },
          },
        ],
      },
    ] as never);
    prismaMock.student.count.mockResolvedValue(1 as never);
    prismaMock.programme.findMany.mockResolvedValue([
      { id: "prog-1", name: "General Science" },
    ] as never);

    const result = await getStudentsAction({ page: 1, pageSize: 10 });
    expect(result).toHaveProperty("students");
    expect(result).toHaveProperty("total", 1);
    const students = (result as { students: Array<Record<string, unknown>> }).students;
    expect(students[0]).toMatchObject({
      id: "s1",
      firstName: "Kwame",
      className: "SHS 1",
      classArmName: "SHS 1 A",
      programmeName: "General Science",
    });
  });

  it("should apply search filter", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    prismaMock.student.count.mockResolvedValue(0 as never);

    const result = await getStudentsAction({ search: "Kwame" });
    expect(result).toHaveProperty("students");
    expect(prismaMock.student.findMany).toHaveBeenCalled();
  });

  it("should apply status and gender filters", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    prismaMock.student.count.mockResolvedValue(0 as never);

    const result = await getStudentsAction({ status: "ACTIVE", gender: "MALE" });
    expect(result).toHaveProperty("students");
  });
});

// ─── getStudentAction ──────────────────────────────────────────────

describe("getStudentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStudentAction("s1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null as never);
    const result = await getStudentAction("nonexistent");
    expect(result).toEqual({ error: "Student not found." });
  });

  it("should return student profile with guardians and enrollments", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      firstName: "Kwame",
      lastName: "Asante",
      otherNames: null,
      dateOfBirth: new Date("2008-01-01"),
      gender: "MALE",
      nationality: "Ghanaian",
      hometown: "Accra",
      region: "Greater Accra",
      religion: null,
      bloodGroup: null,
      medicalConditions: null,
      allergies: null,
      photoUrl: null,
      boardingStatus: "DAY",
      status: "ACTIVE",
      enrollmentDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      guardians: [
        {
          guardian: {
            id: "g1",
            firstName: "Kofi",
            lastName: "Asante",
            phone: "0241234567",
            altPhone: null,
            email: "kofi@example.com",
            occupation: "Teacher",
            address: "Accra",
            relationship: "Father",
          },
          isPrimary: true,
        },
      ],
      enrollments: [
        {
          id: "e1",
          classArmId: "ca-1",
          enrollmentDate: new Date(),
          status: "ACTIVE",
          classArm: {
            name: "A",
            class: {
              id: "cls-1",
              name: "SHS 1",
              yearGroup: 1,
              programmeId: "prog-1",
              academicYearId: "ay-1",
            },
          },
        },
      ],
      houseAssignment: null,
    } as never);
    prismaMock.programme.findMany.mockResolvedValue([
      { id: "prog-1", name: "General Science" },
    ] as never);
    prismaMock.academicYear.findMany.mockResolvedValue([
      { id: "ay-1", name: "2025/2026" },
    ] as never);

    const result = await getStudentAction("s1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      id: "s1",
      firstName: "Kwame",
      lastName: "Asante",
    });
    expect((data.guardians as Array<Record<string, unknown>>)[0]).toMatchObject({
      firstName: "Kofi",
      isPrimary: true,
    });
    expect((data.enrollments as Array<Record<string, unknown>>)[0]).toMatchObject({
      classArmId: "ca-1",
      programmeName: "General Science",
      academicYearName: "2025/2026",
    });
  });
});

// ─── createStudentAction ───────────────────────────────────────────

describe("createStudentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createStudentAction({
      firstName: "Ama",
      lastName: "Mensah",
      dateOfBirth: "2008-05-15",
      gender: "FEMALE",
      boardingStatus: "DAY",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input", async () => {
    const result = await createStudentAction({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "MALE",
      boardingStatus: "DAY",
    });
    expect(result).toHaveProperty("error", "Invalid input");
    expect(result).toHaveProperty("details");
  });

  it("should reject if no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await createStudentAction({
      firstName: "Ama",
      lastName: "Mensah",
      dateOfBirth: "2008-05-15",
      gender: "FEMALE",
      boardingStatus: "DAY",
    });
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should auto-generate student ID and create student", async () => {
    prismaMock.student.count.mockResolvedValue(5 as never);
    const year = new Date().getFullYear();

    const mockStudent = {
      id: "new-student",
      studentId: `SCH/${year}/0006`,
      firstName: "Ama",
      lastName: "Mensah",
      schoolId: "default-school",
    };
    prismaMock.student.create.mockResolvedValue(mockStudent as never);

    const result = await createStudentAction({
      firstName: "Ama",
      lastName: "Mensah",
      dateOfBirth: "2008-05-15",
      gender: "FEMALE",
      boardingStatus: "DAY",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof mockStudent }).data.studentId).toBe(
      `SCH/${year}/0006`
    );
    expect(prismaMock.student.create).toHaveBeenCalled();
  });

  it("should create enrollment if classArmId provided", async () => {
    prismaMock.student.count.mockResolvedValue(0 as never);
    prismaMock.student.create.mockResolvedValue({
      id: "new-student",
      studentId: "SCH/2026/0001",
      firstName: "Ama",
      lastName: "Mensah",
    } as never);
    prismaMock.classArm.findUnique.mockResolvedValue({
      id: "ca-1",
      class: { academicYearId: "ay-1" },
    } as never);
    prismaMock.enrollment.create.mockResolvedValue({
      id: "enroll-1",
      studentId: "new-student",
      classArmId: "ca-1",
      academicYearId: "ay-1",
    } as never);

    const result = await createStudentAction({
      firstName: "Ama",
      lastName: "Mensah",
      dateOfBirth: "2008-05-15",
      gender: "FEMALE",
      boardingStatus: "DAY",
      classArmId: "ca-1",
    });
    expect(result).toHaveProperty("data");
    expect(prismaMock.enrollment.create).toHaveBeenCalled();
  });

  it("should skip enrollment if classArm not found", async () => {
    prismaMock.student.count.mockResolvedValue(0 as never);
    prismaMock.student.create.mockResolvedValue({
      id: "new-student",
      studentId: "SCH/2026/0001",
      firstName: "Ama",
      lastName: "Mensah",
    } as never);
    prismaMock.classArm.findUnique.mockResolvedValue(null as never);

    const result = await createStudentAction({
      firstName: "Ama",
      lastName: "Mensah",
      dateOfBirth: "2008-05-15",
      gender: "FEMALE",
      boardingStatus: "DAY",
      classArmId: "nonexistent-ca",
    });
    expect(result).toHaveProperty("data");
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });
});

// ─── updateStudentAction ───────────────────────────────────────────

describe("updateStudentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateStudentAction("s1", { firstName: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input", async () => {
    const result = await updateStudentAction("s1", { firstName: "" });
    expect(result).toHaveProperty("error", "Invalid input");
  });

  it("should return error if student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null as never);
    const result = await updateStudentAction("nonexistent", { firstName: "Updated" });
    expect(result).toEqual({ error: "Student not found." });
  });

  it("should update student fields successfully", async () => {
    const existing = {
      id: "s1",
      firstName: "Kwame",
      lastName: "Asante",
      status: "ACTIVE",
    };
    prismaMock.student.findUnique.mockResolvedValue(existing as never);

    const updated = { ...existing, firstName: "Kofi" };
    prismaMock.student.update.mockResolvedValue(updated as never);

    const result = await updateStudentAction("s1", { firstName: "Kofi" });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof updated }).data.firstName).toBe("Kofi");
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: expect.objectContaining({ firstName: "Kofi" }),
      })
    );
  });
});

// ─── deleteStudentAction ───────────────────────────────────────────

describe("deleteStudentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteStudentAction("s1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null as never);
    const result = await deleteStudentAction("nonexistent");
    expect(result).toEqual({ error: "Student not found." });
  });

  it("should soft delete by setting status to WITHDRAWN", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      firstName: "Kwame",
      lastName: "Asante",
      status: "ACTIVE",
    } as never);
    prismaMock.student.update.mockResolvedValue({
      id: "s1",
      status: "WITHDRAWN",
    } as never);
    prismaMock.enrollment.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await deleteStudentAction("s1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.student.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "WITHDRAWN" },
    });
  });

  it("should deactivate active enrollments on delete", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      firstName: "Kwame",
      lastName: "Asante",
      status: "ACTIVE",
    } as never);
    prismaMock.student.update.mockResolvedValue({
      id: "s1",
      status: "WITHDRAWN",
    } as never);
    prismaMock.enrollment.updateMany.mockResolvedValue({ count: 2 } as never);

    await deleteStudentAction("s1");
    expect(prismaMock.enrollment.updateMany).toHaveBeenCalledWith({
      where: { studentId: "s1", status: "ACTIVE" },
      data: { status: "WITHDRAWN" },
    });
  });
});

// ─── enrollStudentAction ───────────────────────────────────────────

describe("enrollStudentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await enrollStudentAction("s1", "ca-1", "ay-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null as never);
    const result = await enrollStudentAction("nonexistent", "ca-1", "ay-1");
    expect(result).toEqual({ error: "Student not found." });
  });

  it("should create new enrollment when none exists", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      firstName: "Kwame",
      lastName: "Asante",
    } as never);
    prismaMock.enrollment.findUnique.mockResolvedValue(null as never);
    const newEnrollment = {
      id: "enroll-1",
      studentId: "s1",
      classArmId: "ca-1",
      academicYearId: "ay-1",
    };
    prismaMock.enrollment.create.mockResolvedValue(newEnrollment as never);

    const result = await enrollStudentAction("s1", "ca-1", "ay-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof newEnrollment }).data).toMatchObject(newEnrollment);
    expect(prismaMock.enrollment.create).toHaveBeenCalled();
  });

  it("should update existing enrollment and set previousClassArmId", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      firstName: "Kwame",
      lastName: "Asante",
    } as never);
    prismaMock.enrollment.findUnique.mockResolvedValue({
      id: "enroll-1",
      studentId: "s1",
      classArmId: "ca-old",
      academicYearId: "ay-1",
    } as never);
    const updatedEnrollment = {
      id: "enroll-1",
      studentId: "s1",
      classArmId: "ca-new",
      previousClassArmId: "ca-old",
      status: "ACTIVE",
    };
    prismaMock.enrollment.update.mockResolvedValue(updatedEnrollment as never);

    const result = await enrollStudentAction("s1", "ca-new", "ay-1");
    expect(result).toHaveProperty("data");
    expect(prismaMock.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "enroll-1" },
        data: expect.objectContaining({
          classArmId: "ca-new",
          previousClassArmId: "ca-old",
          status: "ACTIVE",
        }),
      })
    );
  });
});

// ─── getStudentStatsAction ─────────────────────────────────────────

describe("getStudentStatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStudentStatsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });
    const result = await getStudentStatsAction();
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should return counts by status, gender, and boarding status", async () => {
    // 8 counts: total, active, suspended, withdrawn, male, female, day, boarding
    prismaMock.student.count
      .mockResolvedValueOnce(100 as never) // total
      .mockResolvedValueOnce(80 as never)  // active
      .mockResolvedValueOnce(5 as never)   // suspended
      .mockResolvedValueOnce(15 as never)  // withdrawn
      .mockResolvedValueOnce(45 as never)  // male
      .mockResolvedValueOnce(35 as never)  // female
      .mockResolvedValueOnce(60 as never)  // day
      .mockResolvedValueOnce(20 as never); // boarding

    const result = await getStudentStatsAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data).toEqual({
      total: 100,
      byStatus: { active: 80, suspended: 5, withdrawn: 15 },
      byGender: { male: 45, female: 35 },
      byBoardingStatus: { day: 60, boarding: 20 },
    });
  });
});
