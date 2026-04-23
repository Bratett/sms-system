import { describe, it, expect } from "vitest";
import { PERMISSIONS, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

describe("Permissions", () => {
  it("should have unique permission codes", () => {
    const codes = Object.values(PERMISSIONS);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it("should have permission codes in module:action format", () => {
    for (const [key, code] of Object.entries(PERMISSIONS)) {
      const parts = code.split(":");
      expect(parts.length).toBeGreaterThanOrEqual(
        2,
        `Permission ${key} = "${code}" is not in module:action format`,
      );
    }
  });

  it("ALL_PERMISSIONS should contain every permission value", () => {
    const values = Object.values(PERMISSIONS);
    expect(ALL_PERMISSIONS).toHaveLength(values.length);
    for (const v of values) {
      expect(ALL_PERMISSIONS).toContain(v);
    }
  });
});

describe("Role-Permission Mappings", () => {
  it("super_admin should have all permissions", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.super_admin).toEqual(ALL_PERMISSIONS);
  });

  it("every role should only reference valid permissions", () => {
    const validCodes = new Set(Object.values(PERMISSIONS));
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const perm of perms) {
        expect(validCodes.has(perm)).toBe(true, `Role "${role}" has invalid permission: "${perm}"`);
      }
    }
  });

  it("headmaster should have academic, finance, and admin permissions", () => {
    const headmaster = DEFAULT_ROLE_PERMISSIONS.headmaster;
    expect(headmaster).toContain(PERMISSIONS.SCHOOL_SETTINGS_READ);
    expect(headmaster).toContain(PERMISSIONS.STUDENTS_READ);
    expect(headmaster).toContain(PERMISSIONS.MARKS_APPROVE);
    expect(headmaster).toContain(PERMISSIONS.FEE_STRUCTURES_APPROVE);
    expect(headmaster).toContain(PERMISSIONS.GRADUATION_APPROVE);
  });

  it("subject_teacher should not have finance permissions", () => {
    const teacher = DEFAULT_ROLE_PERMISSIONS.subject_teacher;
    expect(teacher).not.toContain(PERMISSIONS.FEE_STRUCTURES_CREATE);
    expect(teacher).not.toContain(PERMISSIONS.PAYMENTS_CREATE);
    expect(teacher).not.toContain(PERMISSIONS.BILLING_CREATE);
  });

  it("finance_officer should have billing and payment permissions", () => {
    const finance = DEFAULT_ROLE_PERMISSIONS.finance_officer;
    expect(finance).toContain(PERMISSIONS.BILLING_CREATE);
    expect(finance).toContain(PERMISSIONS.PAYMENTS_CREATE);
    expect(finance).toContain(PERMISSIONS.FEE_STRUCTURES_CREATE);
    expect(finance).toContain(PERMISSIONS.FINANCE_REPORTS_READ);
  });

  it("parent role should be read-only except PTC booking", () => {
    const parent = DEFAULT_ROLE_PERMISSIONS.parent;
    if (!parent) return; // Skip if not defined yet
    const allowedNonRead = [PERMISSIONS.PTC_BOOK];
    for (const perm of parent) {
      const isAllowed = perm.endsWith("read") || allowedNonRead.includes(perm as any);
      expect(isAllowed).toBe(
        true,
        `Parent permission "${perm}" should end with 'read' or be an allowed action`,
      );
    }
  });

  it("student role should be read-only except exeat create and elective selection", () => {
    const student = DEFAULT_ROLE_PERMISSIONS.student;
    if (!student) return;
    const allowedNonRead = [PERMISSIONS.EXEAT_CREATE, PERMISSIONS.ELECTIVE_SELECTION_CREATE];
    for (const perm of student) {
      const isAllowed = perm.endsWith("read") || allowedNonRead.includes(perm as any);
      expect(isAllowed).toBe(
        true,
        `Student permission "${perm}" is not read-only or an allowed action`,
      );
    }
  });

  it("school_nurse role has the expected permission bundle", () => {
    const bundle = DEFAULT_ROLE_PERMISSIONS.school_nurse;
    expect(bundle).toEqual(expect.arrayContaining([
      PERMISSIONS.STUDENTS_READ,
      PERMISSIONS.MEDICAL_CREATE,
      PERMISSIONS.MEDICAL_READ,
      PERMISSIONS.MEDICAL_UPDATE,
      PERMISSIONS.MEDICAL_CONFIDENTIAL_READ,
      PERMISSIONS.ANNOUNCEMENTS_READ,
    ]));
    expect(bundle).toHaveLength(6);
  });

  it("all seeded roles should have permission mappings", () => {
    const expectedRoles = [
      "super_admin",
      "headmaster",
      "finance_officer",
      "assistant_headmaster_academic",
      "assistant_headmaster_admin",
      "hod",
      "class_teacher",
      "subject_teacher",
      "admissions_officer",
      "housemaster",
      "hr_officer",
      "store_keeper",
      "guidance_counsellor",
      "parent",
      "student",
    ];
    for (const role of expectedRoles) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toBeDefined(
        `Role "${role}" has no permission mapping`,
      );
      expect(DEFAULT_ROLE_PERMISSIONS[role].length).toBeGreaterThan(
        0,
        `Role "${role}" has empty permissions`,
      );
    }
  });
});
