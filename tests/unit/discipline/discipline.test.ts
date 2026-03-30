import { describe, it, expect, beforeEach } from "vitest";
import {
  prismaMock,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "../setup";

import {
  getIncidentsAction,
  createIncidentAction,
  updateIncidentAction,
  resolveIncidentAction,
  getIncidentTypesAction,
  searchStudentsForDisciplineAction,
} from "@/modules/discipline/actions/discipline.action";

import {
  createCounselingRecordAction,
  getCounselingRecordsAction,
  updateCounselingRecordAction,
} from "@/modules/discipline/actions/counseling.action";

import {
  createWelfareNoteAction,
  getWelfareNotesAction,
  updateWelfareNoteAction,
} from "@/modules/discipline/actions/welfare.action";

import {
  createCommendationAction,
  getCommendationsAction,
} from "@/modules/discipline/actions/commendation.action";

// ─── Discipline Incidents ──────────────────────────────────────────

describe("getIncidentsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getIncidentsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null);
    const result = await getIncidentsAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return paginated incidents with student and reporter names", async () => {
    const mockIncidents = [
      {
        id: "inc-1",
        schoolId: "default-school",
        studentId: "stu-1",
        reportedBy: "user-1",
        date: new Date(),
        type: "Fighting",
        description: "Description",
        severity: "HIGH",
        sanction: null,
        status: "REPORTED",
        notes: null,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    prismaMock.disciplinaryIncident.findMany.mockResolvedValue(mockIncidents as never);
    prismaMock.disciplinaryIncident.count.mockResolvedValue(1 as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "stu-1", firstName: "John", lastName: "Doe" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", firstName: "Admin", lastName: "User" },
    ] as never);

    const result = await getIncidentsAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    expect((result as { data: unknown[] }).data).toHaveLength(1);
    expect((result as { data: { studentName: string }[] }).data[0].studentName).toBe("John Doe");
  });

  it("should apply filters for studentId, status, and severity", async () => {
    prismaMock.disciplinaryIncident.findMany.mockResolvedValue([] as never);
    prismaMock.disciplinaryIncident.count.mockResolvedValue(0 as never);

    const result = await getIncidentsAction({
      studentId: "stu-1",
      status: "REPORTED",
      severity: "HIGH",
      page: 2,
      pageSize: 10,
    });

    expect(result).toHaveProperty("pagination");
    expect((result as { pagination: { page: number } }).pagination.page).toBe(2);
  });
});

describe("createIncidentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createIncidentAction({
      studentId: "stu-1",
      date: "2025-01-01",
      type: "Fighting",
      description: "Test",
      severity: "HIGH",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await createIncidentAction({
      studentId: "nonexistent",
      date: "2025-01-01",
      type: "Fighting",
      description: "Test",
      severity: "HIGH",
    });
    expect(result).toEqual({ error: "Student not found." });
  });

  it("should create an incident successfully", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "stu-1",
      firstName: "John",
      lastName: "Doe",
    } as never);

    const mockIncident = {
      id: "inc-1",
      schoolId: "default-school",
      studentId: "stu-1",
      reportedBy: "test-user-id",
      date: new Date("2025-01-01"),
      type: "Fighting",
      description: "Test",
      severity: "HIGH",
      sanction: null,
      status: "REPORTED",
    };

    prismaMock.disciplinaryIncident.create.mockResolvedValue(mockIncident as never);

    const result = await createIncidentAction({
      studentId: "stu-1",
      date: "2025-01-01",
      type: "Fighting",
      description: "Test",
      severity: "HIGH",
    });

    expect(result).toHaveProperty("data");
    expect((result as { data: { id: string } }).data.id).toBe("inc-1");
  });
});

describe("updateIncidentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateIncidentAction("inc-1", { type: "Theft" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if incident not found", async () => {
    prismaMock.disciplinaryIncident.findUnique.mockResolvedValue(null);
    const result = await updateIncidentAction("nonexistent", { type: "Theft" });
    expect(result).toEqual({ error: "Incident not found." });
  });

  it("should update incident successfully", async () => {
    const existing = {
      id: "inc-1",
      type: "Fighting",
      description: "Old",
      severity: "LOW",
      sanction: null,
      status: "REPORTED",
    };

    prismaMock.disciplinaryIncident.findUnique.mockResolvedValue(existing as never);
    prismaMock.disciplinaryIncident.update.mockResolvedValue({
      ...existing,
      type: "Theft",
    } as never);

    const result = await updateIncidentAction("inc-1", { type: "Theft" });
    expect(result).toHaveProperty("data");
    expect((result as { data: { type: string } }).data.type).toBe("Theft");
  });
});

describe("resolveIncidentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await resolveIncidentAction("inc-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if incident not found", async () => {
    prismaMock.disciplinaryIncident.findUnique.mockResolvedValue(null);
    const result = await resolveIncidentAction("nonexistent");
    expect(result).toEqual({ error: "Incident not found." });
  });

  it("should resolve incident and set status to RESOLVED", async () => {
    const existing = {
      id: "inc-1",
      status: "REPORTED",
      notes: null,
    };

    prismaMock.disciplinaryIncident.findUnique.mockResolvedValue(existing as never);
    prismaMock.disciplinaryIncident.update.mockResolvedValue({
      ...existing,
      status: "RESOLVED",
      resolvedBy: "test-user-id",
      resolvedAt: new Date(),
      notes: "Resolved notes",
    } as never);

    const result = await resolveIncidentAction("inc-1", "Resolved notes");
    expect(result).toHaveProperty("data");
    expect((result as { data: { status: string } }).data.status).toBe("RESOLVED");
  });
});

describe("getIncidentTypesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getIncidentTypesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return the list of incident types", async () => {
    const result = await getIncidentTypesAction();
    expect(result).toHaveProperty("data");
    expect((result as { data: string[] }).data).toContain("Fighting");
    expect((result as { data: string[] }).data).toContain("Truancy");
  });
});

describe("searchStudentsForDisciplineAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await searchStudentsForDisciplineAction("John");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return empty for short search term", async () => {
    const result = await searchStudentsForDisciplineAction("J");
    expect(result).toEqual({ data: [] });
  });

  it("should return matching students", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: "stu-1", studentId: "STU/2025/0001", firstName: "John", lastName: "Doe" },
    ] as never);

    const result = await searchStudentsForDisciplineAction("John");
    expect(result).toHaveProperty("data");
    expect((result as { data: unknown[] }).data).toHaveLength(1);
  });
});

// ─── Counseling Records ────────────────────────────────────────────

describe("createCounselingRecordAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createCounselingRecordAction({
      studentId: "stu-1",
      sessionDate: "2025-01-01",
      type: "INDIVIDUAL",
      summary: "Test session",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null);
    const result = await createCounselingRecordAction({
      studentId: "stu-1",
      sessionDate: "2025-01-01",
      type: "INDIVIDUAL",
      summary: "Test session",
    });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should create a counseling record successfully", async () => {
    const mockRecord = {
      id: "cr-1",
      schoolId: "default-school",
      studentId: "stu-1",
      counselorId: "test-user-id",
      sessionDate: new Date("2025-01-01"),
      type: "INDIVIDUAL",
      summary: "Test session",
      actionPlan: null,
      followUpDate: null,
      isConfidential: true,
    };

    prismaMock.counselingRecord.create.mockResolvedValue(mockRecord as never);

    const result = await createCounselingRecordAction({
      studentId: "stu-1",
      sessionDate: "2025-01-01",
      type: "INDIVIDUAL",
      summary: "Test session",
    });

    expect(result).toHaveProperty("data");
    expect((result as { data: { id: string } }).data.id).toBe("cr-1");
  });
});

describe("getCounselingRecordsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getCounselingRecordsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated counseling records", async () => {
    prismaMock.counselingRecord.findMany.mockResolvedValue([] as never);
    prismaMock.counselingRecord.count.mockResolvedValue(0 as never);

    const result = await getCounselingRecordsAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
  });
});

describe("updateCounselingRecordAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateCounselingRecordAction("cr-1", { summary: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if record not found", async () => {
    prismaMock.counselingRecord.findUnique.mockResolvedValue(null);
    const result = await updateCounselingRecordAction("nonexistent", { summary: "Updated" });
    expect(result).toEqual({ error: "Record not found" });
  });

  it("should update counseling record successfully", async () => {
    const existing = { id: "cr-1", summary: "Old" };
    prismaMock.counselingRecord.findUnique.mockResolvedValue(existing as never);
    prismaMock.counselingRecord.update.mockResolvedValue({
      ...existing,
      summary: "Updated",
    } as never);

    const result = await updateCounselingRecordAction("cr-1", { summary: "Updated" });
    expect(result).toHaveProperty("data");
    expect((result as { data: { summary: string } }).data.summary).toBe("Updated");
  });
});

// ─── Welfare Notes ─────────────────────────────────────────────────

describe("createWelfareNoteAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createWelfareNoteAction({
      studentId: "stu-1",
      date: "2025-01-01",
      category: "HEALTH",
      description: "Student felt unwell",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null);
    const result = await createWelfareNoteAction({
      studentId: "stu-1",
      date: "2025-01-01",
      category: "HEALTH",
      description: "Student felt unwell",
    });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should create a welfare note successfully", async () => {
    const mockNote = {
      id: "wn-1",
      schoolId: "default-school",
      studentId: "stu-1",
      createdBy: "test-user-id",
      date: new Date("2025-01-01"),
      category: "HEALTH",
      description: "Student felt unwell",
      actionTaken: null,
      followUpRequired: false,
    };

    prismaMock.welfareNote.create.mockResolvedValue(mockNote as never);

    const result = await createWelfareNoteAction({
      studentId: "stu-1",
      date: "2025-01-01",
      category: "HEALTH",
      description: "Student felt unwell",
    });

    expect(result).toHaveProperty("data");
    expect((result as { data: { id: string } }).data.id).toBe("wn-1");
  });
});

describe("getWelfareNotesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getWelfareNotesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated welfare notes", async () => {
    prismaMock.welfareNote.findMany.mockResolvedValue([] as never);
    prismaMock.welfareNote.count.mockResolvedValue(0 as never);

    const result = await getWelfareNotesAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
  });
});

describe("updateWelfareNoteAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateWelfareNoteAction("wn-1", { status: "RESOLVED" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if note not found", async () => {
    prismaMock.welfareNote.findUnique.mockResolvedValue(null);
    const result = await updateWelfareNoteAction("nonexistent", { status: "RESOLVED" });
    expect(result).toEqual({ error: "Note not found" });
  });

  it("should update welfare note successfully", async () => {
    const existing = { id: "wn-1", status: "OPEN" };
    prismaMock.welfareNote.findUnique.mockResolvedValue(existing as never);
    prismaMock.welfareNote.update.mockResolvedValue({
      ...existing,
      status: "RESOLVED",
    } as never);

    const result = await updateWelfareNoteAction("wn-1", { status: "RESOLVED" });
    expect(result).toHaveProperty("data");
  });
});

// ─── Commendations ─────────────────────────────────────────────────

describe("createCommendationAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createCommendationAction({
      studentId: "stu-1",
      date: "2025-01-01",
      type: "ACADEMIC",
      title: "Best Student",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null);
    const result = await createCommendationAction({
      studentId: "stu-1",
      date: "2025-01-01",
      type: "ACADEMIC",
      title: "Best Student",
    });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should create a commendation successfully", async () => {
    const mockCommendation = {
      id: "com-1",
      schoolId: "default-school",
      studentId: "stu-1",
      awardedBy: "test-user-id",
      date: new Date("2025-01-01"),
      type: "ACADEMIC",
      title: "Best Student",
      description: null,
      termId: null,
      academicYearId: null,
    };

    prismaMock.commendation.create.mockResolvedValue(mockCommendation as never);

    const result = await createCommendationAction({
      studentId: "stu-1",
      date: "2025-01-01",
      type: "ACADEMIC",
      title: "Best Student",
    });

    expect(result).toHaveProperty("data");
    expect((result as { data: { id: string } }).data.id).toBe("com-1");
  });
});

describe("getCommendationsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getCommendationsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated commendations", async () => {
    prismaMock.commendation.findMany.mockResolvedValue([] as never);
    prismaMock.commendation.count.mockResolvedValue(0 as never);

    const result = await getCommendationsAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
  });
});
