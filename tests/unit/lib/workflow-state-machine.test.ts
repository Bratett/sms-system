import { describe, it, expect } from "vitest";
import {
  resolveTransition,
  legalEvents,
  WorkflowTransitionError,
} from "@/lib/workflow/state-machine";
import type { WorkflowDefinition } from "@/lib/workflow/types";

interface TestEntity {
  id: string;
  kind: "standard" | "priority";
}

const def: WorkflowDefinition<TestEntity> = {
  key: "test",
  version: 1,
  entityType: "TestEntity",
  initialState: "DRAFT",
  states: ["DRAFT", "REVIEW", "APPROVED", "REJECTED", "CANCELLED"],
  terminalStates: ["APPROVED", "REJECTED", "CANCELLED"],
  transitions: [
    { event: "SUBMIT", from: "DRAFT", to: "REVIEW" },
    {
      event: "APPROVE",
      from: "REVIEW",
      to: "APPROVED",
      allowedRoles: ["manager"],
    },
    {
      event: "APPROVE",
      from: "DRAFT",
      to: "APPROVED",
      allowedRoles: ["manager"],
      guard: ({ entity }) =>
        entity.kind === "priority" ? true : "Only priority items skip review.",
    },
    { event: "REJECT", from: ["DRAFT", "REVIEW"], to: "REJECTED" },
    { event: "CANCEL", from: ["DRAFT", "REVIEW"], to: "CANCELLED" },
  ],
};

const actor = { userId: "u1", role: "manager" };

describe("workflow/state-machine", () => {
  it("resolves a simple transition", () => {
    const r = resolveTransition(def, "DRAFT", "SUBMIT", {
      entity: { id: "e1", kind: "standard" },
      actor: { userId: "u1" },
    });
    expect(r.toState).toBe("REVIEW");
  });

  it("rejects unknown events", () => {
    expect(() =>
      resolveTransition(def, "DRAFT", "BOGUS", {
        entity: { id: "e1", kind: "standard" },
        actor,
      }),
    ).toThrow(WorkflowTransitionError);
  });

  it("rejects events not firable from current state", () => {
    expect(() =>
      resolveTransition(def, "APPROVED", "SUBMIT", {
        entity: { id: "e1", kind: "standard" },
        actor,
      }),
    ).toThrow(/terminal state/);
  });

  it("enforces allowedRoles", () => {
    expect(() =>
      resolveTransition(def, "REVIEW", "APPROVE", {
        entity: { id: "e1", kind: "standard" },
        actor: { userId: "u1", role: "clerk" },
      }),
    ).toThrow(/not permitted/);
  });

  it("applies guards and surfaces their messages", () => {
    expect(() =>
      resolveTransition(def, "DRAFT", "APPROVE", {
        entity: { id: "e1", kind: "standard" },
        actor,
      }),
    ).toThrow(/Only priority items skip review./);
  });

  it("accepts guard-satisfying entities", () => {
    const r = resolveTransition(def, "DRAFT", "APPROVE", {
      entity: { id: "e1", kind: "priority" },
      actor,
    });
    expect(r.toState).toBe("APPROVED");
  });

  it("refuses transitions from terminal states", () => {
    expect(() =>
      resolveTransition(def, "REJECTED", "SUBMIT", {
        entity: { id: "e1", kind: "standard" },
        actor,
      }),
    ).toThrow(/terminal state/);
  });

  it("disambiguates transitions that share an event but differ on from-state", () => {
    const r = resolveTransition(def, "REVIEW", "APPROVE", {
      entity: { id: "e1", kind: "standard" },
      actor,
    });
    expect(r.toState).toBe("APPROVED");
  });

  it("legalEvents lists events legal from a non-terminal state", () => {
    expect(new Set(legalEvents(def, "DRAFT"))).toEqual(
      new Set(["SUBMIT", "APPROVE", "REJECT", "CANCEL"]),
    );
  });

  it("legalEvents returns empty for terminal states", () => {
    expect(legalEvents(def, "APPROVED")).toEqual([]);
  });
});
