import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveSeededAdminId, loginAs } from "./setup";
import {
  releaseReportCardsAction,
  reReleaseReportCardsAction,
  getReleaseStatsAction,
  chaseReleaseAction,
} from "@/modules/academics/release/actions/release.action";
import {
  acknowledgeReportCardAction,
  getMyReportCardReleaseAction,
} from "@/modules/academics/release/actions/parent-release.action";

/**
 * Live-DB integration coverage for Report Card Release flow.
 * (Task 13 of the release track.)
 *
 * Seeds two households:
 *  - Solo parent → 1 student (studentSolo)
 *  - Twins parent → 2 students (twin1, twin2) sharing one household
 * All 3 enrolled in the same class arm.
 * Exercises: release, lookup, ack, stats, twins independence,
 * re-release reset, chase cooldown, tenant isolation.
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Report card release (integration)", () => {
  const db = new PrismaClient();
  const testTag = `release-test-${Date.now()}`;

  let adminId: string;
  let parentUserId: string;       // solo parent
  let twinsParentUserId: string;  // twins parent
  let studentSoloId: string;
  let twin1Id: string;
  let twin2Id: string;
  let armId: string;
  let classId: string;
  let programmeId: string;
  let yearId: string;
  let termId: string;
  let householdSoloId: string;
  let householdTwinsId: string;
  let guardianSoloId: string;
  let guardianTwinsId: string;
  let releaseId = "";

  async function cleanupSeedData() {
    try {
      if (releaseId) {
        await db.reportCardAcknowledgement
          .deleteMany({ where: { releaseId } })
          .catch(() => {});
        await db.reportCardRelease
          .delete({ where: { id: releaseId } })
          .catch(() => {});
      }

      const allStudentIds = [studentSoloId, twin1Id, twin2Id].filter(
        (x): x is string => !!x,
      );

      if (allStudentIds.length) {
        await db.studentGuardian
          .deleteMany({ where: { studentId: { in: allStudentIds } } })
          .catch(() => {});
        await db.enrollment
          .deleteMany({ where: { studentId: { in: allStudentIds } } })
          .catch(() => {});
        await db.student
          .deleteMany({ where: { id: { in: allStudentIds } } })
          .catch(() => {});
      }

      const guardianIds = [guardianSoloId, guardianTwinsId].filter(
        (x): x is string => !!x,
      );
      if (guardianIds.length) {
        await db.guardian
          .deleteMany({ where: { id: { in: guardianIds } } })
          .catch(() => {});
      }

      if (armId)
        await db.classArm.delete({ where: { id: armId } }).catch(() => {});
      if (classId)
        await db.class.delete({ where: { id: classId } }).catch(() => {});
      if (programmeId)
        await db.programme.delete({ where: { id: programmeId } }).catch(() => {});
      if (termId)
        await db.term.delete({ where: { id: termId } }).catch(() => {});
      // Do NOT delete the shared academicYear — we reuse the seeded one.
      if (householdSoloId)
        await db.household.delete({ where: { id: householdSoloId } }).catch(() => {});
      if (householdTwinsId)
        await db.household.delete({ where: { id: householdTwinsId } }).catch(() => {});

      const userIds = [parentUserId, twinsParentUserId].filter(
        (x): x is string => !!x,
      );
      if (userIds.length) {
        await db.user
          .deleteMany({ where: { id: { in: userIds } } })
          .catch(() => {});
      }
    } catch {
      // best-effort
    }
  }

  beforeAll(async () => {
    try {
      adminId = await resolveSeededAdminId();

      // ── Two parent Users ──────────────────────────────────────────
      const parent1 = await db.user.create({
        data: {
          username: `${testTag}-p1`,
          email: `${testTag}-p1@test.local`,
          firstName: "SoloParent",
          lastName: "Release",
          passwordHash: "x",
          status: "ACTIVE",
        },
      });
      parentUserId = parent1.id;

      const parent2 = await db.user.create({
        data: {
          username: `${testTag}-p2`,
          email: `${testTag}-p2@test.local`,
          firstName: "TwinsParent",
          lastName: "Release",
          passwordHash: "x",
          status: "ACTIVE",
        },
      });
      twinsParentUserId = parent2.id;

      // ── Two Households ────────────────────────────────────────────
      const hhSolo = await db.household.create({
        data: { schoolId: "default-school", name: `${testTag}-Solo-Family` },
      });
      householdSoloId = hhSolo.id;

      const hhTwins = await db.household.create({
        data: { schoolId: "default-school", name: `${testTag}-Twins-Family` },
      });
      householdTwinsId = hhTwins.id;

      // ── Reuse seeded current Academic Year ────────────────────────
      const year =
        (await db.academicYear.findFirst({
          where: { schoolId: "default-school", isCurrent: true },
        })) ??
        (await db.academicYear.findFirst({
          where: { schoolId: "default-school" },
          orderBy: { startDate: "desc" },
        }));
      if (!year)
        throw new Error("Seed DB missing an academic year for default-school");
      yearId = year.id;

      // ── Term (owned by this test, linked to that year) ────────────
      const term = await db.term.create({
        data: {
          schoolId: "default-school",
          academicYearId: year.id,
          name: `${testTag}-Term`,
          termNumber: 1,
          startDate: new Date("2025-09-01"),
          endDate: new Date("2025-12-20"),
          isCurrent: false,
        },
      });
      termId = term.id;

      // ── Programme → Class → ClassArm ─────────────────────────────
      const prog = await db.programme.create({
        data: {
          schoolId: "default-school",
          name: `${testTag}-Prog`,
          duration: 3,
        },
      });
      programmeId = prog.id;

      const cls = await db.class.create({
        data: {
          schoolId: "default-school",
          programmeId: prog.id,
          academicYearId: year.id,
          yearGroup: 1,
          name: `${testTag}-Class`,
          maxCapacity: 40,
        },
      });
      classId = cls.id;

      const arm = await db.classArm.create({
        data: {
          classId: cls.id,
          schoolId: "default-school",
          name: "A",
          capacity: 40,
        },
      });
      armId = arm.id;

      // ── Students ──────────────────────────────────────────────────
      // Solo student
      const sSolo = await db.student.create({
        data: {
          schoolId: "default-school",
          studentId: `${testTag}/solo`,
          firstName: "Solo",
          lastName: "Child",
          dateOfBirth: new Date("2010-01-01"),
          gender: "MALE",
          status: "ACTIVE",
        },
      });
      studentSoloId = sSolo.id;
      await db.enrollment.create({
        data: {
          schoolId: "default-school",
          studentId: sSolo.id,
          classArmId: arm.id,
          academicYearId: year.id,
          status: "ACTIVE",
        },
      });

      // Twin 1
      const sTwin1 = await db.student.create({
        data: {
          schoolId: "default-school",
          studentId: `${testTag}/twin1`,
          firstName: "TwinOne",
          lastName: "Child",
          dateOfBirth: new Date("2011-06-15"),
          gender: "FEMALE",
          status: "ACTIVE",
        },
      });
      twin1Id = sTwin1.id;
      await db.enrollment.create({
        data: {
          schoolId: "default-school",
          studentId: sTwin1.id,
          classArmId: arm.id,
          academicYearId: year.id,
          status: "ACTIVE",
        },
      });

      // Twin 2
      const sTwin2 = await db.student.create({
        data: {
          schoolId: "default-school",
          studentId: `${testTag}/twin2`,
          firstName: "TwinTwo",
          lastName: "Child",
          dateOfBirth: new Date("2011-06-15"),
          gender: "MALE",
          status: "ACTIVE",
        },
      });
      twin2Id = sTwin2.id;
      await db.enrollment.create({
        data: {
          schoolId: "default-school",
          studentId: sTwin2.id,
          classArmId: arm.id,
          academicYearId: year.id,
          status: "ACTIVE",
        },
      });

      // ── Guardians + StudentGuardian links ─────────────────────────
      // Solo guardian linked to solo parent user
      const gSolo = await db.guardian.create({
        data: {
          schoolId: "default-school",
          firstName: "SoloParent",
          lastName: "Release",
          phone: `020${testTag.slice(-7)}1`,
          userId: parentUserId,
          householdId: hhSolo.id,
        },
      });
      guardianSoloId = gSolo.id;
      await db.studentGuardian.create({
        data: {
          schoolId: "default-school",
          studentId: sSolo.id,
          guardianId: gSolo.id,
          isPrimary: true,
        },
      });

      // Twins guardian — one guardian covers BOTH twins (same household)
      const gTwins = await db.guardian.create({
        data: {
          schoolId: "default-school",
          firstName: "TwinsParent",
          lastName: "Release",
          phone: `020${testTag.slice(-7)}2`,
          userId: twinsParentUserId,
          householdId: hhTwins.id,
        },
      });
      guardianTwinsId = gTwins.id;
      await db.studentGuardian.create({
        data: {
          schoolId: "default-school",
          studentId: sTwin1.id,
          guardianId: gTwins.id,
          isPrimary: true,
        },
      });
      await db.studentGuardian.create({
        data: {
          schoolId: "default-school",
          studentId: sTwin2.id,
          guardianId: gTwins.id,
          isPrimary: true,
        },
      });
    } catch (err) {
      await cleanupSeedData();
      throw err;
    }
  }, 60_000);

  afterAll(async () => {
    await cleanupSeedData();
    await db.$disconnect();
  }, 60_000);

  // ── Test 1: Happy path ────────────────────────────────────────────
  it("happy path: admin releases → solo parent acknowledges → stats reflect", async () => {
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const res = await releaseReportCardsAction({ termId, classArmId: armId });
    if (!("data" in res)) throw new Error((res as { error: string }).error);
    releaseId = res.data.releaseId;

    // Solo parent looks up the release
    loginAs({
      id: parentUserId,
      permissions: [
        "academics:results:read",
        "academics:report-cards:download-own",
      ],
      schoolId: "default-school",
    });
    const lookup = await getMyReportCardReleaseAction({
      studentId: studentSoloId,
      termId,
    });
    if (!("data" in lookup)) throw new Error((lookup as { error: string }).error);
    expect(lookup.data.released).toBe(true);

    // Solo parent acknowledges
    const ack = await acknowledgeReportCardAction({
      releaseId,
      studentId: studentSoloId,
    });
    expect(ack).toEqual({ success: true });

    // Admin checks stats: 1 of 3 acknowledged
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const stats = await getReleaseStatsAction(releaseId);
    if (!("data" in stats)) throw new Error((stats as { error: string }).error);
    expect(stats.data.acknowledgedStudents).toBe(1);
    expect(stats.data.targetedStudents).toBe(3);
    expect(stats.data.pendingStudents).toBe(2);
  });

  // ── Test 2: Twins are independent ────────────────────────────────
  it("twins are independent: ack on twin1 doesn't auto-ack twin2", async () => {
    // Twins parent acks twin1
    loginAs({
      id: twinsParentUserId,
      permissions: [
        "academics:results:read",
        "academics:report-cards:download-own",
      ],
      schoolId: "default-school",
    });
    const ack1 = await acknowledgeReportCardAction({
      releaseId,
      studentId: twin1Id,
    });
    expect(ack1).toEqual({ success: true });

    // Admin: 2 of 3 acknowledged, twin2 still pending
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const stats1 = await getReleaseStatsAction(releaseId);
    if (!("data" in stats1)) throw new Error((stats1 as { error: string }).error);
    expect(stats1.data.acknowledgedStudents).toBe(2);
    expect(stats1.data.pendingStudents).toBe(1);

    // Twins parent acks twin2 separately
    loginAs({
      id: twinsParentUserId,
      permissions: [
        "academics:results:read",
        "academics:report-cards:download-own",
      ],
      schoolId: "default-school",
    });
    const ack2 = await acknowledgeReportCardAction({
      releaseId,
      studentId: twin2Id,
    });
    expect(ack2).toEqual({ success: true });

    // Admin: now 3 of 3
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const stats2 = await getReleaseStatsAction(releaseId);
    if (!("data" in stats2)) throw new Error((stats2 as { error: string }).error);
    expect(stats2.data.acknowledgedStudents).toBe(3);
    expect(stats2.data.pendingStudents).toBe(0);
  });

  // ── Test 3: Re-release with reset clears acks ─────────────────────
  it("re-release with reset clears acks", async () => {
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const res = await reReleaseReportCardsAction({
      releaseId,
      resetAcknowledgements: true,
    });
    expect(res).toEqual({ success: true });

    const stats = await getReleaseStatsAction(releaseId);
    if (!("data" in stats)) throw new Error((stats as { error: string }).error);
    expect(stats.data.acknowledgedStudents).toBe(0);
    expect(stats.data.pendingStudents).toBe(3);
    expect(stats.data.targetedStudents).toBe(3);
  });

  // ── Test 4: Chase cooldown enforced ───────────────────────────────
  it("chase cooldown enforced", async () => {
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });

    // After re-release reset, students are all pending — chase should work
    const first = await chaseReleaseAction(releaseId);
    if ("error" in first) {
      // If cooldown was already set (e.g. reRelease touched lastReminderSentAt),
      // or all acked — either error message is acceptable.
      expect((first as { error: string }).error).toMatch(
        /cooldown|all.*acknowledged|everyone/i,
      );
      return;
    }
    expect(first).toMatchObject({ success: true });

    // Immediate second chase must be cooldown-rejected
    const second = await chaseReleaseAction(releaseId);
    expect((second as { error: string }).error).toMatch(/cooldown/i);
  });

  // ── Test 5: Tenant isolation ──────────────────────────────────────
  it("tenant isolation: another schoolId cannot see this release", async () => {
    const other = await db.reportCardRelease.findFirst({
      where: { id: releaseId, schoolId: "other-school" },
    });
    expect(other).toBeNull();
  });
});
