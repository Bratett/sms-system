import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { getSiblingsAction } from "@/modules/student/actions/sibling.action";

describe("getSiblingsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated", async () => {
    mockUnauthenticated();
    const result = await getSiblingsAction("s1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns empty when student has no household", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s1",
      schoolId: "default-school",
      householdId: null,
    } as never);

    const result = await getSiblingsAction("s1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data).toEqual([]);
  });

  it("returns empty when student is the only one in the household", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s1",
      schoolId: "default-school",
      householdId: "hh-1",
    } as never);
    prismaMock.student.findMany.mockResolvedValue([] as never);

    const result = await getSiblingsAction("s1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data).toEqual([]);
  });

  it("returns siblings excluding the current student and WITHDRAWN status", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s1",
      schoolId: "default-school",
      householdId: "hh-1",
    } as never);
    prismaMock.student.findMany.mockResolvedValue([
      {
        id: "s2",
        studentId: "SCH/2024/0012",
        firstName: "Kofi",
        lastName: "Asante",
        status: "ACTIVE",
        enrollments: [
          {
            classArm: {
              name: "A",
              class: {
                name: "SHS2",
                programme: { name: "Science" },
              },
            },
          },
        ],
      },
      {
        id: "s3",
        studentId: "SCH/2025/0034",
        firstName: "Akua",
        lastName: "Asante",
        status: "ACTIVE",
        enrollments: [
          {
            classArm: {
              name: "B",
              class: {
                name: "SHS1",
                programme: { name: "Arts" },
              },
            },
          },
        ],
      },
    ] as never);

    const result = await getSiblingsAction("s1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({
      id: "s2",
      studentId: "SCH/2024/0012",
      firstName: "Kofi",
      lastName: "Asante",
      classArmName: "SHS2 A",
      programmeName: "Science",
    });
    expect(result.data[1]!.classArmName).toBe("SHS1 B");
    expect(result.data[1]!.programmeName).toBe("Arts");

    expect(prismaMock.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId: "hh-1",
          id: { not: "s1" },
          status: { not: "WITHDRAWN" },
        }),
      }),
    );
  });

  it("returns error when current student is not found (tenant isolation)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const result = await getSiblingsAction("s-other-school");
    expect(result).toEqual({ error: "Student not found" });
  });
});
