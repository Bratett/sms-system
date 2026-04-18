import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import {
  validateEnrollmentCodeFormat,
  validateBECEIndexFormat,
  checkDuplicateEnrollmentCode,
  validatePlacement,
  beceToMeritScore,
  isInterviewWaivable,
  shouldAutoAdmitPlacementStudent,
} from "@/modules/admissions/services/placement-validation.service";

describe("Placement format validators", () => {
  it("accepts 6+ alphanumeric enrollment codes", () => {
    expect(validateEnrollmentCodeFormat("ABC123")).toBe(true);
    expect(validateEnrollmentCodeFormat("ENCODE999999")).toBe(true);
  });

  it("rejects short, empty, or non-alphanumeric enrollment codes", () => {
    expect(validateEnrollmentCodeFormat("AB12")).toBe(false);
    expect(validateEnrollmentCodeFormat("")).toBe(false);
    expect(validateEnrollmentCodeFormat(null)).toBe(false);
    expect(validateEnrollmentCodeFormat("EN-2026-12")).toBe(false);
  });

  it("accepts 10-digit BECE index (no separators)", () => {
    expect(validateBECEIndexFormat("0120045067")).toBe(true);
    expect(validateBECEIndexFormat("1234567890")).toBe(true);
  });

  it("accepts 12-digit BECE index with 2-digit year prefix", () => {
    expect(validateBECEIndexFormat("250120045067")).toBe(true);
    expect(validateBECEIndexFormat("261234567890")).toBe(true);
  });

  it("rejects malformed BECE indexes", () => {
    expect(validateBECEIndexFormat("012-0045-067")).toBe(false);
    expect(validateBECEIndexFormat("012/0045/067")).toBe(false); // slashes no longer accepted
    expect(validateBECEIndexFormat("123456789")).toBe(false); // 9 digits
    expect(validateBECEIndexFormat("12345678901")).toBe(false); // 11 digits
    expect(validateBECEIndexFormat("1234567890123")).toBe(false); // 13 digits
    expect(validateBECEIndexFormat(undefined)).toBe(false);
  });
});

describe("BECE → merit score mapping", () => {
  it("maps aggregate bands per doc §4.3", () => {
    expect(beceToMeritScore(6)).toBe(10.0);
    expect(beceToMeritScore(10)).toBe(9.5);
    expect(beceToMeritScore(15)).toBe(8.5);
    expect(beceToMeritScore(20)).toBe(7.5);
    expect(beceToMeritScore(25)).toBe(6.5);
    expect(beceToMeritScore(30)).toBe(5.5);
    expect(beceToMeritScore(54)).toBe(4.0);
  });

  it("flags interview as waivable up to aggregate 15", () => {
    expect(isInterviewWaivable(10)).toBe(true);
    expect(isInterviewWaivable(15)).toBe(true);
    expect(isInterviewWaivable(16)).toBe(false);
    expect(isInterviewWaivable(null)).toBe(false);
  });
});

describe("Duplicate enrollment-code detection", () => {
  it("allows when no prior application exists", async () => {
    prismaMock.admissionApplication.findFirst.mockResolvedValue(null as never);
    const res = await checkDuplicateEnrollmentCode("ENROLL123", {
      schoolId: "s1",
      academicYearId: "ay1",
    });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBeUndefined();
  });

  it("blocks when an active application exists", async () => {
    prismaMock.admissionApplication.findFirst.mockResolvedValue({
      applicationNumber: "APP/2026/0001",
      status: "SUBMITTED",
    } as never);
    const res = await checkDuplicateEnrollmentCode("ENROLL123", {
      schoolId: "s1",
      academicYearId: "ay1",
    });
    expect(res.allowed).toBe(false);
    expect(res.existingApplicationNumber).toBe("APP/2026/0001");
  });

  it("allows re-application when prior attempt was withdrawn, with a warning", async () => {
    prismaMock.admissionApplication.findFirst.mockResolvedValue({
      applicationNumber: "APP/2026/0002",
      status: "WITHDRAWN",
    } as never);
    const res = await checkDuplicateEnrollmentCode("ENROLL123", {
      schoolId: "s1",
      academicYearId: "ay1",
    });
    expect(res.allowed).toBe(true);
    expect(res.warning).toContain("WITHDRAWN");
  });

  it("allows re-application after a prior REJECTED attempt", async () => {
    prismaMock.admissionApplication.findFirst.mockResolvedValue({
      applicationNumber: "APP/2026/0003",
      status: "REJECTED",
    } as never);
    const res = await checkDuplicateEnrollmentCode("ENROLL123", {
      schoolId: "s1",
      academicYearId: "ay1",
    });
    expect(res.allowed).toBe(true);
  });
});

describe("validatePlacement (full pipeline)", () => {
  it("collects format errors for missing code + bad BECE index", async () => {
    prismaMock.admissionApplication.findFirst.mockResolvedValue(null as never);
    const res = await validatePlacement({
      enrollmentCode: "",
      beceIndexNumber: "12-345-67",
      schoolId: "s1",
      academicYearId: "ay1",
    });
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("passes when formats valid and no duplicate", async () => {
    prismaMock.admissionApplication.findFirst.mockResolvedValue(null as never);
    const res = await validatePlacement({
      enrollmentCode: "ABC123XYZ",
      beceIndexNumber: "0120045067",
      schoolId: "s1",
      academicYearId: "ay1",
    });
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it("fails when duplicate active application exists", async () => {
    prismaMock.admissionApplication.findFirst.mockResolvedValue({
      applicationNumber: "APP/2026/0010",
      status: "ACCEPTED",
    } as never);
    const res = await validatePlacement({
      enrollmentCode: "ABC123XYZ",
      beceIndexNumber: "0120045067",
      schoolId: "s1",
      academicYearId: "ay1",
    });
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("APP/2026/0010");
  });
});

describe("shouldAutoAdmitPlacementStudent", () => {
  const baseline = {
    isPlacementStudent: true,
    placementVerified: true,
    beceAggregate: 8,
    documentsComplete: true,
    hasCapacity: true,
  };

  it("admits when all conditions met", () => {
    expect(shouldAutoAdmitPlacementStudent(baseline).admit).toBe(true);
  });

  it("rejects when not placement", () => {
    const res = shouldAutoAdmitPlacementStudent({ ...baseline, isPlacementStudent: false });
    expect(res.admit).toBe(false);
    expect(res.reasons).toContain("not a placement application");
  });

  it("rejects when placement unverified", () => {
    const res = shouldAutoAdmitPlacementStudent({ ...baseline, placementVerified: false });
    expect(res.admit).toBe(false);
  });

  it("rejects when aggregate above 10", () => {
    const res = shouldAutoAdmitPlacementStudent({ ...baseline, beceAggregate: 11 });
    expect(res.admit).toBe(false);
    expect(res.reasons.join(" ")).toMatch(/aggregate 11/);
  });

  it("rejects when aggregate missing", () => {
    const res = shouldAutoAdmitPlacementStudent({ ...baseline, beceAggregate: null });
    expect(res.admit).toBe(false);
  });

  it("rejects when documents incomplete", () => {
    const res = shouldAutoAdmitPlacementStudent({ ...baseline, documentsComplete: false });
    expect(res.admit).toBe(false);
  });

  it("rejects when no capacity", () => {
    const res = shouldAutoAdmitPlacementStudent({ ...baseline, hasCapacity: false });
    expect(res.admit).toBe(false);
  });
});
