import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { audit } from "@/lib/audit";
import {
  getCounselingRecordsAction,
  getCounselingRecordAction,
} from "@/modules/discipline/actions/counseling.action";

const confidentialRecord = {
  id: "cns-1",
  schoolId: "default-school",
  studentId: "s-1",
  counselorId: "counselor-1",
  sessionDate: new Date("2026-03-01"),
  type: "INDIVIDUAL",
  summary: "Family issues",
  actionPlan: "Weekly check-in",
  followUpDate: null,
  isConfidential: true,
  status: "OPEN",
};
const publicRecord = {
  id: "cns-2",
  schoolId: "default-school",
  studentId: "s-1",
  counselorId: "counselor-1",
  sessionDate: new Date("2026-03-02"),
  type: "GROUP",
  summary: "Career guidance",
  actionPlan: null,
  followUpDate: null,
  isConfidential: false,
  status: "CLOSED",
};

describe("getCounselingRecordsAction redaction", () => {
  it("returns full content when the user has COUNSELING_CONFIDENTIAL_READ", async () => {
    mockAuthenticatedUser({
      permissions: ["welfare:counseling:read", "welfare:counseling:confidential:read"],
    });
    prismaMock.counselingRecord.findMany.mockResolvedValue([confidentialRecord, publicRecord] as never);
    prismaMock.counselingRecord.count.mockResolvedValue(2 as never);

    const result = await getCounselingRecordsAction();
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data[0]!.summary).toBe("Family issues");
    expect(result.data[0]!.actionPlan).toBe("Weekly check-in");
  });

  it("redacts confidential rows when the user lacks COUNSELING_CONFIDENTIAL_READ", async () => {
    mockAuthenticatedUser({ permissions: ["welfare:counseling:read"] });
    prismaMock.counselingRecord.findMany.mockResolvedValue([confidentialRecord, publicRecord] as never);
    prismaMock.counselingRecord.count.mockResolvedValue(2 as never);

    const result = await getCounselingRecordsAction();
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data[0]!.summary).toBe("Confidential — restricted");
    expect(result.data[0]!.actionPlan).toBeNull();
    expect(result.data[0]!.isConfidential).toBe(true);
    expect(result.data[0]!.type).toBe("INDIVIDUAL");
    expect(result.data[1]!.summary).toBe("Career guidance");
  });
});

describe("getCounselingRecordAction", () => {
  beforeEach(() => {
    vi.mocked(audit).mockClear();
    vi.mocked(audit).mockResolvedValue(undefined);
  });

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getCounselingRecordAction("cns-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects users lacking COUNSELING_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getCounselingRecordAction("cns-1");
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("returns { error: 'Record not found' } when findFirst returns null", async () => {
    mockAuthenticatedUser({ permissions: ["welfare:counseling:read"] });
    prismaMock.counselingRecord.findFirst.mockResolvedValue(null as never);
    const result = await getCounselingRecordAction("cns-1");
    expect(result).toEqual({ error: "Record not found" });
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });

  it("returns full record + writes audit log when authorized on confidential", async () => {
    mockAuthenticatedUser({
      permissions: ["welfare:counseling:read", "welfare:counseling:confidential:read"],
    });
    prismaMock.counselingRecord.findFirst.mockResolvedValue(confidentialRecord as never);

    const result = await getCounselingRecordAction("cns-1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.summary).toBe("Family issues");
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "READ",
        entity: "CounselingRecord",
        entityId: "cns-1",
        module: "welfare",
        metadata: { isConfidential: true, denied: false },
      }),
    );
  });

  it("returns redacted record + writes denial audit log when unauthorized", async () => {
    mockAuthenticatedUser({ permissions: ["welfare:counseling:read"] });
    prismaMock.counselingRecord.findFirst.mockResolvedValue(confidentialRecord as never);

    const result = await getCounselingRecordAction("cns-1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.summary).toBe("Confidential — restricted");
    expect(result.data.actionPlan).toBeNull();
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "READ",
        entity: "CounselingRecord",
        entityId: "cns-1",
        metadata: { isConfidential: true, denied: true },
      }),
    );
  });

  it("does not write audit log when record is not confidential", async () => {
    mockAuthenticatedUser({ permissions: ["welfare:counseling:read"] });
    prismaMock.counselingRecord.findFirst.mockResolvedValue(publicRecord as never);

    const result = await getCounselingRecordAction("cns-2");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.summary).toBe("Career guidance");
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });
});
