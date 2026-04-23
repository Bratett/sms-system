import { describe, it, expect, vi, beforeEach } from "vitest";
import { audit } from "@/lib/audit";
import {
  resolveConfidentialCapability,
  redactMedicalRecord,
  redactCounselingRecord,
  logConfidentialAccess,
} from "@/lib/confidential";

// audit() is globally mocked in tests/unit/setup.ts

const baseMedical = {
  id: "med-1",
  studentId: "s-1",
  date: new Date("2026-03-01"),
  type: "TREATMENT",
  title: "Allergic Reaction",
  description: "Student had a reaction to peanuts",
  treatment: "Antihistamine administered",
  followUpDate: new Date("2026-03-08"),
  isConfidential: true,
  attachmentKey: "medical/med-1/photo.jpg",
  recordedBy: "nurse-1",
};

const baseCounseling = {
  id: "cns-1",
  studentId: "s-1",
  sessionDate: new Date("2026-03-01"),
  type: "INDIVIDUAL",
  summary: "Student disclosed family issues",
  actionPlan: "Weekly check-in for 4 weeks",
  followUpDate: new Date("2026-03-08"),
  isConfidential: true,
  counselorId: "counselor-1",
  status: "OPEN",
};

describe("resolveConfidentialCapability", () => {
  it("returns canReadConfidential: true when session has the permission", () => {
    const session = {
      user: { id: "u1", permissions: ["medical:records:confidential:read"] },
    };
    const cap = resolveConfidentialCapability(session, "medical:records:confidential:read");
    expect(cap.canReadConfidential).toBe(true);
  });

  it("returns canReadConfidential: true when session has the '*' wildcard", () => {
    const session = { user: { id: "u1", permissions: ["*"] } };
    const cap = resolveConfidentialCapability(session, "medical:records:confidential:read");
    expect(cap.canReadConfidential).toBe(true);
  });

  it("returns canReadConfidential: false when session lacks the permission", () => {
    const session = { user: { id: "u1", permissions: ["medical:records:read"] } };
    const cap = resolveConfidentialCapability(session, "medical:records:confidential:read");
    expect(cap.canReadConfidential).toBe(false);
  });

  it("returns canReadConfidential: false for null session", () => {
    const cap = resolveConfidentialCapability(null, "medical:records:confidential:read");
    expect(cap.canReadConfidential).toBe(false);
  });
});

describe("redactMedicalRecord", () => {
  it("returns record unchanged when not confidential", () => {
    const input = { ...baseMedical, isConfidential: false };
    expect(redactMedicalRecord(input, false)).toBe(input);
  });

  it("returns record unchanged when canRead is true, even if confidential", () => {
    expect(redactMedicalRecord(baseMedical, true)).toBe(baseMedical);
  });

  it("strips sensitive fields when confidential and canRead is false", () => {
    const result = redactMedicalRecord(baseMedical, false);
    expect(result.title).toBe("Confidential — restricted");
    expect(result.description).toBe("");
    expect(result.treatment).toBeNull();
    expect(result.attachmentKey).toBeNull();
  });

  it("preserves metadata fields when redacting", () => {
    const result = redactMedicalRecord(baseMedical, false);
    expect(result.id).toBe(baseMedical.id);
    expect(result.studentId).toBe(baseMedical.studentId);
    expect(result.date).toBe(baseMedical.date);
    expect(result.type).toBe(baseMedical.type);
    expect(result.followUpDate).toBe(baseMedical.followUpDate);
    expect(result.isConfidential).toBe(true);
    expect(result.recordedBy).toBe(baseMedical.recordedBy);
  });
});

describe("redactCounselingRecord", () => {
  it("returns record unchanged when not confidential", () => {
    const input = { ...baseCounseling, isConfidential: false };
    expect(redactCounselingRecord(input, false)).toBe(input);
  });

  it("returns record unchanged when canRead is true, even if confidential", () => {
    expect(redactCounselingRecord(baseCounseling, true)).toBe(baseCounseling);
  });

  it("strips summary and actionPlan when confidential and canRead is false", () => {
    const result = redactCounselingRecord(baseCounseling, false);
    expect(result.summary).toBe("Confidential — restricted");
    expect(result.actionPlan).toBeNull();
  });

  it("preserves metadata fields when redacting", () => {
    const result = redactCounselingRecord(baseCounseling, false);
    expect(result.id).toBe(baseCounseling.id);
    expect(result.sessionDate).toBe(baseCounseling.sessionDate);
    expect(result.type).toBe(baseCounseling.type);
    expect(result.counselorId).toBe(baseCounseling.counselorId);
    expect(result.status).toBe(baseCounseling.status);
    expect(result.followUpDate).toBe(baseCounseling.followUpDate);
  });
});

describe("logConfidentialAccess", () => {
  beforeEach(() => {
    vi.mocked(audit).mockClear();
    vi.mocked(audit).mockResolvedValue(undefined);
  });

  it("writes audit row with description for authorized access", async () => {
    await logConfidentialAccess({
      userId: "u1",
      schoolId: "school-1",
      entity: "MedicalRecord",
      entityId: "med-1",
      isConfidential: true,
      denied: false,
      module: "medical",
    });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        schoolId: "school-1",
        action: "READ",
        entity: "MedicalRecord",
        entityId: "med-1",
        module: "medical",
        description: "Accessed confidential MedicalRecord",
        metadata: { isConfidential: true, denied: false },
      }),
    );
  });

  it("writes audit row with denial description when denied", async () => {
    await logConfidentialAccess({
      userId: "u2",
      schoolId: "school-1",
      entity: "CounselingRecord",
      entityId: "cns-9",
      isConfidential: true,
      denied: true,
      module: "welfare",
    });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "READ",
        entity: "CounselingRecord",
        entityId: "cns-9",
        module: "welfare",
        description: "Denied access to confidential CounselingRecord",
        metadata: { isConfidential: true, denied: true },
      }),
    );
  });

  it("does not throw when audit throws internally", async () => {
    vi.mocked(audit).mockRejectedValueOnce(new Error("db down"));
    await expect(
      logConfidentialAccess({
        userId: "u1",
        schoolId: "school-1",
        entity: "MedicalRecord",
        entityId: "med-1",
        isConfidential: true,
        denied: false,
        module: "medical",
      }),
    ).resolves.toBeUndefined();
  });
});
