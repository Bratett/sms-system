import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../setup";
import { backfillHouseholds } from "../../../scripts/backfill-households";

// Helper to build a StudentGuardian record
function sg(studentId: string, guardianId: string, isPrimary = false) {
  return { studentId, guardianId, isPrimary, schoolId: "school-1" };
}

describe("backfillHouseholds", () => {
  beforeEach(() => {
    prismaMock.household.create.mockImplementation(async ({ data }) => ({
      id: `hh-${data.name.replace(/\s/g, "-").toLowerCase()}`,
      schoolId: data.schoolId,
      name: data.name,
      address: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as never);
  });

  it("groups three students sharing two guardians into one household", async () => {
    prismaMock.school.findMany.mockResolvedValue([{ id: "school-1" }] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([
      sg("s1", "g1", true),
      sg("s2", "g1"),
      sg("s2", "g2"),
      sg("s3", "g2"),
    ] as never);
    prismaMock.guardian.findMany.mockResolvedValue([
      { id: "g1", firstName: "Kwame", lastName: "Asante", householdId: null },
      { id: "g2", firstName: "Akua", lastName: "Asante", householdId: null },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", householdId: null },
      { id: "s2", householdId: null },
      { id: "s3", householdId: null },
    ] as never);

    await backfillHouseholds({ dryRun: false });

    // One household created per school (one connected component here)
    expect(prismaMock.household.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.household.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Asante Family", schoolId: "school-1" }),
      }),
    );

    // All 2 guardians + 3 students updated
    expect(prismaMock.guardian.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.student.update).toHaveBeenCalledTimes(3);
  });

  it("creates a minimal household for an isolated guardian", async () => {
    prismaMock.school.findMany.mockResolvedValue([{ id: "school-1" }] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);
    prismaMock.guardian.findMany.mockResolvedValue([
      { id: "g1", firstName: "Kwame", lastName: "Asante", householdId: null },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await backfillHouseholds({ dryRun: false });

    expect(prismaMock.household.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.household.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Asante Family" }) }),
    );
    expect(prismaMock.guardian.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.student.update).toHaveBeenCalledTimes(0);
  });

  it("is idempotent: guardians/students with householdId already set are skipped", async () => {
    prismaMock.school.findMany.mockResolvedValue([{ id: "school-1" }] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([sg("s1", "g1", true)] as never);
    prismaMock.guardian.findMany.mockResolvedValue([
      { id: "g1", firstName: "Kwame", lastName: "Asante", householdId: "existing-hh" },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", householdId: "existing-hh" },
    ] as never);

    await backfillHouseholds({ dryRun: false });

    // Nothing to backfill — no household creates, no updates
    expect(prismaMock.household.create).not.toHaveBeenCalled();
    expect(prismaMock.guardian.update).not.toHaveBeenCalled();
    expect(prismaMock.student.update).not.toHaveBeenCalled();
  });

  it("dry-run mode: no writes", async () => {
    prismaMock.school.findMany.mockResolvedValue([{ id: "school-1" }] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([sg("s1", "g1", true)] as never);
    prismaMock.guardian.findMany.mockResolvedValue([
      { id: "g1", firstName: "Kwame", lastName: "Asante", householdId: null },
    ] as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", householdId: null },
    ] as never);

    await backfillHouseholds({ dryRun: true });

    expect(prismaMock.household.create).not.toHaveBeenCalled();
    expect(prismaMock.guardian.update).not.toHaveBeenCalled();
    expect(prismaMock.student.update).not.toHaveBeenCalled();
  });
});
