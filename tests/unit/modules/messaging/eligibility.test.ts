import { describe, it, expect } from "vitest";
import {
  eligibleStaffRole,
  parentCanMessageAbout,
  eligibleTeachersForStudent,
  isRateLimited,
  type StudentContext,
  type StaffAssignment,
  type GuardianLink,
} from "@/modules/messaging/eligibility";

const activeBoarder: StudentContext = {
  id: "s1",
  schoolId: "school-1",
  status: "ACTIVE",
  boardingStatus: "BOARDING",
  classArmId: "arm-1",
  houseId: "house-1",
};
const activeDay: StudentContext = { ...activeBoarder, boardingStatus: "DAY", houseId: null };
const withdrawnStudent: StudentContext = { ...activeBoarder, status: "WITHDRAWN" };
const suspendedStudent: StudentContext = { ...activeBoarder, status: "SUSPENDED" };

describe("eligibleStaffRole", () => {
  it("returns 'class_teacher' when staff is class teacher of the student's arm", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBe("class_teacher");
  });

  it("returns null when class teacher is of a different arm", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-9" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBeNull();
  });

  it("returns 'housemaster' for a housemaster of a matching boarding student's house", () => {
    const staff: StaffAssignment = { userId: "u2", role: "housemaster", houseId: "house-1" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBe("housemaster");
  });

  it("returns null for a housemaster when the student is a DAY student", () => {
    const staff: StaffAssignment = { userId: "u2", role: "housemaster", houseId: "house-1" };
    expect(eligibleStaffRole(staff, activeDay)).toBeNull();
  });

  it("returns null when the student is WITHDRAWN regardless of role", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(eligibleStaffRole(staff, withdrawnStudent)).toBeNull();
  });

  it("returns 'class_teacher' when the student is SUSPENDED (messaging allowed during suspension)", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher", classArmId: "arm-1" };
    expect(eligibleStaffRole(staff, suspendedStudent)).toBe("class_teacher");
  });

  it("returns null for subject_teacher (MVP excludes)", () => {
    const staff: StaffAssignment = { userId: "u3", role: "subject_teacher" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBeNull();
  });

  it("returns null when class teacher has no classArmId assignment", () => {
    const staff: StaffAssignment = { userId: "u1", role: "class_teacher" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBeNull();
  });

  it("returns null when housemaster has no houseId assignment", () => {
    const staff: StaffAssignment = { userId: "u2", role: "housemaster" };
    expect(eligibleStaffRole(staff, activeBoarder)).toBeNull();
  });
});

describe("parentCanMessageAbout", () => {
  const links: GuardianLink[] = [
    { userId: "user-parent-A", studentId: "s1", householdId: "hh-1" },
    { userId: "user-parent-A", studentId: "s2", householdId: "hh-1" },
    { userId: "user-parent-B", studentId: "s1", householdId: "hh-1" },
  ];

  it("returns true when there's a link for (userId, studentId)", () => {
    expect(parentCanMessageAbout(links, "user-parent-A", "s1")).toBe(true);
    expect(parentCanMessageAbout(links, "user-parent-A", "s2")).toBe(true);
    expect(parentCanMessageAbout(links, "user-parent-B", "s1")).toBe(true);
  });

  it("returns false when no link exists", () => {
    expect(parentCanMessageAbout(links, "user-parent-B", "s2")).toBe(false);
    expect(parentCanMessageAbout(links, "user-other", "s1")).toBe(false);
  });

  it("returns false for an empty links list", () => {
    expect(parentCanMessageAbout([], "user-parent-A", "s1")).toBe(false);
  });
});

describe("eligibleTeachersForStudent", () => {
  it("returns only staff that match eligibility rules", () => {
    const assignments: StaffAssignment[] = [
      { userId: "u1", role: "class_teacher", classArmId: "arm-1" },
      { userId: "u2", role: "housemaster", houseId: "house-1" },
      { userId: "u3", role: "class_teacher", classArmId: "arm-9" },
      { userId: "u4", role: "subject_teacher" },
    ];
    const eligible = eligibleTeachersForStudent(activeBoarder, assignments);
    expect(eligible.map((a) => a.userId).sort()).toEqual(["u1", "u2"]);
  });

  it("returns empty when no assignment matches", () => {
    expect(eligibleTeachersForStudent(activeDay, [
      { userId: "u2", role: "housemaster", houseId: "house-1" },
    ])).toEqual([]);
  });
});

describe("isRateLimited", () => {
  const now = new Date("2026-04-23T12:00:00Z");

  it("returns false below the limit", () => {
    const timestamps = Array.from({ length: 9 }, (_, i) =>
      new Date(now.getTime() - (i + 1) * 60_000),
    );
    expect(isRateLimited(timestamps, now)).toBe(false);
  });

  it("returns true at the limit (10)", () => {
    const timestamps = Array.from({ length: 10 }, (_, i) =>
      new Date(now.getTime() - (i + 1) * 60_000),
    );
    expect(isRateLimited(timestamps, now)).toBe(true);
  });

  it("ignores timestamps older than the window", () => {
    const timestamps = Array.from({ length: 10 }, (_, i) =>
      new Date(now.getTime() - (i + 1) * 60 * 60_000),
    );
    expect(isRateLimited(timestamps, now)).toBe(false);
  });

  it("respects a custom window and limit", () => {
    const timestamps = [
      new Date(now.getTime() - 2 * 60_000),
      new Date(now.getTime() - 3 * 60_000),
    ];
    expect(isRateLimited(timestamps, now, 5 * 60_000, 2)).toBe(true);
    expect(isRateLimited(timestamps, now, 5 * 60_000, 3)).toBe(false);
  });
});
