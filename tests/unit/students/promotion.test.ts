import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { getEligibleSourceArmsAction, listPromotionRunsAction, getPromotionRunAction, createPromotionRunAction, seedPromotionRunItemsAction } from "@/modules/student/actions/promotion.action";

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

describe("listPromotionRunsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns drafts and recent committed runs", async () => {
    prismaMock.promotionRun.findMany.mockResolvedValue([
      { id: "pr-1", status: "DRAFT", sourceClassArm: { name: "A", class: { name: "SHS1 Sci" } } },
      { id: "pr-2", status: "COMMITTED", committedAt: new Date(), sourceClassArm: { name: "B", class: { name: "SHS1 Sci" } } },
    ] as never);

    const result = await listPromotionRunsAction();
    expect(result).toEqual({ data: expect.arrayContaining([
      expect.objectContaining({ id: "pr-1" }),
      expect.objectContaining({ id: "pr-2" }),
    ]) });
  });
});

describe("getPromotionRunAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns the run with items and capacity rollup", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1",
      schoolId: "default-school",
      status: "DRAFT",
      targetAcademicYearId: "ay-2",
      items: [
        { id: "pri-1", outcome: "PROMOTE", destinationClassArmId: "ca-2", student: { firstName: "A", lastName: "B", studentId: "S/1" } },
      ],
      sourceClassArm: { id: "ca-1", name: "A", class: { name: "SHS1 Sci", yearGroup: 1, programmeId: "pr-sci" } },
      sourceAcademicYear: { id: "ay-1", name: "2025/26" },
      targetAcademicYear: { id: "ay-2", name: "2026/27" },
    } as never);
    prismaMock.classArm.findMany.mockResolvedValue([
      { id: "ca-2", capacity: 40, _count: { enrollments: 10 } },
    ] as never);

    const result = await getPromotionRunAction("pr-1");
    expect(result).toMatchObject({ data: { id: "pr-1", capacityByArm: { "ca-2": { capacity: 40, existing: 10, incoming: 1 } } } });
  });

  it("returns error when run does not belong to current school", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue(null);
    const result = await getPromotionRunAction("pr-x");
    expect(result).toEqual({ error: "Promotion run not found" });
  });
});

describe("createPromotionRunAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects when source arm does not exist in current year", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue(null);
    const result = await createPromotionRunAction({ sourceClassArmId: "clh1234567890abcdefghijkl" });
    expect(result).toEqual({ error: "Source class arm not found in the current academic year" });
  });

  it("rejects when target academic year does not exist", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "clh1234567890abcdefghijkl",
      class: { academicYearId: "ay-1", yearGroup: 1 },
    } as never);
    prismaMock.academicYear.findFirst
      .mockResolvedValueOnce({ id: "ay-1", startDate: new Date("2025-09-01") } as never)
      .mockResolvedValueOnce(null);

    const result = await createPromotionRunAction({ sourceClassArmId: "clh1234567890abcdefghijkl" });
    expect(result).toEqual({ error: "No target academic year found. Create the next academic year first." });
  });

  it("rejects duplicate draft on the same arm", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "clh1234567890abcdefghijkl",
      class: { academicYearId: "ay-1", yearGroup: 1 },
    } as never);
    prismaMock.academicYear.findFirst
      .mockResolvedValueOnce({ id: "ay-1", startDate: new Date("2025-09-01") } as never)
      .mockResolvedValueOnce({ id: "ay-2", startDate: new Date("2026-09-01") } as never);
    prismaMock.promotionRun.findFirst.mockResolvedValue({ id: "pr-existing", status: "DRAFT" } as never);

    const result = await createPromotionRunAction({ sourceClassArmId: "clh1234567890abcdefghijkl" });
    expect(result).toEqual({ error: "A draft promotion run already exists for this class arm" });
  });

  it("creates a new DRAFT run when valid", async () => {
    prismaMock.classArm.findFirst.mockResolvedValue({
      id: "clh1234567890abcdefghijkl",
      class: { academicYearId: "ay-1", yearGroup: 1 },
    } as never);
    prismaMock.academicYear.findFirst
      .mockResolvedValueOnce({ id: "ay-1", startDate: new Date("2025-09-01") } as never)
      .mockResolvedValueOnce({ id: "ay-2", startDate: new Date("2026-09-01") } as never);
    prismaMock.promotionRun.findFirst.mockResolvedValue(null);
    prismaMock.promotionRun.create.mockResolvedValue({ id: "pr-new", status: "DRAFT" } as never);

    const result = await createPromotionRunAction({ sourceClassArmId: "clh1234567890abcdefghijkl" });
    expect(result).toEqual({ data: expect.objectContaining({ id: "pr-new", status: "DRAFT" }) });
  });
});

describe("seedPromotionRunItemsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns missing-class errors when next-yearGroup classes are absent", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", schoolId: "default-school", status: "DRAFT",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2",
      sourceClassArm: { id: "ca-1", name: "A", class: { programmeId: "pr-sci", yearGroup: 1 } },
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { id: "e-1", studentId: "s-1", student: { id: "s-1", status: "ACTIVE" }, isFreeShsPlacement: false },
    ] as never);
    prismaMock.class.findFirst.mockResolvedValue(null);

    const result = await seedPromotionRunItemsAction("pr-1");
    expect(result).toMatchObject({ error: expect.stringContaining("Missing target-year class") });
  });

  it("seeds items with PROMOTE default for yearGroup 1 students and same-named dest arm", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", schoolId: "default-school", status: "DRAFT",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2",
      sourceClassArm: { id: "ca-1", name: "A", class: { programmeId: "pr-sci", yearGroup: 1 } },
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { id: "e-1", studentId: "s-1", student: { id: "s-1", status: "ACTIVE" }, isFreeShsPlacement: false },
    ] as never);
    prismaMock.class.findFirst.mockResolvedValue({ id: "cl-2", yearGroup: 2, classArms: [{ id: "ca-2", name: "A" }] } as never);
    prismaMock.promotionRunItem.findMany.mockResolvedValue([]);
    prismaMock.promotionRunItem.createMany.mockResolvedValue({ count: 1 } as never);

    const result = await seedPromotionRunItemsAction("pr-1");
    expect(result).toEqual({ data: { seeded: 1, skipped: 0 } });
    expect(prismaMock.promotionRunItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        runId: "pr-1", studentId: "s-1", outcome: "PROMOTE", destinationClassArmId: "ca-2",
        previousEnrollmentId: "e-1", previousStatus: "ACTIVE",
      })],
    });
  });

  it("defaults yearGroup 3 students to GRADUATE with null destination", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", schoolId: "default-school", status: "DRAFT",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2",
      sourceClassArm: { id: "ca-3", name: "A", class: { programmeId: "pr-sci", yearGroup: 3 } },
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { id: "e-3", studentId: "s-3", student: { id: "s-3", status: "ACTIVE" }, isFreeShsPlacement: false },
    ] as never);
    prismaMock.promotionRunItem.findMany.mockResolvedValue([]);
    prismaMock.promotionRunItem.createMany.mockResolvedValue({ count: 1 } as never);

    const result = await seedPromotionRunItemsAction("pr-1");
    expect(result).toEqual({ data: { seeded: 1, skipped: 0 } });
    expect(prismaMock.promotionRunItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ outcome: "GRADUATE", destinationClassArmId: null })],
    });
  });

  it("is idempotent: skips students that already have an item", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", schoolId: "default-school", status: "DRAFT",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2",
      sourceClassArm: { id: "ca-1", name: "A", class: { programmeId: "pr-sci", yearGroup: 1 } },
    } as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { id: "e-1", studentId: "s-1", student: { id: "s-1", status: "ACTIVE" }, isFreeShsPlacement: false },
    ] as never);
    prismaMock.class.findFirst.mockResolvedValue({ id: "cl-2", yearGroup: 2, classArms: [{ id: "ca-2", name: "A" }] } as never);
    prismaMock.promotionRunItem.findMany.mockResolvedValue([{ studentId: "s-1" }] as never);

    const result = await seedPromotionRunItemsAction("pr-1");
    expect(result).toEqual({ data: { seeded: 0, skipped: 1 } });
  });
});
