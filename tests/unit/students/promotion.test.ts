import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { getEligibleSourceArmsAction } from "@/modules/student/actions/promotion.action";

describe("getEligibleSourceArmsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getEligibleSourceArmsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns arms in current academic year without an active draft run", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: "ay-1", schoolId: "default-school" } as never);
    prismaMock.classArm.findMany.mockResolvedValue([
      { id: "ca-1", name: "A", class: { name: "SHS 1 Science", academicYearId: "ay-1", yearGroup: 1 }, _count: { enrollments: 32 } },
    ] as never);
    prismaMock.promotionRun.findMany.mockResolvedValue([]);

    const result = await getEligibleSourceArmsAction();
    expect(result).toEqual({ data: expect.arrayContaining([expect.objectContaining({ id: "ca-1" })]) });
  });

  it("excludes arms with an existing DRAFT run", async () => {
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: "ay-1", schoolId: "default-school" } as never);
    prismaMock.classArm.findMany.mockResolvedValue([
      { id: "ca-1", name: "A", class: { name: "SHS 1 Science", academicYearId: "ay-1", yearGroup: 1 }, _count: { enrollments: 32 } },
    ] as never);
    prismaMock.promotionRun.findMany.mockResolvedValue([
      { sourceClassArmId: "ca-1", status: "DRAFT" },
    ] as never);

    const result = await getEligibleSourceArmsAction();
    expect(result).toEqual({ data: [] });
  });
});
