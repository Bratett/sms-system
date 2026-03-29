import { describe, it, expect } from "vitest";
import {
  getCutoffDate,
  getActivePolicies,
  RETENTION_POLICIES,
  type RetentionPolicy,
} from "@/lib/retention/policy";

describe("Retention Policy — getCutoffDate", () => {
  it("should return correct date for given retention days", () => {
    const days = 90;
    const before = new Date();
    before.setDate(before.getDate() - days);

    const cutoff = getCutoffDate(days);

    // Allow 1 second tolerance for test execution time
    expect(Math.abs(cutoff.getTime() - before.getTime())).toBeLessThan(1000);
  });

  it("should return a date in the past", () => {
    const cutoff = getCutoffDate(30);
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });

  it("should return further back for larger retention days", () => {
    const short = getCutoffDate(30);
    const long = getCutoffDate(365);
    expect(long.getTime()).toBeLessThan(short.getTime());
  });
});

describe("Retention Policy — getActivePolicies", () => {
  it("should return all defined policies", () => {
    const policies = getActivePolicies();
    expect(policies).toEqual(RETENTION_POLICIES);
    expect(policies.length).toBeGreaterThan(0);
  });

  it("should return the same array reference as RETENTION_POLICIES", () => {
    const policies = getActivePolicies();
    expect(policies).toBe(RETENTION_POLICIES);
  });
});

describe("Retention Policy — policy structure", () => {
  it("should have required fields on each policy", () => {
    for (const policy of RETENTION_POLICIES) {
      expect(policy).toHaveProperty("entity");
      expect(policy).toHaveProperty("model");
      expect(policy).toHaveProperty("dateField");
      expect(policy).toHaveProperty("action");
      expect(policy).toHaveProperty("retentionDays");
      expect(policy).toHaveProperty("description");

      // Validate types
      expect(typeof policy.entity).toBe("string");
      expect(typeof policy.model).toBe("string");
      expect(typeof policy.dateField).toBe("string");
      expect(["delete", "archive", "anonymize"]).toContain(policy.action);
      expect(typeof policy.retentionDays).toBe("number");
      expect(policy.retentionDays).toBeGreaterThan(0);
    }
  });

  it("should not target critical models (TerminalResult, Payment, Student)", () => {
    const criticalModels = [
      "terminalResult",
      "TerminalResult",
      "payment",
      "Payment",
      "student",
      "Student",
      "subjectResult",
      "SubjectResult",
      "transcript",
      "Transcript",
      "studentBill",
      "StudentBill",
      "receipt",
      "Receipt",
    ];

    for (const policy of RETENTION_POLICIES) {
      expect(criticalModels).not.toContain(policy.model);
    }
  });

  it("should have unique entity names", () => {
    const entities = RETENTION_POLICIES.map((p) => p.entity);
    const unique = new Set(entities);
    expect(unique.size).toBe(entities.length);
  });
});
