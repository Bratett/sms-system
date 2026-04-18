import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import {
  decideApplicationAction,
  verifyPlacementAction,
} from "@/modules/admissions/actions/admission.action";

const baselineApp = {
  id: "app-1",
  schoolId: "default-school",
  academicYearId: "ay-1",
  applicationNumber: "APP/2026/0001",
  firstName: "Ama",
  lastName: "Mensah",
  status: "AWAITING_DECISION",
  applicationType: "STANDARD",
  jhsAggregate: null,
  enrollmentCode: null,
  beceIndexNumber: null,
  programPlaced: null,
  notes: null,
  guardianName: "Kofi Mensah",
  guardianPhone: "0241234567",
  guardianEmail: null,
};

beforeEach(() => {
  mockAuthenticatedUser();
  prismaMock.admissionDecision.create.mockResolvedValue({ id: "dec-1" } as never);
  prismaMock.admissionCondition.createMany.mockResolvedValue({ count: 0 } as never);
  prismaMock.admissionOffer.create.mockResolvedValue({ id: "offer-1" } as never);
  prismaMock.admissionApplication.update.mockResolvedValue({
    id: "app-1",
    status: "ACCEPTED",
  } as never);
});

describe("decideApplicationAction — validation", () => {
  it("rejects invalid decision type", async () => {
    const res = await decideApplicationAction("app-1", {
      decision: "MAYBE" as never,
    });
    expect(res).toHaveProperty("error", "Invalid input");
  });

  it("requires a reason for REJECTED", async () => {
    const res = await decideApplicationAction("app-1", {
      decision: "REJECTED",
    });
    expect(res).toHaveProperty("error", "Invalid input");
  });

  it("requires conditions for CONDITIONAL_ACCEPT", async () => {
    const res = await decideApplicationAction("app-1", {
      decision: "CONDITIONAL_ACCEPT",
      reason: "Needs a test",
    });
    expect(res).toHaveProperty("error", "Invalid input");
  });
});

describe("decideApplicationAction — authority matrix enforcement", () => {
  it("returns permission error when non-override user attempts REJECT", async () => {
    mockAuthenticatedUser({ permissions: ["admissions:applications:read"] });
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      ...baselineApp,
      interviews: [{ totalScore: 4.0 }],
    } as never);

    const res = await decideApplicationAction("app-1", {
      decision: "REJECTED",
      reason: "Failed assessment",
    });
    // Our authority matrix routes REJECTED through ADMISSIONS_OVERRIDE.
    expect("error" in res).toBe(true);
  });

  it("allows headmaster-level user (override) to REJECT", async () => {
    mockAuthenticatedUser({
      permissions: ["admissions:decisions:override"],
    });
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      ...baselineApp,
      interviews: [{ totalScore: 4.0 }],
    } as never);

    const res = await decideApplicationAction("app-1", {
      decision: "REJECTED",
      reason: "Failed assessment",
    });
    expect(res).toHaveProperty("data");
    expect(prismaMock.admissionDecision.create).toHaveBeenCalled();
  });
});

describe("decideApplicationAction — ACCEPT issues an offer", () => {
  it("creates an AdmissionOffer row when decision is ACCEPTED", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      ...baselineApp,
      interviews: [{ totalScore: 9.5 }], // auto-accept via score
    } as never);

    const res = await decideApplicationAction("app-1", {
      decision: "ACCEPTED",
    });
    expect(res).toHaveProperty("data");
    expect(prismaMock.admissionOffer.create).toHaveBeenCalled();
  });

  it("does NOT create an offer for WAITLISTED", async () => {
    mockAuthenticatedUser({ permissions: ["admissions:applications:approve"] });
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      ...baselineApp,
      interviews: [{ totalScore: 6.5 }],
    } as never);
    prismaMock.admissionOffer.create.mockClear();

    const res = await decideApplicationAction("app-1", {
      decision: "WAITLISTED",
    });
    expect(res).toHaveProperty("data");
    expect(prismaMock.admissionOffer.create).not.toHaveBeenCalled();
  });
});

describe("decideApplicationAction — blocks changes on terminal states", () => {
  it("refuses to re-decide ENROLLED applications", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      ...baselineApp,
      status: "ENROLLED",
      interviews: [],
    } as never);

    const res = await decideApplicationAction("app-1", {
      decision: "ACCEPTED",
    });
    expect(res).toEqual({
      error:
        "Decision cannot be changed once the application is enrolled or cancelled.",
    });
  });
});

describe("verifyPlacementAction", () => {
  it("rejects non-placement applications", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValue({
      ...baselineApp,
      applicationType: "STANDARD",
      documents: [],
    } as never);

    const res = await verifyPlacementAction("app-1");
    expect(res).toEqual({ error: "Only placement applications can be verified." });
  });

  it("returns error when validation fails", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValueOnce({
      ...baselineApp,
      applicationType: "PLACEMENT",
      enrollmentCode: "BAD", // too short
      beceIndexNumber: "0120045067",
      documents: [],
    } as never);
    // validatePlacement inside the service does its own findFirst for duplicate
    prismaMock.admissionApplication.findFirst.mockResolvedValue(null as never);

    const res = await verifyPlacementAction("app-1");
    expect("error" in res).toBe(true);
  });

  it("flips placementVerified and does NOT auto-admit when BECE aggregate missing", async () => {
    prismaMock.admissionApplication.findUnique.mockResolvedValueOnce({
      ...baselineApp,
      applicationType: "PLACEMENT",
      enrollmentCode: "ENCODE123",
      beceIndexNumber: "0120045067",
      jhsAggregate: null,
      documents: [{ id: "doc-1" }],
    } as never);
    prismaMock.admissionApplication.findFirst.mockResolvedValue(null as never);
    // capacity query mocks
    prismaMock.classArm.findMany.mockResolvedValue([{ capacity: 50 }] as never);
    prismaMock.enrollment.count.mockResolvedValue(10 as never);

    const res = await verifyPlacementAction("app-1");
    expect(res).toHaveProperty("data");
    const data = (res as { data: Record<string, unknown> }).data;
    expect(data.placementVerified).toBe(true);
    expect(data.autoAdmitted).toBe(false);
  });

  it("auto-admits verified placement student with excellent BECE", async () => {
    prismaMock.admissionApplication.findUnique
      .mockResolvedValueOnce({
        // first call: verifyPlacementAction lookup
        ...baselineApp,
        applicationType: "PLACEMENT",
        enrollmentCode: "ENCODE123",
        beceIndexNumber: "0120045067",
        jhsAggregate: 8,
        documents: [{ id: "doc-1" }],
      } as never)
      .mockResolvedValueOnce({
        // second call: decideApplicationAction lookup
        ...baselineApp,
        applicationType: "PLACEMENT",
        jhsAggregate: 8,
        interviews: [],
      } as never);

    prismaMock.admissionApplication.findFirst.mockResolvedValue(null as never);
    prismaMock.classArm.findMany.mockResolvedValue([{ capacity: 50 }] as never);
    prismaMock.enrollment.count.mockResolvedValue(10 as never);

    const res = await verifyPlacementAction("app-1");
    expect(res).toHaveProperty("data");
    const data = (res as { data: Record<string, unknown> }).data;
    expect(data.placementVerified).toBe(true);
    expect(data.autoAdmitted).toBe(true);
    // The auto-admit path went through decideApplicationAction → offer issued.
    expect(prismaMock.admissionDecision.create).toHaveBeenCalled();
    expect(prismaMock.admissionOffer.create).toHaveBeenCalled();
  });
});
