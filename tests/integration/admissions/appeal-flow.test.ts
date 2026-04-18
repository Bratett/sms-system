import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  submitAppealAction,
  resolveAppealAction,
} from "@/modules/admissions/actions/appeal.action";
import { loginAs, resolveSeededAdminId } from "./setup";

const SCHOOL_ID = "default-school";
const db = new PrismaClient();
const createdAppIds: string[] = [];

async function createRejectedApp() {
  const ay = await db.academicYear.findFirst({ where: { isCurrent: true } });
  if (!ay) throw new Error("Seeded DB missing active academic year");
  const count = await db.admissionApplication.count({ where: { schoolId: SCHOOL_ID } });
  const app = await db.admissionApplication.create({
    data: {
      schoolId: SCHOOL_ID,
      academicYearId: ay.id,
      applicationNumber: `APP/APL/${String(count + 1).padStart(6, "0")}`,
      firstName: "Appealing",
      lastName: `Applicant-${Date.now()}`,
      dateOfBirth: new Date("2008-05-15"),
      gender: "FEMALE",
      guardianName: "Guardian",
      guardianPhone: "0205551234",
      guardianEmail: null,
      boardingStatus: "DAY",
      applicationType: "STANDARD",
      applicationSource: "STAFF",
      status: "REJECTED",
      currentStage: "REJECTED",
      decisionReason: "Initial interview score below threshold",
    },
  });
  createdAppIds.push(app.id);
  return app;
}

describe("appeal flow integration", () => {
  beforeAll(async () => {
    const school = await db.school.findUnique({ where: { id: SCHOOL_ID } });
    if (!school) throw new Error("Run: npm run db:seed");
    const adminId = await resolveSeededAdminId();
    loginAs({ id: adminId });
  });

  afterAll(async () => {
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
      await db.admissionAppeal.deleteMany({
        where: { applicationId: { in: createdAppIds } },
      });
      await db.admissionApplication.deleteMany({
        where: { id: { in: createdAppIds } },
      });
    }
    await db.$disconnect();
  });

  it(
    "upheld appeal returns a REJECTED application to AWAITING_DECISION",
    async () => {
      const app = await createRejectedApp();

      const submitted = await submitAppealAction(app.id, {
        reason: "New evidence: recommendation letter from JHS head",
      });
      expect("data" in submitted).toBe(true);
      const appeal = (submitted as { data: { id: string } }).data;

      const resolved = await resolveAppealAction(appeal.id, {
        upheld: true,
        resolution: "Additional evidence accepted; re-evaluate.",
      });
      expect("data" in resolved).toBe(true);

      const finalApp = await db.admissionApplication.findUnique({
        where: { id: app.id },
      });
      expect(finalApp!.status).toBe("AWAITING_DECISION");

      const finalAppeal = await db.admissionAppeal.findUnique({ where: { id: appeal.id } });
      expect(finalAppeal!.status).toBe("UPHELD");

      // Workflow transition recorded.
      const transitions = await db.workflowTransition.findMany({
        where: {
          instance: {
            entityType: "AdmissionApplication",
            entityId: app.id,
          },
        },
      });
      expect(transitions.some((t) => t.event === "APPEAL_UPHELD")).toBe(true);
    },
    20_000,
  );

  it(
    "denied appeal leaves the application rejected",
    async () => {
      const app = await createRejectedApp();
      const submitted = await submitAppealAction(app.id, {
        reason: "Please reconsider — scholarship eligible",
      });
      const appeal = (submitted as { data: { id: string } }).data;

      const denied = await resolveAppealAction(appeal.id, {
        upheld: false,
        resolution: "Capacity full; waitlist exhausted.",
      });
      expect("data" in denied).toBe(true);

      const finalApp = await db.admissionApplication.findUnique({
        where: { id: app.id },
      });
      expect(finalApp!.status).toBe("REJECTED");

      const finalAppeal = await db.admissionAppeal.findUnique({ where: { id: appeal.id } });
      expect(finalAppeal!.status).toBe("DENIED");
    },
    15_000,
  );

  it("rejects a second pending appeal on the same application", async () => {
    const app = await createRejectedApp();
    const first = await submitAppealAction(app.id, { reason: "first appeal submission" });
    expect("data" in first).toBe(true);

    const second = await submitAppealAction(app.id, { reason: "second appeal attempt" });
    expect("error" in second).toBe(true);
    expect((second as { error: string }).error).toMatch(/pending appeal already exists/i);
  });
});
