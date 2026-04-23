import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { audit } from "@/lib/audit";
import {
  createMedicalRecordAction,
  getMedicalRecordsAction,
  getMedicalRecordAction,
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
    mockAuthenticatedUser({ schoolId: null });
    const result = await createMedicalRecordAction({
      studentId: "s1",
      date: "2026-03-01",
      type: "CHECKUP",
      title: "Routine Checkup",
      description: "Annual health checkup",
    });
    expect(result).toEqual({ error: "No school context. Please select an active school." });
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
    mockAuthenticatedUser({ schoolId: null });
    const result = await getMedicalRecordsAction();
    expect(result).toEqual({ error: "No school context. Please select an active school." });
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

// ─── getMedicalRecordsAction redaction ─────────────────────────────

describe("getMedicalRecordsAction redaction", () => {
  const confidentialRecord = {
    id: "med-1",
    schoolId: "default-school",
    studentId: "s-1",
    recordedBy: "nurse-1",
    date: new Date("2026-03-01"),
    type: "TREATMENT",
    title: "Allergic Reaction",
    description: "Peanut exposure",
    treatment: "Antihistamine",
    followUpDate: null,
    isConfidential: true,
    attachmentKey: "medical/med-1/photo.jpg",
    student: { firstName: "A", lastName: "B", studentId: "SCH/0001" },
  };
  const publicRecord = {
    id: "med-2",
    schoolId: "default-school",
    studentId: "s-1",
    recordedBy: "nurse-1",
    date: new Date("2026-03-02"),
    type: "CHECKUP",
    title: "Annual Checkup",
    description: "Routine",
    treatment: null,
    followUpDate: null,
    isConfidential: false,
    attachmentKey: null,
    student: { firstName: "A", lastName: "B", studentId: "SCH/0001" },
  };

  it("returns full content when the user has MEDICAL_CONFIDENTIAL_READ", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read", "medical:records:confidential:read"] });
    prismaMock.medicalRecord.findMany.mockResolvedValue([confidentialRecord, publicRecord] as never);
    prismaMock.medicalRecord.count.mockResolvedValue(2 as never);

    const result = await getMedicalRecordsAction();
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data[0]!.title).toBe("Allergic Reaction");
    expect(result.data[0]!.description).toBe("Peanut exposure");
    expect(result.data[0]!.treatment).toBe("Antihistamine");
    expect(result.data[0]!.attachmentKey).toBe("medical/med-1/photo.jpg");
  });

  it("redacts confidential rows when the user lacks MEDICAL_CONFIDENTIAL_READ", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read"] });
    prismaMock.medicalRecord.findMany.mockResolvedValue([confidentialRecord, publicRecord] as never);
    prismaMock.medicalRecord.count.mockResolvedValue(2 as never);

    const result = await getMedicalRecordsAction();
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data[0]!.title).toBe("Confidential — restricted");
    expect(result.data[0]!.description).toBe("");
    expect(result.data[0]!.treatment).toBeNull();
    expect(result.data[0]!.attachmentKey).toBeNull();
    expect(result.data[0]!.isConfidential).toBe(true);
    expect(result.data[0]!.type).toBe("TREATMENT");
    // Non-confidential row is untouched
    expect(result.data[1]!.title).toBe("Annual Checkup");
    expect(result.data[1]!.description).toBe("Routine");
  });
});

// ─── getMedicalRecordAction (detail) ──────────────────────────────

describe("getMedicalRecordAction", () => {
  beforeEach(() => {
    vi.mocked(audit).mockClear();
    vi.mocked(audit).mockResolvedValue(undefined);
  });

  const confidentialRecord = {
    id: "med-1",
    schoolId: "default-school",
    studentId: "s-1",
    recordedBy: "nurse-1",
    date: new Date("2026-03-01"),
    type: "TREATMENT",
    title: "Allergic Reaction",
    description: "Peanut exposure",
    treatment: "Antihistamine",
    followUpDate: null,
    isConfidential: true,
    attachmentKey: null,
    student: { firstName: "A", lastName: "B", studentId: "SCH/0001" },
  };

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMedicalRecordAction("med-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects users lacking MEDICAL_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getMedicalRecordAction("med-1");
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("returns { error: 'Record not found' } when findFirst returns null", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read"] });
    prismaMock.medicalRecord.findFirst.mockResolvedValue(null as never);
    const result = await getMedicalRecordAction("med-1");
    expect(result).toEqual({ error: "Record not found" });
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });

  it("returns full record + writes audit log when authorized on confidential", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read", "medical:records:confidential:read"] });
    prismaMock.medicalRecord.findFirst.mockResolvedValue(confidentialRecord as never);

    const result = await getMedicalRecordAction("med-1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.title).toBe("Allergic Reaction");
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "READ",
        entity: "MedicalRecord",
        entityId: "med-1",
        module: "medical",
        metadata: { isConfidential: true, denied: false },
      }),
    );
  });

  it("returns redacted record + writes denial audit log when unauthorized on confidential", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read"] });
    prismaMock.medicalRecord.findFirst.mockResolvedValue(confidentialRecord as never);

    const result = await getMedicalRecordAction("med-1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.title).toBe("Confidential — restricted");
    expect(result.data.description).toBe("");
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "READ",
        entity: "MedicalRecord",
        entityId: "med-1",
        metadata: { isConfidential: true, denied: true },
      }),
    );
  });

  it("does not write audit log when record is not confidential", async () => {
    mockAuthenticatedUser({ permissions: ["medical:records:read"] });
    const publicRecord = { ...confidentialRecord, id: "med-2", isConfidential: false };
    prismaMock.medicalRecord.findFirst.mockResolvedValue(publicRecord as never);

    const result = await getMedicalRecordAction("med-2");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.title).toBe("Allergic Reaction");
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });
});
