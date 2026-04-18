import { describe, it, expect } from "vitest";
import {
  resolveDecisionAuthority,
  computeInterviewTotal,
} from "@/modules/admissions/services/decision-authority.service";
import { PERMISSIONS } from "@/lib/permissions";

describe("resolveDecisionAuthority", () => {
  it("auto-accepts when interview score ≥ 9.0", () => {
    const r = resolveDecisionAuthority({ decision: "ACCEPTED", score: 9.2 });
    expect(r.autoApproved).toBe(true);
    expect(r.requiredPermission).toBeNull();
  });

  it("auto-accepts verified placement student with BECE aggregate ≤ 10", () => {
    const r = resolveDecisionAuthority({
      decision: "ACCEPTED",
      isPlacementStudent: true,
      beceAggregate: 8,
    });
    expect(r.autoApproved).toBe(true);
    expect(r.requiredPermission).toBeNull();
  });

  it("requires ADMISSIONS_APPROVE for standard accept with score 6–8.9", () => {
    const r = resolveDecisionAuthority({ decision: "ACCEPTED", score: 7.5 });
    expect(r.autoApproved).toBe(false);
    expect(r.requiredPermission).toBe(PERMISSIONS.ADMISSIONS_APPROVE);
  });

  it("requires ADMISSIONS_APPROVE for waitlist", () => {
    const r = resolveDecisionAuthority({ decision: "WAITLISTED", score: 6.5 });
    expect(r.requiredPermission).toBe(PERMISSIONS.ADMISSIONS_APPROVE);
  });

  it("requires ADMISSIONS_OVERRIDE for conditional accept", () => {
    const r = resolveDecisionAuthority({ decision: "CONDITIONAL_ACCEPT", score: 5.5 });
    expect(r.requiredPermission).toBe(PERMISSIONS.ADMISSIONS_OVERRIDE);
  });

  it("requires ADMISSIONS_OVERRIDE for rejection", () => {
    const r = resolveDecisionAuthority({ decision: "REJECTED", score: 4.0 });
    expect(r.requiredPermission).toBe(PERMISSIONS.ADMISSIONS_OVERRIDE);
  });

  it("does not auto-accept placement student with aggregate > 10", () => {
    const r = resolveDecisionAuthority({
      decision: "ACCEPTED",
      isPlacementStudent: true,
      beceAggregate: 12,
    });
    expect(r.autoApproved).toBe(false);
    expect(r.requiredPermission).toBe(PERMISSIONS.ADMISSIONS_APPROVE);
  });
});

describe("computeInterviewTotal", () => {
  it("computes weighted total per doc §4.3", () => {
    // 10 * 0.4 + 8 * 0.35 + 6 * 0.25 = 4.0 + 2.8 + 1.5 = 8.3
    const total = computeInterviewTotal({ academic: 10, behavioral: 8, parent: 6 });
    expect(total).toBe(8.3);
  });

  it("rounds to 2 decimal places", () => {
    const total = computeInterviewTotal({ academic: 7, behavioral: 7, parent: 7 });
    expect(total).toBe(7);
  });

  it("produces 10 for a perfect interview", () => {
    expect(
      computeInterviewTotal({ academic: 10, behavioral: 10, parent: 10 }),
    ).toBe(10);
  });

  it("produces 0 for all-zero scores", () => {
    expect(
      computeInterviewTotal({ academic: 0, behavioral: 0, parent: 0 }),
    ).toBe(0);
  });
});
