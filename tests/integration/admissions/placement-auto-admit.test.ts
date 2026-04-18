import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { verifyPlacementAction } from "@/modules/admissions/actions/admission.action";
import { ADMISSION_WORKFLOW_KEY } from "@/lib/workflow/definitions/admission";
import { loginAs, resolveSeededAdminId } from "./setup";

const SCHOOL_ID = "default-school";
const db = new PrismaClient();
const createdAppIds: string[] = [];

async function createTestPlacementApplication(opts: {
  beceAggregate: number;
  enrollmentCode: string;
  beceIndex: string;
  withDocument?: boolean;
}) {
  const ay = await db.academicYear.findFirst({ where: { isCurrent: true } });
  if (!ay) throw new Error("Seeded database missing an active academic year");

  const count = await db.admissionApplication.count({ where: { schoolId: SCHOOL_ID } });
  const app = await db.admissionApplication.create({
    data: {
      schoolId: SCHOOL_ID,
      academicYearId: ay.id,
      applicationNumber: `APP/INT/${String(count + 1).padStart(6, "0")}`,
      firstName: "IntegrationTest",
      lastName: `Placement-${Date.now()}`,
      dateOfBirth: new Date("2008-05-15"),
      gender: "FEMALE",
      guardianName: "Kofi Guardian",
      guardianPhone: "0241234567",
      guardianEmail: "guardian@example.com",
      boardingStatus: "DAY",
      applicationType: "PLACEMENT",
      applicationSource: "PORTAL",
      status: "SUBMITTED",
      beceIndexNumber: opts.beceIndex,
      enrollmentCode: opts.enrollmentCode,
      jhsAggregate: opts.beceAggregate,
      applicationFeeRequired: false,
      applicationFeePaid: true,
      feeWaivedReason: "Free SHS placement student",
    },
  });
  createdAppIds.push(app.id);

  if (opts.withDocument) {
    await db.admissionDocument.create({
      data: {
        applicationId: app.id,
        schoolId: SCHOOL_ID,
        documentType: "Placement Letter",
        fileName: "placement.pdf",
        fileKey: `admissions/${app.id}/placement.pdf`,
      },
    });
  }

  return app;
}

describe("placement auto-admit integration", () => {
  beforeAll(async () => {
    const school = await db.school.findUnique({ where: { id: SCHOOL_ID } });
    if (!school) {
      throw new Error(
        `Test requires seeded database with school id "${SCHOOL_ID}". Run: npm run db:seed`,
      );
    }
    const adminId = await resolveSeededAdminId();
    loginAs({ id: adminId });
  });

  afterAll(async () => {
    if (createdAppIds.length > 0) {
      // Remove workflow instances + transitions for these entities.
      await db.workflowTransition.deleteMany({
        where: {
          instance: { entityType: "AdmissionApplication", entityId: { in: createdAppIds } },
        },
      });
      await db.workflowInstance.deleteMany({
        where: { entityType: "AdmissionApplication", entityId: { in: createdAppIds } },
      });
      // Clean up offers, decisions+conditions, interviews, appeals, documents.
      await db.admissionOffer.deleteMany({ where: { applicationId: { in: createdAppIds } } });
      await db.admissionCondition.deleteMany({
        where: { decision: { applicationId: { in: createdAppIds } } },
      });
      await db.admissionDecision.deleteMany({
        where: { applicationId: { in: createdAppIds } },
      });
      await db.admissionInterview.deleteMany({
        where: { applicationId: { in: createdAppIds } },
      });
      await db.admissionAppeal.deleteMany({
        where: { applicationId: { in: createdAppIds } },
      });
      await db.admissionDocument.deleteMany({
        where: { applicationId: { in: createdAppIds } },
      });
      await db.admissionApplication.deleteMany({ where: { id: { in: createdAppIds } } });
    }
    await db.$disconnect();
  });

  it(
    "verified placement student with BECE aggregate 8 auto-admits, issues offer, writes workflow transitions",
    async () => {
      const app = await createTestPlacementApplication({
        beceAggregate: 8,
        enrollmentCode: `ENCODE${Date.now()}`,
        beceIndex: `${Date.now()}`.padStart(10, "0").slice(-10),
        withDocument: true,
      });

      const res = await verifyPlacementAction(app.id, {});
      expect("error" in res).toBe(false);
      expect("data" in res).toBe(true);

      const data = (res as { data: { placementVerified: boolean; autoAdmitted: boolean } })
        .data;
      expect(data.placementVerified).toBe(true);
      expect(data.autoAdmitted).toBe(true);

      const refreshed = await db.admissionApplication.findUnique({
        where: { id: app.id },
        include: { decisions: true, offers: true },
      });
      expect(refreshed).not.toBeNull();
      expect(refreshed!.placementVerified).toBe(true);
      expect(refreshed!.status).toBe("ACCEPTED");
      expect(refreshed!.decisions.length).toBeGreaterThan(0);
      expect(refreshed!.decisions[0].autoDecision).toBe(true);
      expect(refreshed!.decisions[0].decision).toBe("ACCEPTED");
      expect(refreshed!.offers.length).toBe(1);

      const offer = refreshed!.offers[0];
      // Default expiry window is 14 days — within a loose tolerance.
      const now = new Date();
      const daysOut =
        (offer.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysOut).toBeGreaterThan(13);
      expect(daysOut).toBeLessThan(15);

      // Workflow instance + at least one transition row exist.
      const wf = await db.workflowInstance.findUnique({
        where: {
          entityType_entityId: {
            entityType: "AdmissionApplication",
            entityId: app.id,
          },
        },
      });
      expect(wf).not.toBeNull();
      expect(wf!.definitionKey).toBe(ADMISSION_WORKFLOW_KEY);

      const transitions = await db.workflowTransition.count({
        where: { instanceId: wf!.id },
      });
      expect(transitions).toBeGreaterThan(0);
    },
    20_000,
  );

  it(
    "does not auto-admit a placement student with BECE aggregate 18",
    async () => {
      const app = await createTestPlacementApplication({
        beceAggregate: 18,
        enrollmentCode: `ENCODE18${Date.now()}`,
        beceIndex: `${Date.now() + 1}`.padStart(10, "0").slice(-10),
      });

      const res = await verifyPlacementAction(app.id, {});
      expect("data" in res).toBe(true);

      const data = (res as { data: { placementVerified: boolean; autoAdmitted: boolean } })
        .data;
      expect(data.placementVerified).toBe(true);
      expect(data.autoAdmitted).toBe(false);

      const refreshed = await db.admissionApplication.findUnique({
        where: { id: app.id },
      });
      expect(refreshed!.placementVerified).toBe(true);
      // Still SUBMITTED — decision not made.
      expect(refreshed!.status).toBe("SUBMITTED");
    },
    20_000,
  );
});
