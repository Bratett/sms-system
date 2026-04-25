import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../../setup";
import {
  resolveTargetedStudentsForRelease,
  groupRecipientsForFanOut,
} from "@/modules/academics/release/release-targeting";

describe("resolveTargetedStudentsForRelease", () => {
  beforeEach(() => {
    prismaMock.student.findMany.mockReset();
  });

  it("returns students with active enrollment in the arm-term", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: "s1", firstName: "Kofi", lastName: "Asante" },
      { id: "s2", firstName: "Akua", lastName: "Mensah" },
    ] as never);

    const result = await resolveTargetedStudentsForRelease({
      schoolId: "school-1",
      termId: "term-1",
      classArmId: "arm-1",
    });

    expect(result.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "school-1",
          status: { in: ["ACTIVE", "SUSPENDED"] },
          enrollments: {
            some: { status: "ACTIVE", classArmId: "arm-1" },
          },
        }),
      }),
    );
  });

  it("excludes WITHDRAWN/GRADUATED/TRANSFERRED students", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    await resolveTargetedStudentsForRelease({
      schoolId: "school-1",
      termId: "term-1",
      classArmId: "arm-1",
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["ACTIVE", "SUSPENDED"] },
        }),
      }),
    );
  });

  it("scopes by schoolId", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    await resolveTargetedStudentsForRelease({
      schoolId: "other-school",
      termId: "term-1",
      classArmId: "arm-1",
    });
    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "other-school" }),
      }),
    );
  });

  it("returns empty when arm has no enrolled students", async () => {
    prismaMock.student.findMany.mockResolvedValue([] as never);
    const result = await resolveTargetedStudentsForRelease({
      schoolId: "school-1",
      termId: "term-1",
      classArmId: "empty-arm",
    });
    expect(result).toEqual([]);
  });
});

describe("groupRecipientsForFanOut", () => {
  it("groups student names per guardian userId, deduplicates household ids", () => {
    const studentRecords = [
      {
        id: "s1",
        firstName: "Kofi",
        lastName: "Asante",
        guardians: [
          { guardian: { householdId: "hh-1", userId: "user-1" } },
          { guardian: { householdId: "hh-1", userId: "user-2" } },
        ],
      },
      {
        id: "s2",
        firstName: "Akua",
        lastName: "Asante",
        guardians: [
          { guardian: { householdId: "hh-1", userId: "user-1" } },
          { guardian: { householdId: "hh-1", userId: "user-2" } },
        ],
      },
      {
        id: "s3",
        firstName: "Yaw",
        lastName: "Mensah",
        guardians: [{ guardian: { householdId: "hh-2", userId: "user-3" } }],
      },
    ];

    const result = groupRecipientsForFanOut(studentRecords);

    expect(result.recipientUserIds.sort()).toEqual(["user-1", "user-2", "user-3"]);
    expect(result.householdIds.sort()).toEqual(["hh-1", "hh-2"]);
    expect(result.studentNamesByUserId.get("user-1")?.sort()).toEqual([
      "Akua Asante",
      "Kofi Asante",
    ]);
    expect(result.studentNamesByUserId.get("user-3")).toEqual(["Yaw Mensah"]);
  });

  it("skips guardians without a userId (no portal account)", () => {
    const studentRecords = [
      {
        id: "s1",
        firstName: "Kofi",
        lastName: "Asante",
        guardians: [
          { guardian: { householdId: "hh-1", userId: null } },
          { guardian: { householdId: "hh-1", userId: "user-1" } },
        ],
      },
    ];

    const result = groupRecipientsForFanOut(studentRecords);

    expect(result.recipientUserIds).toEqual(["user-1"]);
    expect(result.householdIds).toEqual(["hh-1"]);
  });

  it("skips guardians without a householdId", () => {
    const studentRecords = [
      {
        id: "s1",
        firstName: "Kofi",
        lastName: "Asante",
        guardians: [
          { guardian: { householdId: null, userId: "user-1" } },
        ],
      },
    ];

    const result = groupRecipientsForFanOut(studentRecords);

    expect(result.recipientUserIds).toEqual([]);
    expect(result.householdIds).toEqual([]);
  });
});
