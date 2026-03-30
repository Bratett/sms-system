import { describe, it, expect, beforeEach } from "vitest";
import {
  prismaMock,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "../setup";

import {
  getGraduationBatchesAction,
  createGraduationBatchAction,
  addGraduatesToBatchAction,
  confirmGraduateAction,
  completeBatchAction,
  getAlumniAction,
  searchGraduationEligibleStudentsAction,
  getAcademicYearsForGraduationAction,
} from "@/modules/graduation/actions/graduation.action";

import { checkGraduationEligibilityAction } from "@/modules/graduation/actions/eligibility.action";

import {
  upsertAlumniProfileAction,
  getAlumniProfilesAction,
  getAlumniProfileAction,
  getAlumniGraduationYearsAction,
} from "@/modules/graduation/actions/alumni.action";

// ─── Graduation Batches ────────────────────────────────────────────

describe("getGraduationBatchesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getGraduationBatchesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null);
    const result = await getGraduationBatchesAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return graduation batches with records", async () => {
    prismaMock.graduationBatch.findMany.mockResolvedValue([
      {
        id: "batch-1",
        name: "Class of 2025",
        academicYearId: "ay-1",
        ceremonyDate: null,
        status: "PENDING",
        createdAt: new Date(),
        _count: { records: 2 },
        records: [
          { id: "rec-1", studentId: "stu-1", certificateNumber: null, honours: null, status: "PENDING" },
          { id: "rec-2", studentId: "stu-2", certificateNumber: "CERT-001", honours: "First Class", status: "CONFIRMED" },
        ],
      },
    ] as never);
    prismaMock.academicYear.findMany.mockResolvedValue([
      { id: "ay-1", name: "2024/2025" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "stu-1", firstName: "John", lastName: "Doe", studentId: "STU/2025/0001" },
      { id: "stu-2", firstName: "Jane", lastName: "Smith", studentId: "STU/2025/0002" },
    ] as never);

    const result = await getGraduationBatchesAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: unknown[] }).data;
    expect(data).toHaveLength(1);
  });
});

describe("createGraduationBatchAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createGraduationBatchAction({
      academicYearId: "ay-1",
      name: "Class of 2025",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null);
    const result = await createGraduationBatchAction({
      academicYearId: "ay-1",
      name: "Class of 2025",
    });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should create graduation batch successfully", async () => {
    prismaMock.graduationBatch.create.mockResolvedValue({
      id: "batch-1",
      name: "Class of 2025",
      status: "PENDING",
    } as never);

    const result = await createGraduationBatchAction({
      academicYearId: "ay-1",
      name: "Class of 2025",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: { name: string } }).data.name).toBe("Class of 2025");
  });
});

describe("addGraduatesToBatchAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await addGraduatesToBatchAction("batch-1", ["stu-1"]);
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if batch not found", async () => {
    prismaMock.graduationBatch.findUnique.mockResolvedValue(null);
    const result = await addGraduatesToBatchAction("nonexistent", ["stu-1"]);
    expect(result).toEqual({ error: "Batch not found." });
  });

  it("should reject adding to completed batch", async () => {
    prismaMock.graduationBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      status: "COMPLETED",
      schoolId: "default-school",
    } as never);

    const result = await addGraduatesToBatchAction("batch-1", ["stu-1"]);
    expect(result).toEqual({ error: "Cannot add to a completed batch." });
  });

  it("should return error if no valid students found", async () => {
    prismaMock.graduationBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      status: "PENDING",
      schoolId: "default-school",
    } as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    const result = await addGraduatesToBatchAction("batch-1", ["nonexistent"]);
    expect(result).toEqual({ error: "No valid students found." });
  });

  it("should return error if all students already in batch", async () => {
    prismaMock.graduationBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      status: "PENDING",
      schoolId: "default-school",
    } as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "stu-1", firstName: "John", lastName: "Doe", status: "ACTIVE" },
    ] as never);
    prismaMock.graduationRecord.findMany.mockResolvedValue([
      { studentId: "stu-1" },
    ] as never);

    const result = await addGraduatesToBatchAction("batch-1", ["stu-1"]);
    expect(result).toEqual({ error: "All selected students are already in this batch." });
  });

  it("should add graduates to batch successfully", async () => {
    prismaMock.graduationBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      name: "Class of 2025",
      status: "PENDING",
      schoolId: "default-school",
    } as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "stu-1", firstName: "John", lastName: "Doe", status: "ACTIVE" },
    ] as never);
    prismaMock.graduationRecord.findMany.mockResolvedValue([] as never);
    prismaMock.graduationRecord.createMany.mockResolvedValue({ count: 1 } as never);

    const result = await addGraduatesToBatchAction("batch-1", ["stu-1"]);
    expect(result).toHaveProperty("data");
    expect((result as { data: { added: number } }).data.added).toBe(1);
  });
});

describe("confirmGraduateAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await confirmGraduateAction("rec-1", {});
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if record not found", async () => {
    prismaMock.graduationRecord.findUnique.mockResolvedValue(null);
    const result = await confirmGraduateAction("nonexistent", {});
    expect(result).toEqual({ error: "Record not found." });
  });

  it("should confirm graduate and update student status", async () => {
    prismaMock.graduationRecord.findUnique.mockResolvedValue({
      id: "rec-1",
      studentId: "stu-1",
      certificateNumber: null,
      honours: null,
      batch: { id: "batch-1" },
    } as never);
    prismaMock.graduationRecord.update.mockResolvedValue({
      id: "rec-1",
      status: "CONFIRMED",
      certificateNumber: "CERT-001",
      honours: "First Class",
    } as never);
    prismaMock.student.update.mockResolvedValue({
      id: "stu-1",
      status: "GRADUATED",
    } as never);

    const result = await confirmGraduateAction("rec-1", {
      certificateNumber: "CERT-001",
      honours: "First Class",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: { status: string } }).data.status).toBe("CONFIRMED");
  });
});

describe("completeBatchAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await completeBatchAction("batch-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if batch not found", async () => {
    prismaMock.graduationBatch.findUnique.mockResolvedValue(null);
    const result = await completeBatchAction("nonexistent");
    expect(result).toEqual({ error: "Batch not found." });
  });

  it("should complete batch successfully", async () => {
    prismaMock.graduationBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      name: "Class of 2025",
      _count: { records: 10 },
    } as never);
    prismaMock.graduationBatch.update.mockResolvedValue({
      id: "batch-1",
      status: "COMPLETED",
    } as never);

    const result = await completeBatchAction("batch-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { status: string } }).data.status).toBe("COMPLETED");
  });
});

describe("getAlumniAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAlumniAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated alumni list", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      {
        id: "stu-1",
        studentId: "STU/2025/0001",
        firstName: "John",
        lastName: "Doe",
        gender: "MALE",
        enrollmentDate: new Date(),
      },
    ] as never);
    prismaMock.student.count.mockResolvedValue(1 as never);
    prismaMock.graduationRecord.findMany.mockResolvedValue([
      {
        studentId: "stu-1",
        certificateNumber: "CERT-001",
        honours: null,
        status: "CONFIRMED",
        batch: { name: "Class of 2025" },
      },
    ] as never);

    const result = await getAlumniAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
  });
});

describe("searchGraduationEligibleStudentsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await searchGraduationEligibleStudentsAction("John");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return empty for short search term", async () => {
    const result = await searchGraduationEligibleStudentsAction("J");
    expect(result).toEqual({ data: [] });
  });

  it("should return empty if no current academic year", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue(null);
    const result = await searchGraduationEligibleStudentsAction("John");
    expect(result).toEqual({ data: [] });
  });

  it("should return eligible SHS 3 students", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: "ay-1", isCurrent: true } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        student: { id: "stu-1", studentId: "STU/2025/0001", firstName: "John", lastName: "Doe" },
      },
    ] as never);

    const result = await searchGraduationEligibleStudentsAction("John");
    expect(result).toHaveProperty("data");
    expect((result as { data: unknown[] }).data).toHaveLength(1);
  });
});

describe("getAcademicYearsForGraduationAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAcademicYearsForGraduationAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return academic years", async () => {
    prismaMock.academicYear.findMany.mockResolvedValue([
      { id: "ay-1", name: "2024/2025", isCurrent: true },
    ] as never);

    const result = await getAcademicYearsForGraduationAction();
    expect(result).toHaveProperty("data");
  });
});

// ─── Eligibility Check ─────────────────────────────────────────────

describe("checkGraduationEligibilityAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await checkGraduationEligibilityAction("stu-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await checkGraduationEligibilityAction("nonexistent");
    expect(result).toEqual({ error: "Student not found" });
  });

  it("should identify issues for ineligible student", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      firstName: "John",
      lastName: "Doe",
      enrollments: [
        {
          status: "ACTIVE",
          classArm: { class: { yearGroup: 2 } },
        },
      ],
    } as never);
    prismaMock.studentBill.count.mockResolvedValue(2 as never);
    prismaMock.disciplinaryIncident.count.mockResolvedValue(1 as never);
    prismaMock.academicYear.findFirst.mockResolvedValue(null);

    const result = await checkGraduationEligibilityAction("stu-1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: { isEligible: boolean; issues: string[] } }).data;
    expect(data.isEligible).toBe(false);
    expect(data.issues.length).toBeGreaterThan(0);
  });

  it("should return eligible for qualifying student", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      firstName: "John",
      lastName: "Doe",
      enrollments: [
        {
          status: "ACTIVE",
          classArm: { class: { yearGroup: 3 } },
        },
      ],
    } as never);
    prismaMock.studentBill.count.mockResolvedValue(0 as never);
    prismaMock.disciplinaryIncident.count.mockResolvedValue(0 as never);
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      status: "ACTIVE",
      terms: [{ status: "COMPLETED" }],
    } as never);
    prismaMock.terminalResult.count.mockResolvedValue(1 as never);

    const result = await checkGraduationEligibilityAction("stu-1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: { isEligible: boolean } }).data;
    expect(data.isEligible).toBe(true);
  });
});

// ─── Alumni Profiles ───────────────────────────────────────────────

describe("upsertAlumniProfileAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await upsertAlumniProfileAction({
      studentId: "stu-1",
      graduationYear: 2025,
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await upsertAlumniProfileAction({
      studentId: "nonexistent",
      graduationYear: 2025,
    });
    expect(result).toEqual({ error: "Student not found" });
  });

  it("should reject non-graduated students", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      status: "ACTIVE",
    } as never);

    const result = await upsertAlumniProfileAction({
      studentId: "stu-1",
      graduationYear: 2025,
    });
    expect(result).toEqual({ error: "Only graduated students can have alumni profiles" });
  });

  it("should create alumni profile successfully", async () => {
    const now = new Date();
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      status: "GRADUATED",
    } as never);
    prismaMock.alumniProfile.upsert.mockResolvedValue({
      id: "ap-1",
      studentId: "stu-1",
      graduationYear: 2025,
      createdAt: now,
      updatedAt: now,
    } as never);

    const result = await upsertAlumniProfileAction({
      studentId: "stu-1",
      graduationYear: 2025,
    });
    expect(result).toHaveProperty("data");
  });
});

describe("getAlumniProfilesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAlumniProfilesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated alumni profiles", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([] as never);
    prismaMock.alumniProfile.count.mockResolvedValue(0 as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    const result = await getAlumniProfilesAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
  });
});

describe("getAlumniProfileAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAlumniProfileAction("stu-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if profile not found", async () => {
    prismaMock.alumniProfile.findUnique.mockResolvedValue(null);
    const result = await getAlumniProfileAction("nonexistent");
    expect(result).toEqual({ error: "Alumni profile not found" });
  });

  it("should return alumni profile with student and graduation info", async () => {
    prismaMock.alumniProfile.findUnique.mockResolvedValue({
      id: "ap-1",
      studentId: "stu-1",
      graduationYear: 2025,
    } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      firstName: "John",
      lastName: "Doe",
      studentId: "STU/2025/0001",
      gender: "MALE",
      dateOfBirth: null,
      photoUrl: null,
      enrollmentDate: new Date(),
    } as never);
    prismaMock.graduationRecord.findFirst.mockResolvedValue({
      certificateNumber: "CERT-001",
      honours: "First Class",
      status: "CONFIRMED",
      batch: { name: "Class of 2025", ceremonyDate: null },
    } as never);

    const result = await getAlumniProfileAction("stu-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { graduation: unknown } }).data.graduation).not.toBeNull();
  });
});

describe("getAlumniGraduationYearsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAlumniGraduationYearsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return distinct graduation years", async () => {
    prismaMock.alumniProfile.findMany.mockResolvedValue([
      { graduationYear: 2025 },
      { graduationYear: 2024 },
    ] as never);

    const result = await getAlumniGraduationYearsAction();
    expect(result).toHaveProperty("data");
    expect((result as { data: number[] }).data).toEqual([2025, 2024]);
  });
});
