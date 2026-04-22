import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createPromotionRunAction,
  seedPromotionRunItemsAction,
  updatePromotionRunItemAction,
  commitPromotionRunAction,
  revertPromotionRunAction,
} from "@/modules/student/actions/promotion.action";
import { loginAs, resolveSeededAdminId } from "./setup";

/**
 * Full-lifecycle integration test for the Student Promotion Wizard.
 *
 * Exercises: createPromotionRunAction → seedPromotionRunItemsAction →
 *            updatePromotionRunItemAction → commitPromotionRunAction →
 *            revertPromotionRunAction
 *
 * Seeds a minimal world (programme, 2 academic years, 2 classes, 3 arms,
 * 3 students with active enrollments in the source arm). Overrides one
 * item's destination arm to exercise the update path. After commit, asserts
 * 3 new target-year enrollments exist and the old ones are PROMOTED. After
 * revert, asserts new enrollments are gone and old ones are back to ACTIVE.
 *
 * Skips cleanly when DATABASE_URL is not configured or the seeded
 * `default-school` is absent.
 */

const SCHOOL_ID = "default-school";
const hasDbUrl = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDbUrl ? describe : describe.skip;

const db = new PrismaClient();

// Unique suffix so repeated runs don't collide on unique constraints
// (Programme name, Class name, AcademicYear name, Student studentId).
const TAG = `promotion-test-${Date.now()}`;

const created = {
  runIds: [] as string[],
  enrollmentIds: [] as string[], // source-year enrollments we seeded
  studentIds: [] as string[],
  classArmIds: [] as string[],
  classIds: [] as string[],
  programmeId: null as string | null,
  targetAcademicYearId: null as string | null,
};

describeIfDb("promotion lifecycle integration", () => {
  beforeAll(async () => {
    const school = await db.school.findUnique({ where: { id: SCHOOL_ID } });
    if (!school) throw new Error("Run: npm run db:seed");

    const adminId = await resolveSeededAdminId();
    loginAs({ id: adminId });

    // 1. Resolve current academic year in the seeded school.
    const currentYear = await db.academicYear.findFirst({
      where: { schoolId: SCHOOL_ID, isCurrent: true },
    });
    if (!currentYear) throw new Error("Seeded DB missing current academic year");

    // 2. Create (or reuse) a next academic year whose startDate is strictly
    //    greater than the current year's startDate — required by
    //    createPromotionRunAction's target-year lookup.
    const nextStartDate = new Date(currentYear.endDate.getTime() + 24 * 60 * 60 * 1000);
    const nextEndDate = new Date(nextStartDate.getTime() + 300 * 24 * 60 * 60 * 1000);
    const nextYear = await db.academicYear.create({
      data: {
        schoolId: SCHOOL_ID,
        name: `${TAG}-next`,
        startDate: nextStartDate,
        endDate: nextEndDate,
        status: "UPCOMING",
        isCurrent: false,
      },
    });
    created.targetAcademicYearId = nextYear.id;

    // 3. Dedicated test Programme (so target-class lookup is unambiguous).
    const programme = await db.programme.create({
      data: {
        schoolId: SCHOOL_ID,
        name: `${TAG}-programme`,
        duration: 3,
      },
    });
    created.programmeId = programme.id;

    // 4. Source class (SHS1, yearGroup=1) in current year with ClassArm "A".
    const sourceClass = await db.class.create({
      data: {
        schoolId: SCHOOL_ID,
        programmeId: programme.id,
        academicYearId: currentYear.id,
        yearGroup: 1,
        name: `${TAG}-SHS1`,
      },
    });
    created.classIds.push(sourceClass.id);

    const sourceArm = await db.classArm.create({
      data: {
        classId: sourceClass.id,
        schoolId: SCHOOL_ID,
        name: "A",
        capacity: 50,
      },
    });
    created.classArmIds.push(sourceArm.id);

    // 5. Target class (SHS2, yearGroup=2) in next year with ClassArms "A" and "B".
    //    seedPromotionRunItemsAction will default to the same-named arm ("A");
    //    we'll override one item to arm "B" to exercise the update path.
    const targetClass = await db.class.create({
      data: {
        schoolId: SCHOOL_ID,
        programmeId: programme.id,
        academicYearId: nextYear.id,
        yearGroup: 2,
        name: `${TAG}-SHS2`,
      },
    });
    created.classIds.push(targetClass.id);

    const targetArmA = await db.classArm.create({
      data: { classId: targetClass.id, schoolId: SCHOOL_ID, name: "A", capacity: 50 },
    });
    created.classArmIds.push(targetArmA.id);

    const targetArmB = await db.classArm.create({
      data: { classId: targetClass.id, schoolId: SCHOOL_ID, name: "B", capacity: 50 },
    });
    created.classArmIds.push(targetArmB.id);

    // 6. Three students enrolled ACTIVE in source arm of current year.
    for (let i = 0; i < 3; i++) {
      const student = await db.student.create({
        data: {
          schoolId: SCHOOL_ID,
          studentId: `${TAG}/S${i + 1}`,
          firstName: `PromoTest${i + 1}`,
          lastName: `Student-${TAG}`,
          dateOfBirth: new Date("2009-01-01"),
          gender: i % 2 === 0 ? "MALE" : "FEMALE",
          status: "ACTIVE",
        },
      });
      created.studentIds.push(student.id);

      const enrollment = await db.enrollment.create({
        data: {
          studentId: student.id,
          classArmId: sourceArm.id,
          schoolId: SCHOOL_ID,
          academicYearId: currentYear.id,
          status: "ACTIVE",
          isFreeShsPlacement: false,
        },
      });
      created.enrollmentIds.push(enrollment.id);
    }
  });

  afterAll(async () => {
    try {
      // Order: promotion items/runs → enrollments → students → arms → classes
      // → academic year → programme. Enrollments cascade via Student, but be
      // explicit for the new target-year enrollments the commit may have made.
      if (created.runIds.length > 0) {
        // PromotionRunItem cascades via PromotionRun.items onDelete: Cascade.
        await db.promotionRun.deleteMany({ where: { id: { in: created.runIds } } });
      }
      if (created.studentIds.length > 0) {
        await db.enrollment.deleteMany({
          where: { studentId: { in: created.studentIds } },
        });
        await db.student.deleteMany({ where: { id: { in: created.studentIds } } });
      }
      if (created.classArmIds.length > 0) {
        await db.classArm.deleteMany({ where: { id: { in: created.classArmIds } } });
      }
      if (created.classIds.length > 0) {
        await db.class.deleteMany({ where: { id: { in: created.classIds } } });
      }
      if (created.targetAcademicYearId) {
        await db.academicYear.deleteMany({ where: { id: created.targetAcademicYearId } });
      }
      if (created.programmeId) {
        await db.programme.deleteMany({ where: { id: created.programmeId } });
      }
    } finally {
      await db.$disconnect();
    }
  });

  it(
    "create → seed → update (override) → commit → revert round-trip",
    async () => {
      const sourceArmId = created.classArmIds[0];
      const targetArmBId = created.classArmIds[2]; // [A, B] of SHS2 target

      // ── 1. Create the DRAFT run ──────────────────────────────────────
      const createRes = await createPromotionRunAction({ sourceClassArmId: sourceArmId });
      expect("data" in createRes).toBe(true);
      const run = (createRes as { data: { id: string } }).data;
      created.runIds.push(run.id);

      const draftRow = await db.promotionRun.findUnique({ where: { id: run.id } });
      expect(draftRow).not.toBeNull();
      expect(draftRow!.status).toBe("DRAFT");
      expect(draftRow!.sourceClassArmId).toBe(sourceArmId);
      expect(draftRow!.targetAcademicYearId).toBe(created.targetAcademicYearId);

      // ── 2. Seed items from ACTIVE enrollments ────────────────────────
      const seedRes = await seedPromotionRunItemsAction(run.id);
      expect("data" in seedRes).toBe(true);
      expect((seedRes as { data: { seeded: number } }).data.seeded).toBe(3);

      const seededItems = await db.promotionRunItem.findMany({
        where: { runId: run.id },
        orderBy: { studentId: "asc" },
      });
      expect(seededItems).toHaveLength(3);
      // Non-final-year default: outcome=PROMOTE, destination=same-named arm "A"
      for (const item of seededItems) {
        expect(item.outcome).toBe("PROMOTE");
        expect(item.destinationClassArmId).toBe(created.classArmIds[1]); // target arm "A"
      }

      // ── 3. Override first item's destination to arm "B" ──────────────
      const overrideTarget = seededItems[0];
      const updateRes = await updatePromotionRunItemAction({
        itemId: overrideTarget.id,
        destinationClassArmId: targetArmBId,
        notes: "Moved to B for balanced cohort",
      });
      expect("data" in updateRes).toBe(true);

      const overridden = await db.promotionRunItem.findUnique({
        where: { id: overrideTarget.id },
      });
      expect(overridden!.destinationClassArmId).toBe(targetArmBId);
      expect(overridden!.notes).toBe("Moved to B for balanced cohort");

      // ── 4. Commit ────────────────────────────────────────────────────
      const commitRes = await commitPromotionRunAction(run.id);
      expect("data" in commitRes).toBe(true);
      expect((commitRes as { data: { counts: { PROMOTE: number } } }).data.counts.PROMOTE).toBe(3);

      const committedRun = await db.promotionRun.findUnique({ where: { id: run.id } });
      expect(committedRun!.status).toBe("COMMITTED");
      expect(committedRun!.committedAt).not.toBeNull();

      // Old source-year enrollments → PROMOTED
      const oldEnrollmentsAfterCommit = await db.enrollment.findMany({
        where: { id: { in: created.enrollmentIds } },
      });
      expect(oldEnrollmentsAfterCommit).toHaveLength(3);
      for (const e of oldEnrollmentsAfterCommit) {
        expect(e.status).toBe("PROMOTED");
      }

      // New target-year enrollments: 3 ACTIVE (2 in arm A, 1 in arm B)
      const newEnrollments = await db.enrollment.findMany({
        where: {
          studentId: { in: created.studentIds },
          academicYearId: created.targetAcademicYearId!,
        },
      });
      expect(newEnrollments).toHaveLength(3);
      for (const e of newEnrollments) {
        expect(e.status).toBe("ACTIVE");
      }
      const armBCount = newEnrollments.filter((e) => e.classArmId === targetArmBId).length;
      const armACount = newEnrollments.filter((e) => e.classArmId === created.classArmIds[1]).length;
      expect(armBCount).toBe(1);
      expect(armACount).toBe(2);

      // Each item got a newEnrollmentId wired up
      const committedItems = await db.promotionRunItem.findMany({ where: { runId: run.id } });
      for (const it of committedItems) {
        expect(it.newEnrollmentId).not.toBeNull();
      }

      // Students still ACTIVE (PROMOTE doesn't flip student status)
      const studentsAfterCommit = await db.student.findMany({
        where: { id: { in: created.studentIds } },
      });
      for (const s of studentsAfterCommit) {
        expect(s.status).toBe("ACTIVE");
      }

      // ── 5. Revert ────────────────────────────────────────────────────
      const revertRes = await revertPromotionRunAction({
        runId: run.id,
        reason: "Integration test teardown revert",
      });
      expect("data" in revertRes).toBe(true);

      const revertedRun = await db.promotionRun.findUnique({ where: { id: run.id } });
      expect(revertedRun!.status).toBe("REVERTED");
      expect(revertedRun!.revertedAt).not.toBeNull();
      expect(revertedRun!.revertReason).toBe("Integration test teardown revert");

      // Target-year enrollments removed
      const postRevertNew = await db.enrollment.findMany({
        where: {
          studentId: { in: created.studentIds },
          academicYearId: created.targetAcademicYearId!,
        },
      });
      expect(postRevertNew).toHaveLength(0);

      // Source-year enrollments restored to ACTIVE
      const postRevertOld = await db.enrollment.findMany({
        where: { id: { in: created.enrollmentIds } },
      });
      expect(postRevertOld).toHaveLength(3);
      for (const e of postRevertOld) {
        expect(e.status).toBe("ACTIVE");
      }

      // Student statuses restored to previousStatus (ACTIVE)
      const postRevertStudents = await db.student.findMany({
        where: { id: { in: created.studentIds } },
      });
      for (const s of postRevertStudents) {
        expect(s.status).toBe("ACTIVE");
      }
    },
    60_000,
  );
});
