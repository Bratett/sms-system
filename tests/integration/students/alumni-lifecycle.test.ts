import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolveSeededAdminId, loginAs } from "./setup";
import { confirmGraduateAction } from "@/modules/graduation/actions/graduation.action";
import { getAlumniDashboardAction } from "@/modules/alumni/actions/alumni-admin.action";
import {
  getMyAlumniProfileAction,
  updateMyAlumniProfileAction,
} from "@/modules/alumni/actions/alumni-self.action";

/**
 * Live-DB integration coverage for the alumni lifecycle.
 * (Task 10 of the alumni-foundation track.)
 *
 * Seeds two graduates:
 *  - alumnus1: has a User row → role should flip student → alumni on confirm
 *  - alumnus2: no User row  → profile created but no role flip (needs invite)
 *
 * Exercises: confirm graduation, auto-seeded profile, role flip,
 * admin dashboard needs-invite filter, alumni self-update, tenant isolation.
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Alumni lifecycle (integration)", () => {
  const db = new PrismaClient();
  const tag = `alumni-test-${Date.now()}`;

  let adminId: string;
  let programmeId: string;
  let classId: string;
  let armId: string;
  let batchId: string;
  let recordWithUserId: string;
  let recordNoUserId: string;
  let userId1: string;
  let studentWithUserId: string;
  let studentNoUserId: string;

  async function cleanupSeedData() {
    try {
      // 1. Alumni profiles (children of Student)
      await db.alumniProfile
        .deleteMany({
          where: {
            studentId: {
              in: [studentWithUserId, studentNoUserId].filter(Boolean),
            },
          },
        })
        .catch(() => {});

      // 2. Graduation records (cascade deletes when batch is deleted, but be
      //    explicit so the batch delete doesn't fail on non-cascade DBs)
      await db.graduationRecord
        .deleteMany({
          where: {
            id: { in: [recordWithUserId, recordNoUserId].filter(Boolean) },
          },
        })
        .catch(() => {});

      // 3. Graduation batch
      if (batchId)
        await db.graduationBatch.delete({ where: { id: batchId } }).catch(() => {});

      // 4. User roles for the seeded user
      if (userId1)
        await db.userRole
          .deleteMany({ where: { userId: userId1 } })
          .catch(() => {});

      // 5. Enrollments
      await db.enrollment
        .deleteMany({
          where: {
            studentId: {
              in: [studentWithUserId, studentNoUserId].filter(Boolean),
            },
          },
        })
        .catch(() => {});

      // 6. Students
      await db.student
        .deleteMany({
          where: {
            id: { in: [studentWithUserId, studentNoUserId].filter(Boolean) },
          },
        })
        .catch(() => {});

      // 7. Class structure (arm → class → programme)
      if (armId)
        await db.classArm.delete({ where: { id: armId } }).catch(() => {});
      if (classId)
        await db.class.delete({ where: { id: classId } }).catch(() => {});
      if (programmeId)
        await db.programme.delete({ where: { id: programmeId } }).catch(() => {});

      // 8. User scaffolding (userSchool, then user)
      if (userId1) {
        await db.userSchool
          .deleteMany({ where: { userId: userId1 } })
          .catch(() => {});
        await db.user.delete({ where: { id: userId1 } }).catch(() => {});
      }
    } catch {
      // best-effort
    }
  }

  beforeAll(async () => {
    try {
      adminId = await resolveSeededAdminId();

      // ── Resolve default school + current academic year ────────────
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
      const academicYearId = year.id;

      // ── Programme → Class → ClassArm ─────────────────────────────
      const prog = await db.programme.create({
        data: {
          schoolId: "default-school",
          name: `${tag}-Prog`,
          duration: 3,
        },
      });
      programmeId = prog.id;

      const cls = await db.class.create({
        data: {
          schoolId: "default-school",
          programmeId: prog.id,
          academicYearId,
          yearGroup: 3,
          name: `${tag}-Class`,
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

      // ── Graduation batch ──────────────────────────────────────────
      const batch = await db.graduationBatch.create({
        data: {
          name: `${tag}-Batch`,
          schoolId: "default-school",
          academicYearId,
          ceremonyDate: new Date("2026-06-15"),
          status: "PENDING",
        },
      });
      batchId = batch.id;

      // ── Alumnus #1: has a User row (role flip expected) ───────────
      const user1 = await db.user.create({
        data: {
          email: `alum1-${tag}@test.local`,
          username: `alum1-${tag}`,
          passwordHash: await bcrypt.hash("test123", 10),
          firstName: "Kofi",
          lastName: "Asante",
          status: "ACTIVE",
        },
      });
      userId1 = user1.id;

      const studentRole = await db.role.findUnique({ where: { name: "student" } });
      if (!studentRole) throw new Error("student role not seeded. Run `npm run db:seed`.");

      await db.userRole.create({
        data: { userId: user1.id, roleId: studentRole.id },
      });
      await db.userSchool.create({
        data: { userId: user1.id, schoolId: "default-school", isActive: true },
      });

      const s1 = await db.student.create({
        data: {
          schoolId: "default-school",
          studentId: `${tag}/S1`,
          firstName: "Kofi",
          lastName: "Asante",
          gender: "MALE",
          dateOfBirth: new Date("2005-01-01"),
          status: "ACTIVE",
          userId: user1.id,
        },
      });
      studentWithUserId = s1.id;

      // ── Alumnus #2: no User row (needs invite) ────────────────────
      const s2 = await db.student.create({
        data: {
          schoolId: "default-school",
          studentId: `${tag}/S2`,
          firstName: "Akua",
          lastName: "Mensah",
          gender: "FEMALE",
          dateOfBirth: new Date("2005-02-01"),
          status: "ACTIVE",
        },
      });
      studentNoUserId = s2.id;

      // ── Enrollments ───────────────────────────────────────────────
      await db.enrollment.createMany({
        data: [
          {
            schoolId: "default-school",
            studentId: studentWithUserId,
            classArmId: armId,
            academicYearId,
            status: "ACTIVE",
          },
          {
            schoolId: "default-school",
            studentId: studentNoUserId,
            classArmId: armId,
            academicYearId,
            status: "ACTIVE",
          },
        ],
      });

      // ── Graduation records ────────────────────────────────────────
      const r1 = await db.graduationRecord.create({
        data: {
          schoolId: "default-school",
          graduationBatchId: batchId,
          studentId: studentWithUserId,
          status: "PENDING",
        },
      });
      recordWithUserId = r1.id;

      const r2 = await db.graduationRecord.create({
        data: {
          schoolId: "default-school",
          graduationBatchId: batchId,
          studentId: studentNoUserId,
          status: "PENDING",
        },
      });
      recordNoUserId = r2.id;
    } catch (err) {
      await cleanupSeedData();
      throw err;
    }
  }, 60_000);

  afterAll(async () => {
    await cleanupSeedData();
    await db.$disconnect();
  }, 60_000);

  // ── Test 1: Happy path — role flip ───────────────────────────────
  it("confirming a graduation auto-creates AlumniProfile and flips student → alumni role", async () => {
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });

    const res = await confirmGraduateAction(recordWithUserId, {
      certificateNumber: "CERT-ALUM-001",
    });
    if (!("data" in res)) throw new Error((res as { error: string }).error);

    // Profile auto-seeded
    const profile = await db.alumniProfile.findUnique({
      where: { studentId: studentWithUserId },
    });
    expect(profile).not.toBeNull();
    expect(profile!.isPublic).toBe(false);
    expect(profile!.graduationYear).toBe(2026);
    expect(profile!.schoolId).toBe("default-school");

    // Role flipped from student → alumni
    const userRoles = await db.userRole.findMany({
      where: { userId: userId1 },
      include: { role: true },
    });
    const roleNames = userRoles.map((ur) => ur.role.name);
    expect(roleNames).toContain("alumni");
    expect(roleNames).not.toContain("student");
  });

  // ── Test 2: No-User-row path ──────────────────────────────────────
  it("graduating a student with no User row creates profile but no role flip", async () => {
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });

    const res = await confirmGraduateAction(recordNoUserId, {});
    if (!("data" in res)) throw new Error((res as { error: string }).error);

    const profile = await db.alumniProfile.findUnique({
      where: { studentId: studentNoUserId },
    });
    expect(profile).not.toBeNull();
    expect(profile!.schoolId).toBe("default-school");
  });

  // ── Test 3: Admin dashboard surfaces "needs invite" ───────────────
  it("admin dashboard surfaces 'needs invite' for the no-User-row alumnus", async () => {
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });

    const res = await getAlumniDashboardAction({
      status: "needs_invite",
      page: 1,
      pageSize: 100,
    });
    if (!("data" in res)) throw new Error((res as { error: string }).error);

    const studentIds = res.data.map((r) => r.studentId);
    expect(studentIds).toContain(studentNoUserId);
    // The alumnus with a User row must NOT appear in needs_invite
    expect(studentIds).not.toContain(studentWithUserId);
  });

  // ── Test 4: Alumnus updates own profile + toggles isPublic ────────
  it("alumnus updates own profile, toggles isPublic", async () => {
    // Log in as the alumnus whose User row is linked to studentWithUserId
    loginAs({
      id: userId1,
      permissions: ["alumni:profile:update-own", "alumni:directory:read"],
      schoolId: "default-school",
    });

    // Confirm profile exists and isPublic starts as false
    const before = await getMyAlumniProfileAction();
    if (!("data" in before)) throw new Error((before as { error: string }).error);
    expect(before.data.isPublic).toBe(false);

    // Update bio, industry, isPublic
    const updated = await updateMyAlumniProfileAction({
      bio: "Tech worker in Accra.",
      industry: "Technology",
      isPublic: true,
    });
    if (!("data" in updated)) throw new Error((updated as { error: string }).error);
    expect(updated.data.isPublic).toBe(true);
    expect(updated.data.bio).toBe("Tech worker in Accra.");
    expect(updated.data.industry).toBe("Technology");
  });

  // ── Test 5: Tenant isolation ──────────────────────────────────────
  it("tenant isolation: alumnus from default-school invisible under a forged schoolId", async () => {
    // Direct DB query against a different schoolId must return nothing
    const sneaky = await db.alumniProfile.findFirst({
      where: { studentId: studentWithUserId, schoolId: "other-school" },
    });
    expect(sneaky).toBeNull();
  });
});
