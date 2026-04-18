import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  decideApplicationAction,
  enrollApplicationAction,
} from "@/modules/admissions/actions/admission.action";
import {
  scheduleInterviewAction,
  recordInterviewAction,
} from "@/modules/admissions/actions/interview.action";
import { acceptOfferAction } from "@/modules/admissions/actions/offer.action";
import { loginAs, resolveSeededAdminId } from "./setup";

const SCHOOL_ID = "default-school";
const db = new PrismaClient();
const createdAppIds: string[] = [];
const createdStudentIds: string[] = [];
const createdGuardianIds: string[] = [];

async function pickActiveClassArm() {
  const arm = await db.classArm.findFirst({
    where: {
      schoolId: SCHOOL_ID,
      status: "ACTIVE",
      class: { academicYearId: { not: undefined } },
    },
    include: { class: true },
  });
  if (!arm) throw new Error("Seeded DB has no active class arm");
  return arm;
}

async function createSubmittedStandardApp() {
  const ay = await db.academicYear.findFirst({ where: { isCurrent: true } });
  if (!ay) throw new Error("Seeded DB missing active academic year");
  const count = await db.admissionApplication.count({ where: { schoolId: SCHOOL_ID } });
  const app = await db.admissionApplication.create({
    data: {
      schoolId: SCHOOL_ID,
      academicYearId: ay.id,
      applicationNumber: `APP/STD/${String(count + 1).padStart(6, "0")}`,
      firstName: "Standard",
      lastName: `Applicant-${Date.now()}`,
      dateOfBirth: new Date("2008-05-15"),
      gender: "MALE",
      guardianName: "Ama Guardian",
      guardianPhone: "0209876543",
      guardianEmail: "std-guardian@example.com",
      boardingStatus: "DAY",
      applicationType: "STANDARD",
      applicationSource: "STAFF",
      status: "UNDER_REVIEW",
      currentStage: "UNDER_REVIEW",
      applicationFeeRequired: true,
      applicationFeePaid: true,
    },
  });
  createdAppIds.push(app.id);
  return app;
}

describe("standard pipeline integration", () => {
  beforeAll(async () => {
    const school = await db.school.findUnique({ where: { id: SCHOOL_ID } });
    if (!school) throw new Error("Run: npm run db:seed");
    const adminId = await resolveSeededAdminId();
    loginAs({ id: adminId });
  });

  afterAll(async () => {
    // Enrollments cascade-delete via Student; also cover orphans.
    if (createdStudentIds.length > 0) {
      await db.enrollment.deleteMany({
        where: { studentId: { in: createdStudentIds } },
      });
      await db.studentGuardian.deleteMany({
        where: { studentId: { in: createdStudentIds } },
      });
      await db.student.deleteMany({ where: { id: { in: createdStudentIds } } });
    }
    if (createdGuardianIds.length > 0) {
      await db.guardian.deleteMany({ where: { id: { in: createdGuardianIds } } });
    }
    if (createdAppIds.length > 0) {
      await db.workflowTransition.deleteMany({
        where: {
          instance: {
            entityType: "AdmissionApplication",
            entityId: { in: createdAppIds },
          },
        },
      });
      await db.workflowInstance.deleteMany({
        where: { entityType: "AdmissionApplication", entityId: { in: createdAppIds } },
      });
      await db.admissionOffer.deleteMany({
        where: { applicationId: { in: createdAppIds } },
      });
      await db.admissionCondition.deleteMany({
        where: { decision: { applicationId: { in: createdAppIds } } },
      });
      await db.admissionDecision.deleteMany({
        where: { applicationId: { in: createdAppIds } },
      });
      await db.admissionInterview.deleteMany({
        where: { applicationId: { in: createdAppIds } },
      });
      await db.admissionApplication.deleteMany({
        where: { id: { in: createdAppIds } },
      });
    }
    await db.$disconnect();
  });

  it(
    "schedule → record → decide(accept) → acceptOffer → enroll chains end-to-end",
    async () => {
      const app = await createSubmittedStandardApp();
      const arm = await pickActiveClassArm();

      // 1. Schedule interview
      const schedRes = await scheduleInterviewAction(app.id, {
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        location: "Admin Block",
        panelMemberIds: [],
      });
      expect("data" in schedRes).toBe(true);

      const interview = await db.admissionInterview.findFirst({
        where: { applicationId: app.id },
      });
      expect(interview).not.toBeNull();

      // 2. Record interview with weighted scores → total 7.8 (standard accept range).
      // 10*0.4 + 8*0.35 + 4*0.25 = 4.0 + 2.8 + 1.0 = 7.8
      const recordRes = await recordInterviewAction(interview!.id, {
        academicScore: 10,
        behavioralScore: 8,
        parentScore: 4,
        outcome: "PASSED",
        notes: "Strong",
      });
      expect("data" in recordRes).toBe(true);

      const recorded = await db.admissionInterview.findUnique({
        where: { id: interview!.id },
      });
      expect(Number(recorded!.totalScore)).toBeCloseTo(7.8, 1);

      // 3. Decide ACCEPTED
      const decideRes = await decideApplicationAction(app.id, {
        decision: "ACCEPTED",
        reason: "Solid interview, strong references",
      });
      expect("data" in decideRes).toBe(true);

      const postDecide = await db.admissionApplication.findUnique({
        where: { id: app.id },
        include: { offers: true, decisions: true },
      });
      expect(postDecide!.status).toBe("ACCEPTED");
      expect(postDecide!.offers.length).toBe(1);
      expect(postDecide!.decisions.length).toBe(1);

      // 4. Accept offer
      const acceptRes = await acceptOfferAction(app.id);
      expect("data" in acceptRes).toBe(true);

      const postAccept = await db.admissionApplication.findUnique({
        where: { id: app.id },
      });
      expect(postAccept!.offerAccepted).toBe(true);

      // 5. Enroll into the chosen class arm.
      const enrollRes = await enrollApplicationAction(app.id, arm.id);
      expect("data" in enrollRes).toBe(true);

      const finalApp = await db.admissionApplication.findUnique({
        where: { id: app.id },
      });
      expect(finalApp!.status).toBe("ENROLLED");
      expect(finalApp!.enrolledStudentId).not.toBeNull();

      // Track created Student/Guardian/Enrollment for cleanup.
      const studentId = finalApp!.enrolledStudentId!;
      createdStudentIds.push(studentId);

      const guardian = await db.studentGuardian.findFirst({
        where: { studentId },
        include: { guardian: true },
      });
      if (guardian) createdGuardianIds.push(guardian.guardianId);

      // Enrollment created, not a Free-SHS placement.
      const enrollment = await db.enrollment.findFirst({
        where: { studentId, academicYearId: finalApp!.academicYearId },
      });
      expect(enrollment).not.toBeNull();
      expect(enrollment!.isFreeShsPlacement).toBe(false);
    },
    30_000,
  );
});
