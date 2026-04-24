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
    const allowedNonRead = [
      PERMISSIONS.PTC_BOOK,
      PERMISSIONS.MESSAGING_PORTAL_USE,
      PERMISSIONS.MESSAGING_REPORT,
      PERMISSIONS.EXCUSE_SUBMIT,
      PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT,
      PERMISSIONS.CIRCULAR_ACKNOWLEDGE,
    ];
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
      PERMISSIONS.HOUSEHOLDS_READ,
      PERMISSIONS.MEDICAL_CREATE,
      PERMISSIONS.MEDICAL_READ,
      PERMISSIONS.MEDICAL_UPDATE,
      PERMISSIONS.MEDICAL_CONFIDENTIAL_READ,
      PERMISSIONS.ANNOUNCEMENTS_READ,
      PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW,
    ]));
    expect(bundle).toHaveLength(8);
  });

  it("households permissions are granted to the expected roles", () => {
    // HOUSEHOLDS_READ should be granted anywhere STUDENTS_READ is granted
    for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
      if (role === "super_admin") continue; // inherits ALL_PERMISSIONS
      const bundle = DEFAULT_ROLE_PERMISSIONS[role];
      if (bundle.includes(PERMISSIONS.STUDENTS_READ)) {
        expect(bundle).toContain(PERMISSIONS.HOUSEHOLDS_READ);
      }
    }

    // HOUSEHOLDS_MANAGE
    for (const role of ["headmaster", "assistant_headmaster_academic", "assistant_headmaster_admin", "admissions_officer"]) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.HOUSEHOLDS_MANAGE);
    }

    // GUARDIANS_MERGE
    for (const role of ["headmaster", "assistant_headmaster_admin"]) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.GUARDIANS_MERGE);
    }

    // Negative: guidance_counsellor should NOT have GUARDIANS_MERGE
    expect(DEFAULT_ROLE_PERMISSIONS.guidance_counsellor).not.toContain(PERMISSIONS.GUARDIANS_MERGE);
  });

  it("messaging permissions are granted to the expected roles", () => {
    for (const role of ["parent", "class_teacher", "housemaster"]) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.MESSAGING_PORTAL_USE);
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.MESSAGING_REPORT);
    }
    for (const role of ["headmaster", "assistant_headmaster_academic", "assistant_headmaster_admin"]) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.MESSAGING_ADMIN_READ);
    }
    for (const role of ["headmaster", "assistant_headmaster_admin"]) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.MESSAGING_ADMIN_REVIEW);
    }
    // Negative: parent must NOT have MESSAGING_ADMIN_*
    expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.MESSAGING_ADMIN_READ);
    expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.MESSAGING_ADMIN_REVIEW);
    // Negative: guidance_counsellor (not a thread participant) must NOT have MESSAGING_PORTAL_USE
    expect(DEFAULT_ROLE_PERMISSIONS.guidance_counsellor).not.toContain(PERMISSIONS.MESSAGING_PORTAL_USE);
  });

  it("parent-request permissions are granted to the expected roles", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.parent).toContain(PERMISSIONS.EXCUSE_SUBMIT);
    expect(DEFAULT_ROLE_PERMISSIONS.parent).toContain(PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT);
    for (const role of ["class_teacher", "housemaster"]) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.EXCUSE_REVIEW);
    }
    expect(DEFAULT_ROLE_PERMISSIONS.school_nurse).toContain(PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);

    // Negative
    expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.EXCUSE_REVIEW);
    expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
    expect(DEFAULT_ROLE_PERMISSIONS.class_teacher).not.toContain(PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
    expect(DEFAULT_ROLE_PERMISSIONS.school_nurse).not.toContain(PERMISSIONS.EXCUSE_REVIEW);
  });

  it("circular-acknowledgement permissions are granted to the expected roles", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.parent).toContain(PERMISSIONS.CIRCULAR_ACKNOWLEDGE);

    for (const role of ["headmaster", "assistant_headmaster_academic", "assistant_headmaster_admin"]) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK);
    }

    // Negative
    expect(DEFAULT_ROLE_PERMISSIONS.parent).not.toContain(PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK);
    expect(DEFAULT_ROLE_PERMISSIONS.class_teacher).not.toContain(PERMISSIONS.CIRCULAR_ACKNOWLEDGE);
    expect(DEFAULT_ROLE_PERMISSIONS.class_teacher).not.toContain(PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK);
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
