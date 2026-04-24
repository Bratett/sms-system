import { describe, it, expect } from "vitest";
import {
  isWithinRetroactiveWindow,
  isValidDateRange,
  canReviewExcuse,
} from "@/modules/parent-requests/eligibility";
import type {
  StudentContext,
  StaffAssignment,
} from "@/modules/messaging/eligibility";

const now = new Date("2026-04-24T12:00:00Z");

const activeBoarder: StudentContext = {
  id: "s1",
  schoolId: "school-1",
  status: "ACTIVE",
  boardingStatus: "BOARDING",
  classArmId: "arm-1",
  houseId: "house-1",
};
const activeDay: StudentContext = { ...activeBoarder, boardingStatus: "DAY", houseId: null };
const withdrawn: StudentContext = { ...activeBoarder, status: "WITHDRAWN" };
const suspended: StudentContext = { ...activeBoarder, status: "SUSPENDED" };

describe("isWithinRetroactiveWindow", () => {
  it("returns true for today", () => {
    expect(isWithinRetroactiveWindow(now, now)).toBe(true);
  });

  it("returns true for exactly 14 days ago (inclusive)", () => {
    const d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    expect(isWithinRetroactiveWindow(d, now)).toBe(true);
  });

  it("returns false for 15 days ago", () => {
    const d = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    expect(isWithinRetroactiveWindow(d, now)).toBe(false);
  });

  it("returns false for future dates", () => {
    const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    expect(isWithinRetroactiveWindow(d, now)).toBe(false);
  });

  it("respects custom window days", () => {
    const d = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    expect(isWithinRetroactiveWindow(d, now, 3)).toBe(false);
    expect(isWithinRetroactiveWindow(d, now, 7)).toBe(true);
  });
});

describe("isValidDateRange", () => {
  it("returns true when fromDate === toDate", () => {
    const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(isValidDateRange(d, d, now)).toBe(true);
  });

  it("returns true when fromDate < toDate", () => {
    const a = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const b = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    expect(isValidDateRange(a, b, now)).toBe(true);
  });

  it("returns false when fromDate > toDate", () => {
    const a = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const b = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(isValidDateRange(a, b, now)).toBe(false);
  });

  it("returns false when toDate is in the future", () => {
    const a = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const b = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    expect(isValidDateRange(a, b, now)).toBe(false);
  });
});

describe("canReviewExcuse", () => {
  it("class_teacher of matching arm can review", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(canReviewExcuse(staff, activeBoarder)).toBe(true);
  });

  it("class_teacher of different arm cannot", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-9" };
    expect(canReviewExcuse(staff, activeBoarder)).toBe(false);
  });

  it("housemaster for BOARDING student can review", () => {
    const staff: StaffAssignment = { userId: "u2", role: "housemaster", houseId: "house-1" };
    expect(canReviewExcuse(staff, activeBoarder)).toBe(true);
  });

  it("housemaster for DAY student cannot", () => {
    const staff: StaffAssignment = { userId: "u2", role: "housemaster", houseId: "house-1" };
    expect(canReviewExcuse(staff, activeDay)).toBe(false);
  });

  it("class_teacher cannot review WITHDRAWN student", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(canReviewExcuse(staff, withdrawn)).toBe(false);
  });

  it("class_teacher can review SUSPENDED student", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(canReviewExcuse(staff, suspended)).toBe(true);
  });
});
