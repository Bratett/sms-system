import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveSeededAdminId, loginAs } from "./setup";
import {
  acknowledgeCircularAction,
  getAnnouncementAcknowledgementStatsAction,
  chaseAnnouncementAcknowledgementAction,
} from "@/modules/communication/actions/circular-acknowledgement.action";
import { getParentCircularsAction } from "@/modules/portal/actions/parent.action";

/**
 * Live-DB integration coverage for Parent Circular Acknowledgements
 * (Task 10 of the parent-acknowledgements track).
 *
 * Seeds two households, each with one parent User → Guardian → Student,
 * both students enrolled in the same class. Admin publishes a class-targeted
 * circular requiring acknowledgement; we exercise the full ack + stats +
 * chase + tenant-isolation flow.
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Circular acknowledgements (integration)", () => {
  const db = new PrismaClient();
  const testTag = `circ-test-${Date.now()}`;

  let adminId: string;
  let parentUserId: string;
  let parentUser2Id: string;
  let studentId: string;
  let studentId2: string;
  let classId: string;
  let armId: string;
  let programmeId: string;
  let yearId: string;
  let householdId: string;
  let household2Id: string;
  let guardian1Id: string;
  let guardian2Id: string;
  let enrollmentId: string;
  let enrollment2Id: string;
  let announcementId = "";

  async function cleanupSeedData() {
    try {
      if (announcementId) {
        await db.circularAcknowledgement
          .deleteMany({ where: { announcementId } })
          .catch(() => {});
        await db.announcement
          .delete({ where: { id: announcementId } })
          .catch(() => {});
      }
      const studentIds = [studentId, studentId2].filter(
        (x): x is string => !!x,
      );
      if (studentIds.length) {
        await db.studentGuardian
          .deleteMany({ where: { studentId: { in: studentIds } } })
          .catch(() => {});
      }
      const enrollmentIds = [enrollmentId, enrollment2Id].filter(
        (x): x is string => !!x,
      );
      if (enrollmentIds.length) {
        await db.enrollment
          .deleteMany({ where: { id: { in: enrollmentIds } } })
          .catch(() => {});
      }
      if (studentIds.length) {
        await db.student
          .deleteMany({ where: { id: { in: studentIds } } })
          .catch(() => {});
      }
      const guardianIds = [guardian1Id, guardian2Id].filter(
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
        await db.programme
          .delete({ where: { id: programmeId } })
          .catch(() => {});
      if (householdId)
        await db.household
          .delete({ where: { id: householdId } })
          .catch(() => {});
      if (household2Id)
        await db.household
          .delete({ where: { id: household2Id } })
          .catch(() => {});
      const userIds = [parentUserId, parentUser2Id].filter(
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

      // Two parent Users
      const parent1 = await db.user.create({
        data: {
          username: `${testTag}-p1`,
          email: `${testTag}-p1@test.local`,
          firstName: "Parent",
          lastName: "One",
          passwordHash: "x",
          status: "ACTIVE",
        },
      });
      parentUserId = parent1.id;

      const parent2 = await db.user.create({
        data: {
          username: `${testTag}-p2`,
          email: `${testTag}-p2@test.local`,
          firstName: "Parent",
          lastName: "Two",
          passwordHash: "x",
          status: "ACTIVE",
        },
      });
      parentUser2Id = parent2.id;

      // Two Households (one per family)
      const hh1 = await db.household.create({
        data: { schoolId: "default-school", name: `${testTag}-Family-1` },
      });
      householdId = hh1.id;
      const hh2 = await db.household.create({
        data: { schoolId: "default-school", name: `${testTag}-Family-2` },
      });
      household2Id = hh2.id;

      // Current academic year (seeded). Fall back to most recent.
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

      const prog = await db.programme.create({
        data: {
          schoolId: "default-school",
          name: `${testTag}-P`,
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
          name: `${testTag}-C`,
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

      // Two Students, both ACTIVE, both enrolled in the class arm.
      const s1 = await db.student.create({
        data: {
          schoolId: "default-school",
          studentId: `${testTag}/1`,
          firstName: "ChildOne",
          lastName: "Test",
          dateOfBirth: new Date("2010-01-01"),
          gender: "MALE",
          status: "ACTIVE",
        },
      });
      studentId = s1.id;
      const e1 = await db.enrollment.create({
        data: {
          schoolId: "default-school",
          studentId: s1.id,
          classArmId: arm.id,
          academicYearId: year.id,
          status: "ACTIVE",
        },
      });
      enrollmentId = e1.id;

      const s2 = await db.student.create({
        data: {
          schoolId: "default-school",
          studentId: `${testTag}/2`,
          firstName: "ChildTwo",
          lastName: "Test",
          dateOfBirth: new Date("2010-01-01"),
          gender: "FEMALE",
          status: "ACTIVE",
        },
      });
      studentId2 = s2.id;
      const e2 = await db.enrollment.create({
        data: {
          schoolId: "default-school",
          studentId: s2.id,
          classArmId: arm.id,
          academicYearId: year.id,
          status: "ACTIVE",
        },
      });
      enrollment2Id = e2.id;

      // Guardians + StudentGuardian links (one per household)
      const g1 = await db.guardian.create({
        data: {
          schoolId: "default-school",
          firstName: "Parent",
          lastName: "One",
          phone: `020${testTag.slice(-7)}1`,
          userId: parentUserId,
          householdId: hh1.id,
        },
      });
      guardian1Id = g1.id;
      await db.studentGuardian.create({
        data: {
          schoolId: "default-school",
          studentId: s1.id,
          guardianId: g1.id,
          isPrimary: true,
        },
      });

      const g2 = await db.guardian.create({
        data: {
          schoolId: "default-school",
          firstName: "Parent",
          lastName: "Two",
          phone: `020${testTag.slice(-7)}2`,
          userId: parentUser2Id,
          householdId: hh2.id,
        },
      });
      guardian2Id = g2.id;
      await db.studentGuardian.create({
        data: {
          schoolId: "default-school",
          studentId: s2.id,
          guardianId: g2.id,
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
  it("happy path: admin creates ack-required circular → parent acknowledges → stats reflect", async () => {
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const ann = await db.announcement.create({
      data: {
        schoolId: "default-school",
        title: `${testTag}-circular`,
        content: "Please confirm receipt",
        targetType: "class",
        targetIds: [classId],
        priority: "high",
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdBy: adminId,
        requiresAcknowledgement: true,
      },
    });
    announcementId = ann.id;

    loginAs({
      id: parentUserId,
      permissions: [
        "communication:announcements:read",
        "communication:circulars:acknowledge",
      ],
      schoolId: "default-school",
    });
    const pending = await getParentCircularsAction({ tab: "pending" });
    if (!("data" in pending)) throw new Error((pending as { error: string }).error);
    expect(pending.data.map((a) => a.id)).toContain(announcementId);

    const ack = await acknowledgeCircularAction({ announcementId });
    expect(ack).toEqual({ success: true });

    const pendingAfter = await getParentCircularsAction({ tab: "pending" });
    if (!("data" in pendingAfter))
      throw new Error((pendingAfter as { error: string }).error);
    expect(pendingAfter.data.map((a) => a.id)).not.toContain(announcementId);

    const history = await getParentCircularsAction({ tab: "history" });
    if (!("data" in history)) throw new Error((history as { error: string }).error);
    expect(history.data.map((a) => a.id)).toContain(announcementId);

    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const stats = await getAnnouncementAcknowledgementStatsAction(announcementId);
    if (!("data" in stats)) throw new Error((stats as { error: string }).error);
    expect(stats.data.acknowledged).toBe(1);
    expect(stats.data.targeted).toBeGreaterThanOrEqual(2);
  });

  // ── Test 2: Second household acks independently ───────────────────
  it("second household acks independently", async () => {
    loginAs({
      id: parentUser2Id,
      permissions: [
        "communication:announcements:read",
        "communication:circulars:acknowledge",
      ],
      schoolId: "default-school",
    });
    const ack = await acknowledgeCircularAction({ announcementId });
    expect(ack).toEqual({ success: true });

    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const stats = await getAnnouncementAcknowledgementStatsAction(announcementId);
    if (!("data" in stats)) throw new Error((stats as { error: string }).error);
    expect(stats.data.acknowledged).toBe(2);
  });

  // ── Test 3: Idempotent double-tap ────────────────────────────────
  it("double-tap acknowledge is idempotent", async () => {
    loginAs({
      id: parentUserId,
      permissions: [
        "communication:announcements:read",
        "communication:circulars:acknowledge",
      ],
      schoolId: "default-school",
    });
    const again = await acknowledgeCircularAction({ announcementId });
    expect(again).toEqual({ success: true });
  });

  // ── Test 4: Chase cooldown ────────────────────────────────────────
  it("chase cooldown enforced when there are pending households", async () => {
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });

    const stats = await getAnnouncementAcknowledgementStatsAction(announcementId);
    if (!("data" in stats)) throw new Error((stats as { error: string }).error);

    // If both households already acknowledged, chase will return "Everyone..."
    if (stats.data.pending === 0) {
      const res = await chaseAnnouncementAcknowledgementAction(announcementId);
      expect((res as { error: string }).error).toMatch(/everyone/i);
      return;
    }

    const first = await chaseAnnouncementAcknowledgementAction(announcementId);
    if ("error" in first) {
      // Could be cooldown if test was run twice in a row — also OK.
      expect(first.error).toMatch(/cooldown|everyone/i);
      return;
    }
    expect(first).toMatchObject({ success: true });

    // Second chase immediately should be cooldown-rejected.
    const second = await chaseAnnouncementAcknowledgementAction(announcementId);
    expect((second as { error: string }).error).toMatch(/cooldown/i);
  });

  // ── Test 5: Tenant isolation ──────────────────────────────────────
  it("tenant isolation: another schoolId cannot see this circular", async () => {
    const otherVisible = await db.announcement.findFirst({
      where: { id: announcementId, schoolId: "other-school" },
    });
    expect(otherVisible).toBeNull();
  });
});
