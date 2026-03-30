import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  transferStudentAction,
  withdrawStudentAction,
  suspendStudentAction,
  reinstateStudentAction,
} from "@/modules/student/actions/transfer.action";

// ─── transferStudentAction ────────────────────────────────────────

describe("transferStudentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await transferStudentAction({
      studentId: "s1",
      transferDate: "2026-03-01",
      destinationSchool: "Other SHS",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null as never);
    const result = await transferStudentAction({
      studentId: "nonexistent",
      transferDate: "2026-03-01",
      destinationSchool: "Other SHS",
    });
    expect(result).toEqual({ error: "Student not found" });
  });

  it("should reject non-active students", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      status: "SUSPENDED",
    } as never);

    const result = await transferStudentAction({
      studentId: "s1",
      transferDate: "2026-03-01",
      destinationSchool: "Other SHS",
    });
    expect(result).toEqual({ error: "Only active students can be transferred" });
  });

  it("should transfer student successfully via transaction", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      status: "ACTIVE",
    } as never);

    const updatedStudent = { id: "s1", status: "TRANSFERRED" };
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        student: { update: async () => updatedStudent },
        enrollment: { updateMany: async () => ({ count: 1 }) },
        bedAllocation: { updateMany: async () => ({ count: 0 }) },
      });
    });

    const result = await transferStudentAction({
      studentId: "s1",
      transferDate: "2026-03-01",
      destinationSchool: "Other SHS",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof updatedStudent }).data.status).toBe("TRANSFERRED");
  });
});

// ─── withdrawStudentAction ────────────────────────────────────────

describe("withdrawStudentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await withdrawStudentAction({
      studentId: "s1",
      withdrawalDate: "2026-03-01",
      reason: "Relocation",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null as never);
    const result = await withdrawStudentAction({
      studentId: "nonexistent",
      withdrawalDate: "2026-03-01",
      reason: "Relocation",
    });
    expect(result).toEqual({ error: "Student not found" });
  });

  it("should reject students that cannot be withdrawn", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      status: "TRANSFERRED",
    } as never);

    const result = await withdrawStudentAction({
      studentId: "s1",
      withdrawalDate: "2026-03-01",
      reason: "Relocation",
    });
    expect(result).toEqual({ error: "Student cannot be withdrawn from current status" });
  });

  it("should allow withdrawal of active students", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      status: "ACTIVE",
    } as never);

    const updatedStudent = { id: "s1", status: "WITHDRAWN" };
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        student: { update: async () => updatedStudent },
        enrollment: { updateMany: async () => ({ count: 1 }) },
        bedAllocation: { updateMany: async () => ({ count: 0 }) },
      });
    });

    const result = await withdrawStudentAction({
      studentId: "s1",
      withdrawalDate: "2026-03-01",
      reason: "Relocation",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof updatedStudent }).data.status).toBe("WITHDRAWN");
  });

  it("should allow withdrawal of suspended students", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      status: "SUSPENDED",
    } as never);

    const updatedStudent = { id: "s1", status: "WITHDRAWN" };
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        student: { update: async () => updatedStudent },
        enrollment: { updateMany: async () => ({ count: 1 }) },
        bedAllocation: { updateMany: async () => ({ count: 0 }) },
      });
    });

    const result = await withdrawStudentAction({
      studentId: "s1",
      withdrawalDate: "2026-03-01",
      reason: "Disciplinary",
    });
    expect(result).toHaveProperty("data");
  });
});

// ─── suspendStudentAction ─────────────────────────────────────────

describe("suspendStudentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await suspendStudentAction({
      studentId: "s1",
      reason: "Misconduct",
      startDate: "2026-03-01",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null as never);
    const result = await suspendStudentAction({
      studentId: "nonexistent",
      reason: "Misconduct",
      startDate: "2026-03-01",
    });
    expect(result).toEqual({ error: "Student not found" });
  });

  it("should reject non-active students", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      status: "SUSPENDED",
    } as never);

    const result = await suspendStudentAction({
      studentId: "s1",
      reason: "Misconduct",
      startDate: "2026-03-01",
    });
    expect(result).toEqual({ error: "Only active students can be suspended" });
  });

  it("should suspend student successfully", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      status: "ACTIVE",
    } as never);

    const updated = { id: "s1", status: "SUSPENDED" };
    prismaMock.student.update.mockResolvedValue(updated as never);

    const result = await suspendStudentAction({
      studentId: "s1",
      reason: "Misconduct",
      startDate: "2026-03-01",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof updated }).data.status).toBe("SUSPENDED");
    expect(prismaMock.student.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "SUSPENDED" },
    });
  });
});

// ─── reinstateStudentAction ───────────────────────────────────────

describe("reinstateStudentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await reinstateStudentAction({ studentId: "s1" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null as never);
    const result = await reinstateStudentAction({ studentId: "nonexistent" });
    expect(result).toEqual({ error: "Student not found" });
  });

  it("should reject non-suspended students", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      status: "ACTIVE",
    } as never);

    const result = await reinstateStudentAction({ studentId: "s1" });
    expect(result).toEqual({ error: "Only suspended students can be reinstated" });
  });

  it("should reinstate suspended student successfully", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentId: "SCH/2026/0001",
      status: "SUSPENDED",
    } as never);

    const updated = { id: "s1", status: "ACTIVE" };
    prismaMock.student.update.mockResolvedValue(updated as never);

    const result = await reinstateStudentAction({ studentId: "s1" });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof updated }).data.status).toBe("ACTIVE");
    expect(prismaMock.student.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "ACTIVE" },
    });
  });
});
