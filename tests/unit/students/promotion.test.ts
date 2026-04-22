import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { getEligibleSourceArmsAction, listPromotionRunsAction, getPromotionRunAction, createPromotionRunAction, seedPromotionRunItemsAction } from "@/modules/student/actions/promotion.action";
import {
  updatePromotionRunItemAction,
  bulkUpdatePromotionRunItemsAction,
  deletePromotionRunAction,
  commitPromotionRunAction,
  getTargetArmsForRunAction,
} from "@/modules/student/actions/promotion.action";

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

describe("updatePromotionRunItemAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("clears destination when outcome set to GRADUATE", async () => {
    prismaMock.promotionRunItem.findFirst.mockResolvedValue({
      id: "clh0000000000000000000001", runId: "clh0000000000000000000002",
      run: { schoolId: "default-school", status: "DRAFT" },
    } as never);
    prismaMock.promotionRunItem.update.mockResolvedValue({ id: "clh0000000000000000000001" } as never);

    await updatePromotionRunItemAction({ itemId: "clh0000000000000000000001", outcome: "GRADUATE" });
    expect(prismaMock.promotionRunItem.update).toHaveBeenCalledWith({
      where: { id: "clh0000000000000000000001" },
      data: expect.objectContaining({ outcome: "GRADUATE", destinationClassArmId: null }),
    });
  });

  it("rejects edits when the run is not DRAFT", async () => {
    prismaMock.promotionRunItem.findFirst.mockResolvedValue({
      id: "clh0000000000000000000001", runId: "clh0000000000000000000002",
      run: { schoolId: "default-school", status: "COMMITTED" },
    } as never);

    const result = await updatePromotionRunItemAction({ itemId: "clh0000000000000000000001", outcome: "RETAIN" });
    expect(result).toEqual({ error: "Run is no longer editable" });
  });
});

describe("bulkUpdatePromotionRunItemsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("applies bulk outcome change to selected items when destination is provided", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "clh0000000000000000000099", schoolId: "default-school", status: "DRAFT",
    } as never);
    prismaMock.promotionRunItem.updateMany.mockResolvedValue({ count: 3 } as never);

    const result = await bulkUpdatePromotionRunItemsAction({
      runId: "clh0000000000000000000099",
      itemIds: ["clh0000000000000000000001", "clh0000000000000000000002", "clh0000000000000000000003"],
      outcome: "RETAIN",
      destinationClassArmId: "clh0000000000000000000abc",
    });
    expect(result).toEqual({ data: { updated: 3 } });
  });

  it("refuses bulk PROMOTE without a destination arm", async () => {
    const result = await bulkUpdatePromotionRunItemsAction({
      runId: "clh0000000000000000000099",
      itemIds: ["clh0000000000000000000001"],
      outcome: "PROMOTE",
    });
    expect(result).toMatchObject({ error: expect.stringContaining("destination arm") });
  });

  it("refuses bulk RETAIN without a destination arm", async () => {
    const result = await bulkUpdatePromotionRunItemsAction({
      runId: "clh0000000000000000000099",
      itemIds: ["clh0000000000000000000001"],
      outcome: "RETAIN",
    });
    expect(result).toMatchObject({ error: expect.stringContaining("destination arm") });
  });
});

describe("deletePromotionRunAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("deletes a DRAFT run", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({ id: "pr-1", status: "DRAFT", schoolId: "default-school" } as never);
    prismaMock.promotionRun.delete.mockResolvedValue({ id: "pr-1" } as never);

    const result = await deletePromotionRunAction("pr-1");
    expect(result).toEqual({ data: { deleted: true } });
  });

  it("refuses to delete a COMMITTED run", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({ id: "pr-1", status: "COMMITTED", schoolId: "default-school" } as never);
    const result = await deletePromotionRunAction("pr-1");
    expect(result).toEqual({ error: "Only DRAFT runs can be deleted" });
  });
});

describe("commitPromotionRunAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("refuses to commit a non-DRAFT run", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({ id: "pr-1", status: "COMMITTED", schoolId: "default-school", items: [] } as never);
    const result = await commitPromotionRunAction("pr-1");
    expect(result).toEqual({ error: "Run is not in DRAFT status" });
  });

  it("handles PROMOTE: marks old enrollment PROMOTED and creates new one", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "DRAFT", schoolId: "default-school",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2", sourceClassArmId: "ca-1",
      items: [{
        id: "pri-1", studentId: "s-1", outcome: "PROMOTE", destinationClassArmId: "ca-2",
        previousEnrollmentId: "e-1", previousStatus: "ACTIVE",
      }],
    } as never);
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "e-1", isFreeShsPlacement: true, classArmId: "ca-1", status: "ACTIVE" } as never);
    prismaMock.enrollment.create.mockResolvedValue({ id: "e-new" } as never);
    prismaMock.promotionRunItem.update.mockResolvedValue({} as never);
    prismaMock.promotionRun.update.mockResolvedValue({ id: "pr-1", status: "COMMITTED" } as never);

    const result = await commitPromotionRunAction("pr-1");
    expect(result).toMatchObject({ data: { status: "COMMITTED" } });
    expect(prismaMock.enrollment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "e-1" }, data: expect.objectContaining({ status: "PROMOTED" }),
    }));
    expect(prismaMock.enrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: "s-1", classArmId: "ca-2", academicYearId: "ay-2",
        isFreeShsPlacement: true, previousClassArmId: "ca-1",
      }),
    }));
  });

  it("handles GRADUATE: sets student GRADUATED and vacates beds", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "DRAFT", schoolId: "default-school",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2", sourceClassArmId: "ca-3",
      items: [{ id: "pri-3", studentId: "s-3", outcome: "GRADUATE", destinationClassArmId: null,
        previousEnrollmentId: "e-3", previousStatus: "ACTIVE" }],
    } as never);
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "e-3", isFreeShsPlacement: false, classArmId: "ca-3", status: "ACTIVE" } as never);
    prismaMock.promotionRun.update.mockResolvedValue({ id: "pr-1", status: "COMMITTED" } as never);

    await commitPromotionRunAction("pr-1");
    expect(prismaMock.enrollment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "e-3" }, data: expect.objectContaining({ status: "COMPLETED" }),
    }));
    expect(prismaMock.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "s-3" }, data: expect.objectContaining({ status: "GRADUATED" }),
    }));
    expect(prismaMock.bedAllocation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: "s-3", vacatedAt: null },
    }));
  });

  it("handles WITHDRAW: sets student WITHDRAWN and vacates beds", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "DRAFT", schoolId: "default-school",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2", sourceClassArmId: "ca-1",
      items: [{ id: "pri-w", studentId: "s-w", outcome: "WITHDRAW", destinationClassArmId: null,
        previousEnrollmentId: "e-w", previousStatus: "ACTIVE" }],
    } as never);
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "e-w", isFreeShsPlacement: false, classArmId: "ca-1", status: "ACTIVE" } as never);
    prismaMock.promotionRun.update.mockResolvedValue({ id: "pr-1", status: "COMMITTED" } as never);

    await commitPromotionRunAction("pr-1");
    expect(prismaMock.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "s-w" }, data: expect.objectContaining({ status: "WITHDRAWN" }),
    }));
  });

  it("refuses to commit when a PROMOTE item has no destination arm", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "DRAFT", schoolId: "default-school",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2", sourceClassArmId: "ca-1",
      items: [{
        id: "pri-1", studentId: "s-1", outcome: "PROMOTE", destinationClassArmId: null,
        previousEnrollmentId: "e-1", previousStatus: "ACTIVE",
      }],
    } as never);

    const result = await commitPromotionRunAction("pr-1");
    expect(result).toMatchObject({ error: expect.stringContaining("no destination arm") });
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });

  it("skips items whose previous enrollment is no longer ACTIVE", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", status: "DRAFT", schoolId: "default-school",
      sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2", sourceClassArmId: "ca-1",
      items: [{ id: "pri-1", studentId: "s-1", outcome: "PROMOTE", destinationClassArmId: "ca-2",
        previousEnrollmentId: "e-1", previousStatus: "ACTIVE" }],
    } as never);
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "e-1", isFreeShsPlacement: false, classArmId: "ca-1", status: "WITHDRAWN" } as never);
    prismaMock.promotionRunItem.update.mockResolvedValue({} as never);
    prismaMock.promotionRun.update.mockResolvedValue({ id: "pr-1", status: "COMMITTED" } as never);

    const result = await commitPromotionRunAction("pr-1");
    expect(result).toMatchObject({
      data: { status: "COMMITTED", skipped: 1, skippedStudentIds: ["s-1"] },
    });
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
    // Drift-guarded item should be marked with a commit-time skippedAt.
    expect(prismaMock.promotionRunItem.update).toHaveBeenCalledWith({
      where: { id: "pri-1" },
      data: { skippedAt: expect.any(Date) },
    });
  });
});

import { revertPromotionRunAction } from "@/modules/student/actions/promotion.action";

describe("revertPromotionRunAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("refuses to revert outside the 14-day grace window", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 15);
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "clh0000000000000000000001", status: "COMMITTED", schoolId: "default-school", committedAt: oldDate, items: [],
    } as never);

    const result = await revertPromotionRunAction({ runId: "clh0000000000000000000001", reason: "mistake made" });
    expect(result).toEqual({ error: "Revert window has expired (14 days)" });
  });

  it("deletes new enrollments and restores previous state", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "clh0000000000000000000001", status: "COMMITTED", schoolId: "default-school", committedAt: new Date(),
      items: [
        { id: "pri-1", studentId: "s-1", outcome: "PROMOTE",
          previousEnrollmentId: "e-1", previousStatus: "ACTIVE", newEnrollmentId: "e-new" },
        { id: "pri-2", studentId: "s-2", outcome: "GRADUATE",
          previousEnrollmentId: "e-2", previousStatus: "ACTIVE", newEnrollmentId: null },
      ],
    } as never);
    prismaMock.promotionRun.update.mockResolvedValue({ id: "clh0000000000000000000001", status: "REVERTED" } as never);

    const result = await revertPromotionRunAction({ runId: "clh0000000000000000000001", reason: "wrong class selection" });

    expect(result).toMatchObject({ data: { status: "REVERTED" } });
    expect(prismaMock.enrollment.delete).toHaveBeenCalledWith({ where: { id: "e-new" } });
    expect(prismaMock.enrollment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "e-1" }, data: expect.objectContaining({ status: "ACTIVE" }),
    }));
    expect(prismaMock.student.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "s-2" }, data: expect.objectContaining({ status: "ACTIVE" }),
    }));
    // Revert restores pre-commit state — any drift-guard skippedAt is cleared.
    expect(prismaMock.promotionRunItem.update).toHaveBeenCalledWith({
      where: { id: "pri-1" },
      data: { skippedAt: null },
    });
    expect(prismaMock.promotionRunItem.update).toHaveBeenCalledWith({
      where: { id: "pri-2" },
      data: { skippedAt: null },
    });
  });

  it("refuses to revert a DRAFT or already-REVERTED run", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "clh0000000000000000000001", status: "DRAFT", schoolId: "default-school", committedAt: null, items: [],
    } as never);

    const result = await revertPromotionRunAction({ runId: "clh0000000000000000000001", reason: "oops oops" });
    expect(result).toEqual({ error: "Only COMMITTED runs can be reverted" });
  });

  it("aborts revert when a non-P2025 error occurs deleting a new enrollment", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "clh0000000000000000000001", status: "COMMITTED", schoolId: "default-school", committedAt: new Date(),
      items: [
        { id: "pri-1", studentId: "s-1", outcome: "PROMOTE",
          previousEnrollmentId: "e-1", previousStatus: "ACTIVE", newEnrollmentId: "e-new" },
      ],
    } as never);
    const fkError = Object.assign(new Error("FK violation"), { code: "P2003" });
    prismaMock.enrollment.delete.mockRejectedValue(fkError);

    await expect(
      revertPromotionRunAction({ runId: "clh0000000000000000000001", reason: "rollback attempt" })
    ).rejects.toThrow();
  });

  it("tolerates P2025 (already gone) and continues the revert", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => await fn(prismaMock));
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "clh0000000000000000000001", status: "COMMITTED", schoolId: "default-school", committedAt: new Date(),
      items: [
        { id: "pri-1", studentId: "s-1", outcome: "PROMOTE",
          previousEnrollmentId: "e-1", previousStatus: "ACTIVE", newEnrollmentId: "e-new" },
      ],
    } as never);
    const notFound = Object.assign(new Error("not found"), { code: "P2025" });
    prismaMock.enrollment.delete.mockRejectedValue(notFound);
    prismaMock.promotionRun.update.mockResolvedValue({ id: "clh0000000000000000000001", status: "REVERTED" } as never);

    const result = await revertPromotionRunAction({ runId: "clh0000000000000000000001", reason: "already cleaned up" });
    expect(result).toMatchObject({ data: { status: "REVERTED" } });
  });
});

describe("getTargetArmsForRunAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns arms for source and next yearGroup when source is non-final", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", schoolId: "default-school", targetAcademicYearId: "ay-2",
      sourceClassArm: { class: { programmeId: "prg-sci", yearGroup: 1 } },
    } as never);
    prismaMock.classArm.findMany.mockResolvedValue([
      { id: "ca-1a", name: "A", class: { id: "cl-1", name: "SHS 1 Sci", yearGroup: 1 } },
      { id: "ca-2a", name: "A", class: { id: "cl-2", name: "SHS 2 Sci", yearGroup: 2 } },
      { id: "ca-2b", name: "B", class: { id: "cl-2", name: "SHS 2 Sci", yearGroup: 2 } },
    ] as never);

    const result = await getTargetArmsForRunAction("pr-1");
    expect(result).toEqual({ data: expect.arrayContaining([
      expect.objectContaining({ id: "ca-1a" }),
      expect.objectContaining({ id: "ca-2a" }),
      expect.objectContaining({ id: "ca-2b" }),
    ]) });
    // Confirm the where clause filtered to both year groups
    expect(prismaMock.classArm.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        class: expect.objectContaining({
          yearGroup: { in: [1, 2] },
        }),
      }),
    }));
  });

  it("returns only source yearGroup when source is final year (sourceYearGroup=3)", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue({
      id: "pr-1", schoolId: "default-school", targetAcademicYearId: "ay-2",
      sourceClassArm: { class: { programmeId: "prg-sci", yearGroup: 3 } },
    } as never);
    prismaMock.classArm.findMany.mockResolvedValue([] as never);

    await getTargetArmsForRunAction("pr-1");
    expect(prismaMock.classArm.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        class: expect.objectContaining({
          yearGroup: { in: [3] },
        }),
      }),
    }));
  });

  it("returns error when run not found", async () => {
    prismaMock.promotionRun.findFirst.mockResolvedValue(null);
    const result = await getTargetArmsForRunAction("pr-missing");
    expect(result).toEqual({ error: "Run not found" });
  });
});
