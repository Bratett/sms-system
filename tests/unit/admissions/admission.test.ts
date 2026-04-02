import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getApplicationsAction,
  getApplicationAction,
  createApplicationAction,
  updateApplicationAction,
  reviewApplicationAction,
  enrollApplicationAction,
  deleteApplicationAction,
  getAdmissionStatsAction,
} from "@/modules/admissions/actions/admission.action";

const validApplicationInput = {
  firstName: "Ama",
  lastName: "Mensah",
  dateOfBirth: "2008-05-15",
  gender: "FEMALE" as const,
  guardianName: "Kofi Mensah",
  guardianPhone: "0241234567",
  boardingStatus: "DAY" as const,
};

// ─── getApplicationsAction ─────────────────────────────────────────

describe("getApplicationsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getApplicationsAction({ page: 1, pageSize: 25 });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });
    const result = await getApplicationsAction({ page: 1, pageSize: 25 });
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should return paginated applications", async () => {
    prismaMock.admissionApplication.findMany.mockResolvedValue([
      {
        id: "app-1",
        applicationNumber: "APP/2026/0001",
        firstName: "Ama",
        lastName: "Mensah",
        status: "SUBMITTED",
        programmePreference1Id: null,
        programmePreference2Id: null,
      },
    ] as never);
    prismaMock.admissionApplication.count.mockResolvedValue(1 as never);

    const result = await getApplicationsAction({ page: 1, pageSize: 25 });
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ total: 1, page: 1, pageSize: 25 });
    expect((data as { applications: unknown[] }).applications).toHaveLength(1);
  });

  it("should apply search filter", async () => {
    prismaMock.admissionApplication.findMany.mockResolvedValue([] as never);
    prismaMock.admissionApplication.count.mockResolvedValue(0 as never);

    const result = await getApplicationsAction({
      search: "Ama",
      page: 1,
      pageSize: 25,
    });
    expect(result).toHaveProperty("data");
  });

  it("should apply status and academicYearId filters", async () => {
    prismaMock.admissionApplication.findMany.mockResolvedValue([] as never);
    prismaMock.admissionApplication.count.mockResolvedValue(0 as never);

    const result = await getApplicationsAction({
      status: "SUBMITTED",
      academicYearId: "ay-1",
      page: 1,
      pageSize: 25,
    });
    expect(result).toHaveProperty("data");
  });
});

// ─── getApplicationAction ──────────────────────────────────────────

describe("getApplicationAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getApplicationAction("app-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if application not found", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue(null as never);
    const result = await getApplicationAction("nonexistent");
    expect(result).toEqual({ error: "Application not found" });
  });

  it("should return application with documents", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      applicationNumber: "APP/2026/0001",
      firstName: "Ama",
      lastName: "Mensah",
      status: "SUBMITTED",
      programmePreference1Id: "prog-1",
      programmePreference2Id: null,
      documents: [
        { id: "doc-1", fileName: "transcript.pdf", uploadedAt: new Date() },
      ],
    } as never);
    prismaMock.programme.findMany.mockResolvedValue([
      { id: "prog-1", name: "General Science" },
    ] as never);

    const result = await getApplicationAction("app-1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      id: "app-1",
      programmePreference1Name: "General Science",
      programmePreference2Name: null,
    });
  });
});

// ─── createApplicationAction ───────────────────────────────────────

describe("createApplicationAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createApplicationAction(validApplicationInput);
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input", async () => {
    const result = await createApplicationAction({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "MALE",
      guardianName: "",
      guardianPhone: "",
      boardingStatus: "DAY",
    });
    expect(result).toHaveProperty("error", "Invalid input");
    expect(result).toHaveProperty("details");
  });

  it("should reject if no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });
    const result = await createApplicationAction(validApplicationInput);
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should reject if no active academic year", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);
    const result = await createApplicationAction(validApplicationInput);
    expect(result).toEqual({
      error: "No active academic year. Please set a current academic year first.",
    });
  });

  it("should auto-generate application number and set status to SUBMITTED", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      isCurrent: true,
    } as never);
    prismaMock.admissionApplication.count.mockResolvedValue(3 as never);

    const year = new Date().getFullYear();
    const mockApp = {
      id: "app-new",
      applicationNumber: `APP/${year}/0004`,
      firstName: "Ama",
      lastName: "Mensah",
      status: "SUBMITTED",
    };
    prismaMock.admissionApplication.create.mockResolvedValue(mockApp as never);

    const result = await createApplicationAction(validApplicationInput);
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof mockApp }).data.applicationNumber).toBe(
      `APP/${year}/0004`
    );
    expect(prismaMock.admissionApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUBMITTED" }),
      })
    );
  });
});

// ─── updateApplicationAction ───────────────────────────────────────

describe("updateApplicationAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateApplicationAction("app-1", validApplicationInput);
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input", async () => {
    const result = await updateApplicationAction("app-1", {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "MALE",
      guardianName: "",
      guardianPhone: "",
      boardingStatus: "DAY",
    });
    expect(result).toHaveProperty("error", "Invalid input");
  });

  it("should return error if application not found", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue(null as never);
    const result = await updateApplicationAction("nonexistent", validApplicationInput);
    expect(result).toEqual({ error: "Application not found" });
  });

  it("should reject update when status is not DRAFT or SUBMITTED", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "ACCEPTED",
    } as never);

    const result = await updateApplicationAction("app-1", validApplicationInput);
    expect(result).toEqual({
      error: "Application can only be updated when in DRAFT or SUBMITTED status.",
    });
  });

  it("should allow update when status is DRAFT", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "DRAFT",
      applicationNumber: "APP/2026/0001",
    } as never);
    prismaMock.admissionApplication.update.mockResolvedValue({
      id: "app-1",
      firstName: "Ama",
      lastName: "Mensah",
      status: "DRAFT",
    } as never);

    const result = await updateApplicationAction("app-1", validApplicationInput);
    expect(result).toHaveProperty("data");
    expect(prismaMock.admissionApplication.update).toHaveBeenCalled();
  });

  it("should allow update when status is SUBMITTED", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "SUBMITTED",
      applicationNumber: "APP/2026/0001",
    } as never);
    prismaMock.admissionApplication.update.mockResolvedValue({
      id: "app-1",
      status: "SUBMITTED",
    } as never);

    const result = await updateApplicationAction("app-1", validApplicationInput);
    expect(result).toHaveProperty("data");
  });
});

// ─── reviewApplicationAction ───────────────────────────────────────

describe("reviewApplicationAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await reviewApplicationAction("app-1", {
      status: "ACCEPTED",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid decision input", async () => {
    const result = await reviewApplicationAction("app-1", {
      status: "INVALID_STATUS" as "ACCEPTED",
    });
    expect(result).toHaveProperty("error", "Invalid input");
  });

  it("should return error if application not found", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue(null as never);
    const result = await reviewApplicationAction("nonexistent", {
      status: "ACCEPTED",
    });
    expect(result).toEqual({ error: "Application not found" });
  });

  it("should update status and set reviewedBy", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "SUBMITTED",
      applicationNumber: "APP/2026/0001",
      notes: null,
    } as never);
    prismaMock.admissionApplication.update.mockResolvedValue({
      id: "app-1",
      status: "ACCEPTED",
      reviewedBy: "test-user-id",
    } as never);

    const result = await reviewApplicationAction("app-1", {
      status: "ACCEPTED",
      notes: "Good candidate",
    });
    expect(result).toHaveProperty("data");
    expect(prismaMock.admissionApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-1" },
        data: expect.objectContaining({
          status: "ACCEPTED",
          reviewedBy: "test-user-id",
        }),
      })
    );
  });
});

// ─── enrollApplicationAction ───────────────────────────────────────

describe("enrollApplicationAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await enrollApplicationAction("app-1", "ca-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if application not found", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue(null as never);
    const result = await enrollApplicationAction("nonexistent", "ca-1");
    expect(result).toEqual({ error: "Application not found" });
  });

  it("should reject non-ACCEPTED applications", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "SUBMITTED",
    } as never);
    const result = await enrollApplicationAction("app-1", "ca-1");
    expect(result).toEqual({
      error: "Only accepted applications can be enrolled.",
    });
  });

  it("should reject if no school configured", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "ACCEPTED",
    } as never);
    mockAuthenticatedUser({ schoolId: null });

    const result = await enrollApplicationAction("app-1", "ca-1");
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should reject if no active academic year", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "ACCEPTED",
    } as never);
    prismaMock.academicYear.findFirst.mockResolvedValue(null as never);

    const result = await enrollApplicationAction("app-1", "ca-1");
    expect(result).toEqual({ error: "No active academic year." });
  });

  it("should reject if class arm not found", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "ACCEPTED",
    } as never);
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      isCurrent: true,
    } as never);
    prismaMock.classArm.findUnique.mockResolvedValue(null as never);

    const result = await enrollApplicationAction("app-1", "nonexistent-ca");
    expect(result).toEqual({ error: "Class arm not found." });
  });

  it("should create student, guardian, enrollment in a transaction", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "ACCEPTED",
      firstName: "Ama",
      lastName: "Mensah",
      otherNames: null,
      dateOfBirth: new Date("2008-05-15"),
      gender: "FEMALE",
      boardingStatus: "DAY",
      guardianName: "Kofi Mensah",
      guardianPhone: "0241234567",
      guardianEmail: "kofi@example.com",
      guardianOccupation: "Teacher",
      guardianAddress: "Accra",
      guardianRelationship: "Father",
      applicationNumber: "APP/2026/0001",
    } as never);
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      isCurrent: true,
    } as never);
    prismaMock.classArm.findUnique.mockResolvedValue({
      id: "ca-1",
      class: { id: "cls-1" },
    } as never);
    prismaMock.student.count.mockResolvedValue(10 as never);

    const year = new Date().getFullYear();
    const mockStudent = {
      id: "new-student",
      studentId: `STU/${year}/0011`,
      firstName: "Ama",
      lastName: "Mensah",
    };

    prismaMock.$transaction.mockImplementation(async (fn) => {
      const txResult = await (fn as Function)(prismaMock as never);
      return txResult;
    });

    prismaMock.student.create.mockResolvedValue(mockStudent as never);
    prismaMock.guardian.create.mockResolvedValue({
      id: "guard-1",
      firstName: "Kofi",
      lastName: "Mensah",
    } as never);
    prismaMock.studentGuardian.create.mockResolvedValue({
      studentId: "new-student",
      guardianId: "guard-1",
      isPrimary: true,
    } as never);
    prismaMock.enrollment.create.mockResolvedValue({
      id: "enroll-1",
      studentId: "new-student",
      classArmId: "ca-1",
      academicYearId: "ay-1",
    } as never);
    prismaMock.admissionApplication.update.mockResolvedValue({
      id: "app-1",
      status: "ENROLLED",
      enrolledStudentId: "new-student",
    } as never);

    const result = await enrollApplicationAction("app-1", "ca-1");
    expect(result).toHaveProperty("data");
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.student.create).toHaveBeenCalled();
    expect(prismaMock.guardian.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: "Kofi",
          lastName: "Mensah",
        }),
      })
    );
    expect(prismaMock.studentGuardian.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPrimary: true }),
      })
    );
    expect(prismaMock.enrollment.create).toHaveBeenCalled();
    expect(prismaMock.admissionApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ENROLLED" }),
      })
    );
  });

  it("should split single-word guardian name correctly", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "ACCEPTED",
      firstName: "Ama",
      lastName: "Mensah",
      otherNames: null,
      dateOfBirth: new Date("2008-05-15"),
      gender: "FEMALE",
      boardingStatus: "DAY",
      guardianName: "Kofi",
      guardianPhone: "0241234567",
      guardianEmail: null,
      guardianOccupation: null,
      guardianAddress: null,
      guardianRelationship: null,
      applicationNumber: "APP/2026/0001",
    } as never);
    prismaMock.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      isCurrent: true,
    } as never);
    prismaMock.classArm.findUnique.mockResolvedValue({
      id: "ca-1",
      class: { id: "cls-1" },
    } as never);
    prismaMock.student.count.mockResolvedValue(0 as never);

    prismaMock.$transaction.mockImplementation(async (fn) => {
      return await (fn as Function)(prismaMock as never);
    });
    prismaMock.student.create.mockResolvedValue({
      id: "new-student",
      firstName: "Ama",
      lastName: "Mensah",
    } as never);
    prismaMock.guardian.create.mockResolvedValue({
      id: "guard-1",
      firstName: "Kofi",
      lastName: "Kofi",
    } as never);
    prismaMock.studentGuardian.create.mockResolvedValue({} as never);
    prismaMock.enrollment.create.mockResolvedValue({} as never);
    prismaMock.admissionApplication.update.mockResolvedValue({
      id: "app-1",
      status: "ENROLLED",
    } as never);

    await enrollApplicationAction("app-1", "ca-1");

    // Single name: firstName="Kofi", lastName="Kofi" (fallback)
    expect(prismaMock.guardian.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: "Kofi",
          lastName: "Kofi",
        }),
      })
    );
  });
});

// ─── deleteApplicationAction ───────────────────────────────────────

describe("deleteApplicationAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteApplicationAction("app-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if application not found", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue(null as never);
    const result = await deleteApplicationAction("nonexistent");
    expect(result).toEqual({ error: "Application not found" });
  });

  it("should reject deletion of non-DRAFT applications", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "SUBMITTED",
    } as never);
    const result = await deleteApplicationAction("app-1");
    expect(result).toEqual({
      error: "Only draft applications can be deleted.",
    });
  });

  it("should reject deletion of ACCEPTED applications", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "ACCEPTED",
    } as never);
    const result = await deleteApplicationAction("app-1");
    expect(result).toEqual({
      error: "Only draft applications can be deleted.",
    });
  });

  it("should delete DRAFT applications successfully", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      id: "app-1",
      status: "DRAFT",
      applicationNumber: "APP/2026/0001",
    } as never);
    prismaMock.admissionApplication.delete.mockResolvedValue({
      id: "app-1",
    } as never);

    const result = await deleteApplicationAction("app-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.admissionApplication.delete).toHaveBeenCalledWith({
      where: { id: "app-1" },
    });
  });
});

// ─── getAdmissionStatsAction ───────────────────────────────────────

describe("getAdmissionStatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAdmissionStatsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });
    const result = await getAdmissionStatsAction();
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should return counts by all status types", async () => {
    prismaMock.admissionApplication.count
      .mockResolvedValueOnce(50 as never)  // total
      .mockResolvedValueOnce(15 as never)  // submitted
      .mockResolvedValueOnce(5 as never)   // underReview
      .mockResolvedValueOnce(3 as never)   // shortlisted
      .mockResolvedValueOnce(10 as never)  // accepted
      .mockResolvedValueOnce(7 as never)   // rejected
      .mockResolvedValueOnce(8 as never)   // enrolled
      .mockResolvedValueOnce(2 as never);  // draft

    const result = await getAdmissionStatsAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data).toEqual({
      total: 50,
      submitted: 15,
      underReview: 5,
      shortlisted: 3,
      accepted: 10,
      rejected: 7,
      enrolled: 8,
      draft: 2,
    });
  });

  it("should filter by academicYearId when provided", async () => {
    prismaMock.admissionApplication.count.mockResolvedValue(0 as never);

    await getAdmissionStatsAction("ay-1");
    expect(prismaMock.admissionApplication.count).toHaveBeenCalled();
  });
});
