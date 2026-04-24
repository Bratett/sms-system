import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createMessageThreadAction,
  getMessageThreadAction,
  archiveThreadAction,
} from "@/modules/messaging/actions/thread.action";
import { postMessageAction } from "@/modules/messaging/actions/message.action";
import {
  lockThreadAction,
  unlockThreadAction,
} from "@/modules/messaging/actions/message-moderation.action";
import { resolveSeededAdminId, loginAs } from "./setup";

/**
 * Full-lifecycle integration test for the Parent ↔ Teacher Messaging feature.
 *
 * Seeds: parent user + teacher user + student + guardian (linked to parent user),
 *        and a programme/class/arm/enrollment so the student is "active".
 *
 * Validates:
 *   - Parent creates a thread; teacher can read it.
 *   - Teacher replies; parent sees reply.
 *   - Admin locks → post fails; admin unlocks → post succeeds.
 *   - Admin archives → post fails.
 *   - Tenant isolation: a session from another school cannot see the thread.
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Messaging (integration)", () => {
  const db = new PrismaClient();
  const testTag = `msg-test-${Date.now()}`;
  let adminId: string;
  let parentUserId: string;
  let teacherUserId: string;
  let studentId: string;
  let guardianId: string;
  let classId: string;
  let programmeId: string;
  let armId: string;
  let enrollmentId: string;
  let threadId: string | null = null;

  beforeAll(async () => {
    adminId = await resolveSeededAdminId();

    // Parent user (linked to guardian)
    const parent = await db.user.create({
      data: {
        email: `${testTag}-parent@test.local`,
        username: `${testTag}-parent`,
        firstName: "Test",
        lastName: "Parent",
        passwordHash: "x",
        status: "ACTIVE",
      },
    });
    parentUserId = parent.id;

    // Teacher user
    const teacher = await db.user.create({
      data: {
        email: `${testTag}-teacher@test.local`,
        username: `${testTag}-teacher`,
        firstName: "Ms",
        lastName: "Test",
        passwordHash: "x",
        status: "ACTIVE",
      },
    });
    teacherUserId = teacher.id;

    // Current academic year (seeded). Fall back to most recent by start date.
    const year =
      (await db.academicYear.findFirst({
        where: { schoolId: "default-school", isCurrent: true },
      })) ??
      (await db.academicYear.findFirst({
        where: { schoolId: "default-school" },
        orderBy: { startDate: "desc" },
      }));
    if (!year) throw new Error("Seed DB missing an academic year for default-school");

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

    const s = await db.student.create({
      data: {
        schoolId: "default-school",
        studentId: `${testTag}/1`,
        firstName: "MsgTest",
        lastName: "Student",
        dateOfBirth: new Date("2010-01-01"),
        gender: "MALE",
      },
    });
    studentId = s.id;

    const enrollment = await db.enrollment.create({
      data: {
        schoolId: "default-school",
        studentId,
        classArmId: arm.id,
        academicYearId: year.id,
        status: "ACTIVE",
      },
    });
    enrollmentId = enrollment.id;

    const g = await db.guardian.create({
      data: {
        schoolId: "default-school",
        firstName: "Parent",
        lastName: "Test",
        phone: `020${testTag.slice(-6)}`,
        userId: parentUserId,
      },
    });
    guardianId = g.id;

    await db.studentGuardian.create({
      data: {
        schoolId: "default-school",
        studentId,
        guardianId,
        isPrimary: true,
      },
    });
  });

  afterAll(async () => {
    // Clean up in FK-safe order.
    if (threadId) {
      await db.auditLog
        .deleteMany({ where: { entity: "MessageThread", entityId: threadId } })
        .catch(() => {});
      // Message, MessageThreadRead cascade from MessageThread deletion
      await db.messageThread.delete({ where: { id: threadId } }).catch(() => {});
    }
    await db.studentGuardian.deleteMany({ where: { studentId } }).catch(() => {});
    await db.enrollment.deleteMany({ where: { id: enrollmentId } }).catch(() => {});
    await db.student.delete({ where: { id: studentId } }).catch(() => {});
    await db.guardian.delete({ where: { id: guardianId } }).catch(() => {});
    await db.classArm.delete({ where: { id: armId } }).catch(() => {});
    await db.class.delete({ where: { id: classId } }).catch(() => {});
    await db.programme.delete({ where: { id: programmeId } }).catch(() => {});
    await db.user.delete({ where: { id: parentUserId } }).catch(() => {});
    await db.user.delete({ where: { id: teacherUserId } }).catch(() => {});
    await db.$disconnect();
  });

  it("parent creates a thread; teacher can read it", async () => {
    loginAs({
      id: parentUserId,
      permissions: ["messaging:portal:use"],
      schoolId: "default-school",
    });
    const result = await createMessageThreadAction({
      studentId,
      teacherUserId,
      initialBody: "Hello teacher, how is my child doing?",
    });
    if (!("data" in result)) throw new Error(result.error);
    threadId = result.data.id;

    loginAs({
      id: teacherUserId,
      permissions: ["messaging:portal:use"],
      schoolId: "default-school",
    });
    const detail = await getMessageThreadAction(threadId);
    if (!("data" in detail)) throw new Error(detail.error);
    expect(detail.data.messages.length).toBeGreaterThanOrEqual(1);
  });

  it("teacher replies; parent sees reply", async () => {
    if (!threadId) throw new Error("threadId not set");
    loginAs({
      id: teacherUserId,
      permissions: ["messaging:portal:use"],
      schoolId: "default-school",
    });
    const res = await postMessageAction({
      threadId,
      body: "Doing well! Please see attached report.",
    });
    if (!("data" in res)) throw new Error(res.error);

    loginAs({
      id: parentUserId,
      permissions: ["messaging:portal:use"],
      schoolId: "default-school",
    });
    const detail = await getMessageThreadAction(threadId);
    if (!("data" in detail)) throw new Error(detail.error);
    expect(detail.data.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("admin can lock; post then fails; unlock; post succeeds", async () => {
    if (!threadId) throw new Error("threadId not set");
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    const lockRes = await lockThreadAction({ threadId, reason: "Testing lock" });
    expect(lockRes).toEqual({ success: true });

    loginAs({
      id: parentUserId,
      permissions: ["messaging:portal:use"],
      schoolId: "default-school",
    });
    const postRes = await postMessageAction({ threadId, body: "Can I post?" });
    expect(postRes).toEqual({ error: "Thread is locked." });

    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    await unlockThreadAction(threadId);

    loginAs({
      id: parentUserId,
      permissions: ["messaging:portal:use"],
      schoolId: "default-school",
    });
    const postAgain = await postMessageAction({ threadId, body: "Now I can." });
    if (!("data" in postAgain)) throw new Error(postAgain.error);
    expect(postAgain.data.id).toBeTruthy();
  });

  it("archiveThreadAction sets status to ARCHIVED; post fails", async () => {
    if (!threadId) throw new Error("threadId not set");
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });
    await archiveThreadAction(threadId);

    loginAs({
      id: parentUserId,
      permissions: ["messaging:portal:use"],
      schoolId: "default-school",
    });
    const postRes = await postMessageAction({ threadId, body: "archived?" });
    expect(postRes).toEqual({ error: "Thread is archived." });
  });

  it("tenant isolation: session from another school cannot see this thread", async () => {
    loginAs({
      id: "other-user",
      permissions: ["messaging:portal:use"],
      schoolId: "other-school",
    });
    const res = await getMessageThreadAction(threadId!);
    expect(res).toEqual({ error: "Thread not found" });
  });
});
