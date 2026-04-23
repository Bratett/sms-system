import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { audit } from "@/lib/audit";
import {
  previewMergeAction,
  performMergeAction,
  scanGuardianDuplicatesAction,
} from "@/modules/student/actions/guardian-merge.action";

const baseGuardian = {
  id: "g-survivor",
  schoolId: "default-school",
  firstName: "Kwame",
  lastName: "Asante",
  phone: "0241234567",
  altPhone: null,
  email: "kwame@example.com",
  occupation: "Teacher",
  address: "Accra",
  relationship: "Father",
  householdId: "hh-1",
  userId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date(),
};

describe("previewMergeAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["students:guardians:merge"] }));

  it("rejects users without GUARDIANS_MERGE", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await previewMergeAction({ duplicateId: "g-dup", survivorId: "g-survivor" });
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("returns not-found when either guardian missing", async () => {
    prismaMock.guardian.findFirst.mockResolvedValueOnce(null as never);
    const result = await previewMergeAction({ duplicateId: "g-dup", survivorId: "missing" });
    expect(result).toEqual({ error: "Guardian not found" });
  });

  it("flags conflicts when both have userId", async () => {
    prismaMock.guardian.findFirst
      .mockResolvedValueOnce({ ...baseGuardian, id: "g-survivor", userId: "user-1" } as never)
      .mockResolvedValueOnce({ ...baseGuardian, id: "g-dup", userId: "user-2" } as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);

    const result = await previewMergeAction({ duplicateId: "g-dup", survivorId: "g-survivor" });
    if (!("data" in result)) throw new Error("expected data");
    expect(result.conflicts).toContain("both have parent portal accounts");
  });

  it("flags conflicts when guardians are in different households", async () => {
    prismaMock.guardian.findFirst
      .mockResolvedValueOnce({ ...baseGuardian, householdId: "hh-A" } as never)
      .mockResolvedValueOnce({ ...baseGuardian, id: "g-dup", householdId: "hh-B" } as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);

    const result = await previewMergeAction({ duplicateId: "g-dup", survivorId: "g-survivor" });
    if (!("data" in result)) throw new Error("expected data");
    expect(result.conflicts).toContain("different households");
  });

  it("returns no conflicts and field fills when clean", async () => {
    prismaMock.guardian.findFirst
      .mockResolvedValueOnce({ ...baseGuardian, occupation: null, address: null } as never)
      .mockResolvedValueOnce({ ...baseGuardian, id: "g-dup", occupation: "Doctor", address: "Kumasi", userId: null } as never);
    prismaMock.studentGuardian.findMany
      .mockResolvedValueOnce([
        { studentId: "s1", guardianId: "g-dup", isPrimary: false },
        { studentId: "s2", guardianId: "g-dup", isPrimary: true },
      ] as never)
      .mockResolvedValueOnce([] as never); // survivor has no existing links

    const result = await previewMergeAction({ duplicateId: "g-dup", survivorId: "g-survivor" });
    if (!("data" in result)) throw new Error("expected data");
    expect(result.conflicts).toEqual([]);
    expect(result.data.linksToTransfer).toBe(2);
    expect(result.data.fieldFills).toHaveProperty("occupation");
    expect(result.data.fieldFills.occupation).toEqual({ from: null, to: "Doctor" });
  });
});

describe("performMergeAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["students:guardians:merge"] });
    vi.mocked(audit).mockClear();
  });

  it("transfers links, fills nulls, deletes duplicate, writes audit", async () => {
    const survivor = { ...baseGuardian, occupation: null, address: null };
    const duplicate = { ...baseGuardian, id: "g-dup", occupation: "Doctor", address: "Kumasi", userId: null };

    // previewMergeAction re-runs findFirst twice; performMergeAction runs it twice more
    prismaMock.guardian.findFirst
      .mockResolvedValueOnce(survivor as never)
      .mockResolvedValueOnce(duplicate as never)
      .mockResolvedValueOnce(survivor as never)
      .mockResolvedValueOnce(duplicate as never);

    prismaMock.studentGuardian.findMany
      .mockResolvedValueOnce([] as never) // preview: duplicate-side links
      .mockResolvedValueOnce([] as never) // preview: survivor-side links
      .mockResolvedValueOnce([
        { id: "link-1", studentId: "s1", guardianId: "g-dup", isPrimary: false, schoolId: "default-school" },
      ] as never) // perform: duplicate-side links
      .mockResolvedValueOnce([] as never); // perform: survivor-side links

    prismaMock.studentGuardian.update.mockResolvedValue({} as never);
    prismaMock.guardian.update.mockResolvedValue(survivor as never);
    prismaMock.guardian.delete.mockResolvedValue(duplicate as never);

    const result = await performMergeAction({ duplicateId: "g-dup", survivorId: "g-survivor" });
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data.absorbedLinks).toBe(1);
    expect(prismaMock.guardian.delete).toHaveBeenCalledWith({ where: { id: "g-dup" } });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entity: "Guardian", entityId: "g-dup" }),
    );
  });

  it("refuses when conflicts exist", async () => {
    prismaMock.guardian.findFirst
      .mockResolvedValueOnce({ ...baseGuardian, userId: "user-1" } as never)
      .mockResolvedValueOnce({ ...baseGuardian, id: "g-dup", userId: "user-2" } as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);

    const result = await performMergeAction({ duplicateId: "g-dup", survivorId: "g-survivor" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("conflict");
    expect(prismaMock.guardian.delete).not.toHaveBeenCalled();
  });
});

describe("scanGuardianDuplicatesAction", () => {
  beforeEach(() => mockAuthenticatedUser({ permissions: ["students:guardians:merge"] }));

  it("returns clusters of potential duplicates", async () => {
    prismaMock.guardian.findMany.mockResolvedValue([
      { id: "g1", firstName: "Kwame", lastName: "Asante", phone: "0241234567", email: "kwame@example.com" },
      { id: "g2", firstName: "Kwame", lastName: "Assante", phone: "+233 24 123 4567", email: null },
      { id: "g3", firstName: "Unique", lastName: "Person", phone: "0999999999", email: null },
    ] as never);

    const result = await scanGuardianDuplicatesAction();
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data.length).toBeGreaterThan(0);
    const hasCluster = result.data.some(
      (c) => c.cluster.length >= 2 && c.cluster.some((m) => m.guardian.id === "g1") && c.cluster.some((m) => m.guardian.id === "g2"),
    );
    expect(hasCluster).toBe(true);
  });

  it("returns empty data when no duplicates exist", async () => {
    prismaMock.guardian.findMany.mockResolvedValue([
      { id: "g1", firstName: "A", lastName: "One", phone: "0100000001", email: null },
      { id: "g2", firstName: "B", lastName: "Two", phone: "0200000002", email: null },
    ] as never);

    const result = await scanGuardianDuplicatesAction();
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data).toEqual([]);
  });
});
