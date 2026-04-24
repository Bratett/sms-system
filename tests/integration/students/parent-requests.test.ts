import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveSeededAdminId, loginAs } from "./setup";
import {
  submitExcuseRequestAction,
  approveExcuseRequestAction,
  rejectExcuseRequestAction,
  withdrawExcuseRequestAction,
  getExcuseRequestAction,
} from "@/modules/parent-requests/actions/excuse.action";
import {
  submitMedicalDisclosureAction,
  approveMedicalDisclosureAction,
} from "@/modules/parent-requests/actions/medical-disclosure.action";
import { cancelPendingRequestsForStudent } from "@/modules/parent-requests/lifecycle";

/**
 * Integration coverage for the Parent-Initiated Workflows feature
 * (excuse requests + medical disclosures).
 *
 * Seeds a parent → student → class-teacher chain plus a school-nurse user and
 * attendance records, then exercises the server actions end-to-end against a
 * live postgres.
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Parent requests (integration)", () => {
  const db = new PrismaClient();
  const testTag = `preq-test-${Date.now()}`;

  let adminId: string;
  let parentUserId: string;
  let teacherUserId: string;
  let teacherStaffId: string;
  let nurseUserId: string;
  let nurseRoleId: string | null = null;
  let studentId: string;
  let guardianId: string;
  let armId: string;
  let classId: string;
  let programmeId: string;
  let enrollmentId: string;
  let registerId: string;
  let record1Id: string;
  let record2Id: string;

  // Two date ranges so PENDING requests don't collide on the class arm's
  // unique [classArmId,date,type,periodId] register constraint and so
  // independent tests operate on non-overlapping attendance rows.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMinus = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d;
  };
  const range1From = dayMinus(2);
  const range1To = dayMinus(2);
  const range2From = dayMinus(4);
  const range2To = dayMinus(3);

  async function cleanupSeedData() {
    try {
      if (studentId) {
        await db.excuseRequest.deleteMany({ where: { studentId } }).catch(() => {});
        await db.medicalDisclosure.deleteMany({ where: { studentId } }).catch(() => {});
        await db.medicalRecord.deleteMany({ where: { studentId } }).catch(() => {});
        await db.attendanceRecord.deleteMany({ where: { studentId } }).catch(() => {});
      }
      if (registerId)
        await db.attendanceRegister.delete({ where: { id: registerId } }).catch(() => {});
      if (studentId)
        await db.studentGuardian.deleteMany({ where: { studentId } }).catch(() => {});
      if (enrollmentId)
        await db.enrollment.delete({ where: { id: enrollmentId } }).catch(() => {});
      if (studentId)
        await db.student.delete({ where: { id: studentId } }).catch(() => {});
      if (guardianId)
        await db.guardian.delete({ where: { id: guardianId } }).catch(() => {});
      if (armId) await db.classArm.delete({ where: { id: armId } }).catch(() => {});
      if (classId) await db.class.delete({ where: { id: classId } }).catch(() => {});
      if (programmeId)
        await db.programme.delete({ where: { id: programmeId } }).catch(() => {});
      if (teacherUserId)
        await db.staff.deleteMany({ where: { userId: teacherUserId } }).catch(() => {});
      const userIds = [parentUserId, teacherUserId, nurseUserId].filter(
        (x): x is string => !!x,
      );
      if (userIds.length) {
        await db.userSchool
          .deleteMany({ where: { userId: { in: userIds } } })
          .catch(() => {});
        await db.userRole
          .deleteMany({ where: { userId: { in: userIds } } })
          .catch(() => {});
        await db.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
      }
    } catch {
      // best-effort
    }
  }

  beforeAll(async () => {
    try {
      adminId = await resolveSeededAdminId();

      // Parent + guardian link
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

      // Teacher user + Staff
      const teacher = await db.user.create({
        data: {
          email: `${testTag}-teacher@test.local`,
          username: `${testTag}-teacher`,
          firstName: "Ms",
          lastName: "Teacher",
          passwordHash: "x",
          status: "ACTIVE",
        },
      });
      teacherUserId = teacher.id;

      const staff = await db.staff.create({
        data: {
          schoolId: "default-school",
          userId: teacher.id,
          staffId: `${testTag}-STF`,
          firstName: "Ms",
          lastName: "Teacher",
          gender: "FEMALE",
          phone: `030${testTag.slice(-6)}`,
          staffType: "TEACHING",
          status: "ACTIVE",
        },
      });
      teacherStaffId = staff.id;

      // Nurse user + school_nurse role (create role if missing)
      const nurse = await db.user.create({
        data: {
          email: `${testTag}-nurse@test.local`,
          username: `${testTag}-nurse`,
          firstName: "Nurse",
          lastName: "NightingaleTest",
          passwordHash: "x",
          status: "ACTIVE",
        },
      });
      nurseUserId = nurse.id;

      const nurseRole =
        (await db.role.findUnique({ where: { name: "school_nurse" } })) ??
        (await db.role.create({
          data: {
            name: "school_nurse",
            displayName: "School Nurse",
            description: "Reviews medical disclosures",
            isSystem: false,
          },
        }));
      nurseRoleId = nurseRole.id;

      await db.userRole.create({
        data: { userId: nurse.id, roleId: nurseRole.id },
      });
      await db.userSchool.create({
        data: { userId: nurse.id, schoolId: "default-school", isDefault: true },
      });

      // Academic year, programme, class, arm
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
          classTeacherId: teacherStaffId,
        },
      });
      armId = arm.id;

      // Student (ACTIVE + BOARDING) + enrollment
      const s = await db.student.create({
        data: {
          schoolId: "default-school",
          studentId: `${testTag}/1`,
          firstName: "PReq",
          lastName: "Student",
          dateOfBirth: new Date("2010-01-01"),
          gender: "FEMALE",
          boardingStatus: "BOARDING",
          status: "ACTIVE",
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
          lastName: "TestPReq",
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

      // Attendance register + 2 ABSENT records spanning both date ranges.
      // Use register date inside range1 (single day) — we only need one
      // register to host both records. Test 1 (happy-path excuse) runs over
      // range1 only, so flipping records to EXCUSED there is checkable.
      const register = await db.attendanceRegister.create({
        data: {
          schoolId: "default-school",
          classArmId: arm.id,
          date: range1From,
          type: "DAILY",
          takenBy: adminId,
          status: "OPEN",
        },
      });
      registerId = register.id;

      const r1 = await db.attendanceRecord.create({
        data: {
          registerId: register.id,
          studentId,
          schoolId: "default-school",
          status: "ABSENT",
        },
      });
      record1Id = r1.id;

      // A second absent record on a different register date (range2) — this
      // one should NOT flip when we approve range1, so test 1 can assert that
      // only range-matching records get mutated.
      const register2 = await db.attendanceRegister.create({
        data: {
          schoolId: "default-school",
          classArmId: arm.id,
          date: range2From,
          type: "DAILY",
          takenBy: adminId,
          status: "OPEN",
        },
      });
      const r2 = await db.attendanceRecord.create({
        data: {
          registerId: register2.id,
          studentId,
          schoolId: "default-school",
          status: "ABSENT",
        },
      });
      record2Id = r2.id;
      // Note: registerId only tracks the first for tidiness; cleanupSeedData
      // wipes all attendanceRecord + any remaining AttendanceRegister rows
      // for this arm via the classArm delete cascade.
    } catch (err) {
      await cleanupSeedData();
      throw err;
    }
  }, 60_000);

  afterAll(async () => {
    // Also sweep the second register we created above.
    try {
      if (armId) {
        await db.attendanceRecord
          .deleteMany({ where: { studentId } })
          .catch(() => {});
        await db.attendanceRegister
          .deleteMany({ where: { classArmId: armId } })
          .catch(() => {});
      }
    } catch {
      // best-effort
    }
    await cleanupSeedData();
    // Don't leave an orphan role behind if we created one.
    if (nurseRoleId) {
      const remaining = await db.userRole
        .count({ where: { roleId: nurseRoleId } })
        .catch(() => 1);
      if (remaining === 0) {
        await db.role.delete({ where: { id: nurseRoleId } }).catch(() => {});
      }
    }
    await db.$disconnect();
  }, 60_000);

  function loginAsParent() {
    loginAs({
      id: parentUserId,
      permissions: ["*"],
      schoolId: "default-school",
    });
  }
  function loginAsTeacher() {
    loginAs({
      id: teacherUserId,
      permissions: ["*"],
      schoolId: "default-school",
    });
  }
  function loginAsNurse() {
    loginAs({
      id: nurseUserId,
      permissions: ["*"],
      schoolId: "default-school",
    });
  }

  // ── Test 1: Happy path excuse ──────────────────────────────────
  it("excuse happy path: parent submits → teacher approves → AttendanceRecord flips to EXCUSED", async () => {
    loginAsParent();
    const submit = await submitExcuseRequestAction({
      studentId,
      fromDate: range1From,
      toDate: range1To,
      reason: "Stomach flu — kept home for rest.",
    });
    if (!("data" in submit)) throw new Error(submit.error);
    const requestId = submit.data.id;

    loginAsTeacher();
    const approve = await approveExcuseRequestAction({
      requestId,
      reviewNote: "OK",
    });
    expect(approve).toHaveProperty("success", true);

    const rec1 = await db.attendanceRecord.findUnique({
      where: { id: record1Id },
    });
    const rec2 = await db.attendanceRecord.findUnique({
      where: { id: record2Id },
    });
    expect(rec1?.status).toBe("EXCUSED");
    // Record 2 is on a different date outside range1 → must still be ABSENT.
    expect(rec2?.status).toBe("ABSENT");

    const row = await db.excuseRequest.findUnique({ where: { id: requestId } });
    expect(row?.status).toBe("APPROVED");
    expect(row?.reviewerUserId).toBe(teacherUserId);
  });

  // ── Test 2: Happy path medical ─────────────────────────────────
  it("medical happy path: parent submits urgent allergy → nurse approves with sync → Student + MedicalRecord updated", async () => {
    loginAsParent();
    const submit = await submitMedicalDisclosureAction({
      studentId,
      category: "ALLERGY",
      title: "Peanut allergy",
      description: "Severe anaphylactic reaction to peanuts.",
      isUrgent: true,
    });
    if (!("data" in submit)) throw new Error(submit.error);
    const disclosureId = submit.data.id;

    loginAsNurse();
    const approve = await approveMedicalDisclosureAction({
      disclosureId,
      reviewNote: "Verified with parent.",
      syncToStudent: { allergies: "Peanuts" },
    });
    expect(approve).toMatchObject({ success: true });
    if (!("medicalRecordId" in approve) || !approve.medicalRecordId) {
      throw new Error("expected medicalRecordId in approve result");
    }

    const disclosure = await db.medicalDisclosure.findUnique({
      where: { id: disclosureId },
    });
    expect(disclosure?.status).toBe("APPROVED");
    expect(disclosure?.resultingMedicalRecordId).toBe(approve.medicalRecordId);

    const mr = await db.medicalRecord.findUnique({
      where: { id: approve.medicalRecordId },
    });
    expect(mr).toBeTruthy();
    expect(mr?.studentId).toBe(studentId);

    const student = await db.student.findUnique({ where: { id: studentId } });
    expect(student?.allergies).toContain("Peanuts");
  });

  // ── Test 3: Rejection ──────────────────────────────────────────
  it("rejection: parent submits → teacher rejects with note → row is REJECTED", async () => {
    loginAsParent();
    const submit = await submitExcuseRequestAction({
      studentId,
      fromDate: range2From,
      toDate: range2To,
      reason: "Family trip.",
    });
    if (!("data" in submit)) throw new Error(submit.error);
    const requestId = submit.data.id;

    loginAsTeacher();
    const reject = await rejectExcuseRequestAction({
      requestId,
      reviewNote: "Not a valid reason — unauthorised absence.",
    });
    expect(reject).toHaveProperty("success", true);

    const row = await db.excuseRequest.findUnique({ where: { id: requestId } });
    expect(row?.status).toBe("REJECTED");
    expect(row?.reviewNote).toBe("Not a valid reason — unauthorised absence.");
    expect(row?.reviewerUserId).toBe(teacherUserId);
  });

  // ── Test 4: Withdrawal ─────────────────────────────────────────
  it("withdrawal: parent submits → parent withdraws → row is WITHDRAWN", async () => {
    loginAsParent();
    // Use range1 again — the earlier request was reviewed (APPROVED), so the
    // schema doesn't prevent a second PENDING row for the same range.
    const submit = await submitExcuseRequestAction({
      studentId,
      fromDate: range1From,
      toDate: range1To,
      reason: "Follow-up doctor visit.",
    });
    if (!("data" in submit)) throw new Error(submit.error);
    const requestId = submit.data.id;

    const withdraw = await withdrawExcuseRequestAction(requestId);
    expect(withdraw).toEqual({ success: true });

    const row = await db.excuseRequest.findUnique({ where: { id: requestId } });
    expect(row?.status).toBe("WITHDRAWN");
  });

  // ── Test 5: Lifecycle cancellation ─────────────────────────────
  it("lifecycle: cancelPendingRequestsForStudent flips PENDING rows to WITHDRAWN", async () => {
    loginAsParent();
    const submit = await submitExcuseRequestAction({
      studentId,
      fromDate: range2From,
      toDate: range2To,
      reason: "Pending — will be auto-withdrawn.",
    });
    if (!("data" in submit)) throw new Error(submit.error);
    const requestId = submit.data.id;

    await cancelPendingRequestsForStudent(studentId);

    const row = await db.excuseRequest.findUnique({ where: { id: requestId } });
    expect(row?.status).toBe("WITHDRAWN");
    expect(row?.reviewNote).toMatch(/lifecycle/i);
  });

  // ── Test 6: Tenant isolation ───────────────────────────────────
  it("tenant isolation: other-school caller cannot load an excuse request from this school", async () => {
    // Insert an ExcuseRequest directly against the test school.
    const direct = await db.excuseRequest.create({
      data: {
        schoolId: "default-school",
        studentId,
        submittedByUserId: parentUserId,
        fromDate: range2From,
        toDate: range2To,
        reason: "Tenant-isolation probe.",
        status: "PENDING",
      },
    });

    // Control: original-tenant caller (parent) can read it.
    loginAsParent();
    const sameTenant = await getExcuseRequestAction(direct.id);
    expect(sameTenant).toHaveProperty("data");

    // Actual assertion: caller scoped to a different school sees nothing.
    loginAs({
      id: "other-user",
      permissions: ["*"],
      schoolId: "other-school",
    });
    const crossTenant = await getExcuseRequestAction(direct.id);
    expect(crossTenant).toEqual({ error: "Request not found." });
  });
});
