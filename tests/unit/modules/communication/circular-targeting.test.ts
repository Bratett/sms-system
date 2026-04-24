import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import {
  resolveTargetedHouseholdIds,
  doesAnnouncementTargetGuardian,
} from "@/modules/communication/circular-targeting";

describe("resolveTargetedHouseholdIds", () => {
  beforeEach(() => {
    prismaMock.student.findMany.mockReset();
  });

  it("targetType=all returns households with at least one ACTIVE student", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", guardians: [{ guardian: { householdId: "hh-1" } }] },
      { id: "s2", guardians: [{ guardian: { householdId: "hh-2" } }] },
      { id: "s3", guardians: [{ guardian: { householdId: "hh-1" } }] },
    ] as never);

    const result = await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "all",
      targetIds: null,
    });
    expect(result.sort()).toEqual(["hh-1", "hh-2"]);
  });

  it("targetType=class filters by enrollments.classArm.classId in targetIds", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", guardians: [{ guardian: { householdId: "hh-1" } }] },
    ] as never);

    const result = await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "class",
      targetIds: ["class-a", "class-b"],
    });
    expect(result).toEqual(["hh-1"]);
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollments: { some: { status: "ACTIVE", classArm: { classId: { in: ["class-a", "class-b"] } } } },
        }),
      }),
    );
  });

  it("targetType=programme filters by enrollments.classArm.class.programmeId", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", guardians: [{ guardian: { householdId: "hh-1" } }] },
    ] as never);

    await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "programme",
      targetIds: ["prog-1"],
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollments: { some: { status: "ACTIVE", classArm: { class: { programmeId: { in: ["prog-1"] } } } } },
        }),
      }),
    );
  });

  it("targetType=house filters by houseAssignment.houseId", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "house",
      targetIds: ["house-1"],
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          houseAssignment: { houseId: { in: ["house-1"] } },
        }),
      }),
    );
  });

  it("targetType=specific filters by student id", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);

    await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "specific",
      targetIds: ["s1", "s2"],
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["s1", "s2"] },
        }),
      }),
    );
  });

  it("excludes WITHDRAWN/GRADUATED/TRANSFERRED students", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "all",
      targetIds: null,
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["ACTIVE", "SUSPENDED"] },
        }),
      }),
    );
  });

  it("returns [] when targetIds is null and targetType requires them", async () => {
    const result = await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "class",
      targetIds: null,
    });
    expect(result).toEqual([]);
  });

  it("returns [] when targetIds is empty array for non-all targetType", async () => {
    const result = await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "class",
      targetIds: [],
    });
    expect(result).toEqual([]);
  });

  it("filters out students with no household guardians", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", guardians: [{ guardian: { householdId: null } }] },
      { id: "s2", guardians: [] },
    ] as never);

    const result = await resolveTargetedHouseholdIds({
      schoolId: "school-1",
      targetType: "all",
      targetIds: null,
    });
    expect(result).toEqual([]);
  });

  it("scopes by schoolId", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    await resolveTargetedHouseholdIds({
      schoolId: "school-xyz",
      targetType: "all",
      targetIds: null,
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school-xyz" }),
      }),
    );
  });
});

describe("doesAnnouncementTargetGuardian", () => {
  const guardianStudentContexts = [
    { id: "s1", classArmId: "arm-1", classId: "class-a", programmeId: "prog-1", houseId: "house-1" },
    { id: "s2", classArmId: "arm-2", classId: "class-b", programmeId: "prog-1", houseId: null },
  ];
  const guardianStudentIds = ["s1", "s2"];

  it("returns true for targetType=all (with at least one student)", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "all", targetIds: null },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(true);
  });

  it("returns true for targetType=class when any student's class is in targetIds", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "class", targetIds: ["class-a"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(true);
  });

  it("returns false for targetType=class when no student's class matches", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "class", targetIds: ["class-x"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(false);
  });

  it("returns true for targetType=programme match", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "programme", targetIds: ["prog-1"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(true);
  });

  it("returns true for targetType=house when any student has a matching house", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "house", targetIds: ["house-1"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(true);
  });

  it("returns true for targetType=specific student id match", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "specific", targetIds: ["s2"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(true);
  });

  it("returns false for targetType=specific when no id matches", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "specific", targetIds: ["sX"] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(false);
  });

  it("returns false when targetIds is null for non-all targetType", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "class", targetIds: null },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(false);
  });

  it("handles unknown targetType gracefully (returns false)", () => {
    expect(
      doesAnnouncementTargetGuardian(
        { targetType: "bogus" as never, targetIds: [] },
        guardianStudentIds,
        guardianStudentContexts,
      ),
    ).toBe(false);
  });
});
