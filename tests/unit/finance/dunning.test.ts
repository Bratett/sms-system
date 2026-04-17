import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createDunningPolicyAction,
  updateDunningPolicyAction,
  deleteDunningPolicyAction,
  listDunningPoliciesAction,
  runDunningPolicyAction,
  closeDunningCaseAction,
} from "@/modules/finance/actions/dunning.action";

const basePolicy = {
  name: "Standard Ladder",
  scope: "ALL_OUTSTANDING" as const,
  minBalance: 0,
  suppressOnInstallment: true,
  suppressOnAid: true,
  isActive: true,
  stages: [
    { order: 1, name: "Reminder", daysOverdue: 7, channels: ["sms"] as ("sms" | "email" | "in_app")[], blockPortal: false },
    { order: 2, name: "Warning", daysOverdue: 14, channels: ["sms", "email"] as ("sms" | "email" | "in_app")[], blockPortal: false },
  ],
};

describe("Dunning policy actions", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const res = await listDunningPoliciesAction();
    expect(res).toEqual({ error: "Unauthorized" });
  });

  it("validates required stages", async () => {
    const res = await createDunningPolicyAction({ ...basePolicy, stages: [] } as never);
    expect("error" in res && res.error).toBe("Invalid input");
  });

  it("enforces unique stage order", async () => {
    const res = await createDunningPolicyAction({
      ...basePolicy,
      stages: [
        { order: 1, name: "A", daysOverdue: 7, channels: ["sms"], blockPortal: false },
        { order: 1, name: "B", daysOverdue: 14, channels: ["sms"], blockPortal: false },
      ],
    });
    expect("error" in res && res.error).toBe("Invalid input");
  });

  it("requires programmeId when scope=PROGRAMME", async () => {
    const res = await createDunningPolicyAction({
      ...basePolicy,
      scope: "PROGRAMME",
    });
    expect("error" in res && res.error).toBe("Invalid input");
  });

  it("creates a policy with stages in a single transaction", async () => {
    const created = { id: "pol-1", ...basePolicy, schoolId: "default-school" };
    prismaMock.dunningPolicy.create.mockResolvedValue(created as never);
    prismaMock.dunningStage.createMany.mockResolvedValue({ count: 2 } as never);

    const res = await createDunningPolicyAction(basePolicy);
    expect("data" in res).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("updates a policy and replaces stages when provided", async () => {
    prismaMock.dunningPolicy.findFirst.mockResolvedValue({ id: "pol-1", schoolId: "default-school" } as never);
    prismaMock.dunningPolicy.update.mockResolvedValue({ id: "pol-1", name: "Renamed" } as never);
    prismaMock.dunningStage.deleteMany.mockResolvedValue({ count: 2 } as never);
    prismaMock.dunningStage.createMany.mockResolvedValue({ count: 2 } as never);

    const res = await updateDunningPolicyAction({ id: "pol-1", name: "Renamed", stages: basePolicy.stages });
    expect("data" in res).toBe(true);
  });

  it("refuses delete when the policy belongs to a different tenant", async () => {
    prismaMock.dunningPolicy.findFirst.mockResolvedValue(null);
    const res = await deleteDunningPolicyAction("pol-other");
    expect(res.error).toBe("Policy not found");
  });

  it("runDunningPolicyAction surfaces engine errors gracefully", async () => {
    prismaMock.dunningPolicy.findFirst.mockResolvedValue({ id: "pol-1" } as never);
    prismaMock.dunningPolicy.findUnique.mockResolvedValue(null as never);
    const res = await runDunningPolicyAction({ policyId: "pol-1", triggerType: "MANUAL", dryRun: true });
    expect(res.error).toBeDefined();
  });

  it("closes a dunning case with a resolution note", async () => {
    prismaMock.dunningCase.findFirst.mockResolvedValue({ id: "case-1", schoolId: "default-school" } as never);
    prismaMock.dunningCase.update.mockResolvedValue({ id: "case-1", status: "CLOSED" } as never);
    const res = await closeDunningCaseAction("case-1", "paid in full");
    expect("data" in res).toBe(true);
  });
});

describe("Dunning engine helpers", () => {
  it("daysBetween counts full days only", async () => {
    const { __test__ } = await import("@/lib/finance/dunning-engine");
    expect(__test__.daysBetween(new Date("2026-01-01"), new Date("2026-01-08"))).toBe(7);
    expect(__test__.daysBetween(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-01T23:59:59Z"))).toBe(0);
  });

  it("computePenaltyAmount applies percentage and respects cap", async () => {
    const { __test__ } = await import("@/lib/finance/dunning-engine");
    const rule = { type: "PERCENTAGE", value: 10, maxPenalty: 50 };
    const bill = { balanceAmount: 1000 } as never;
    const amount = __test__.computePenaltyAmount(rule as never, bill);
    expect(amount).toBe(50); // 10% of 1000 = 100, capped at 50
  });

  it("computePenaltyAmount handles fixed amount without cap", async () => {
    const { __test__ } = await import("@/lib/finance/dunning-engine");
    const rule = { type: "FIXED_AMOUNT", value: 25, maxPenalty: null };
    const bill = { balanceAmount: 300 } as never;
    expect(__test__.computePenaltyAmount(rule as never, bill)).toBe(25);
  });
});
