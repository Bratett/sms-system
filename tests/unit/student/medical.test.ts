import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createMedicalRecordAction,
  getMedicalRecordsAction,
  updateMedicalRecordAction,
} from "@/modules/student/actions/medical.action";

// ─── createMedicalRecordAction ────────────────────────────────────

describe("createMedicalRecordAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createMedicalRecordAction({
      studentId: "s1",
      date: "2026-03-01",
      type: "CHECKUP",
      title: "Routine Checkup",
      description: "Annual health checkup",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await createMedicalRecordAction({
      studentId: "s1",
      date: "2026-03-01",
      type: "CHECKUP",
      title: "Routine Checkup",
      description: "Annual health checkup",
    });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should create medical record successfully", async () => {
    const mockRecord = {
      id: "med-1",
      schoolId: "default-school",
      studentId: "s1",
      recordedBy: "test-user-id",
      date: new Date("2026-03-01"),
      type: "CHECKUP",
      title: "Routine Checkup",
      description: "Annual health checkup",
      treatment: null,
      followUpDate: null,
      isConfidential: true,
      attachmentKey: null,
    };
    prismaMock.medicalRecord.create.mockResolvedValue(mockRecord as never);

    const result = await createMedicalRecordAction({
      studentId: "s1",
      date: "2026-03-01",
      type: "CHECKUP",
      title: "Routine Checkup",
      description: "Annual health checkup",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof mockRecord }).data.id).toBe("med-1");
    expect(prismaMock.medicalRecord.create).toHaveBeenCalled();
  });

  it("should create medical record with optional fields", async () => {
    const mockRecord = {
      id: "med-2",
      schoolId: "default-school",
      studentId: "s1",
      treatment: "Paracetamol",
      followUpDate: new Date("2026-04-01"),
      isConfidential: false,
    };
    prismaMock.medicalRecord.create.mockResolvedValue(mockRecord as never);

    const result = await createMedicalRecordAction({
      studentId: "s1",
      date: "2026-03-01",
      type: "TREATMENT",
      title: "Fever Treatment",
      description: "Student had high fever",
      treatment: "Paracetamol",
      followUpDate: "2026-04-01",
      isConfidential: false,
    });
    expect(result).toHaveProperty("data");
    expect(prismaMock.medicalRecord.create).toHaveBeenCalled();
  });
});

// ─── getMedicalRecordsAction ──────────────────────────────────────

describe("getMedicalRecordsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMedicalRecordsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getMedicalRecordsAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return paginated medical records with defaults", async () => {
    prismaMock.medicalRecord.findMany.mockResolvedValue([] as never);
    prismaMock.medicalRecord.count.mockResolvedValue(0 as never);

    const result = await getMedicalRecordsAction();
    expect(result).toEqual({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
  });

  it("should apply studentId and type filters", async () => {
    prismaMock.medicalRecord.findMany.mockResolvedValue([
      {
        id: "med-1",
        type: "CHECKUP",
        student: { firstName: "Kwame", lastName: "Asante", studentId: "SCH/2026/0001" },
      },
    ] as never);
    prismaMock.medicalRecord.count.mockResolvedValue(1 as never);

    const result = await getMedicalRecordsAction({
      studentId: "s1",
      type: "CHECKUP",
      page: 1,
      pageSize: 10,
    });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    const pagination = (result as { pagination: Record<string, unknown> }).pagination;
    expect(pagination.total).toBe(1);
  });
});

// ─── updateMedicalRecordAction ────────────────────────────────────

describe("updateMedicalRecordAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateMedicalRecordAction("med-1", { treatment: "Rest" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if record not found", async () => {
    prismaMock.medicalRecord.findUnique.mockResolvedValue(null as never);
    const result = await updateMedicalRecordAction("nonexistent", { treatment: "Rest" });
    expect(result).toEqual({ error: "Record not found" });
  });

  it("should update medical record successfully", async () => {
    const existing = {
      id: "med-1",
      treatment: null,
      description: "Original description",
    };
    prismaMock.medicalRecord.findUnique.mockResolvedValue(existing as never);

    const updated = { ...existing, treatment: "Rest and fluids" };
    prismaMock.medicalRecord.update.mockResolvedValue(updated as never);

    const result = await updateMedicalRecordAction("med-1", {
      treatment: "Rest and fluids",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof updated }).data.treatment).toBe("Rest and fluids");
    expect(prismaMock.medicalRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "med-1" },
      })
    );
  });
});
