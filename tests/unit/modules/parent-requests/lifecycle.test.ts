import { describe, it, expect } from "vitest";
import { prismaMock } from "../../setup";
import { cancelPendingRequestsForStudent } from "@/modules/parent-requests/lifecycle";

describe("cancelPendingRequestsForStudent", () => {
  it("updates both tables to WITHDRAWN and stamps a system note", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.excuseRequest.updateMany.mockResolvedValue({ count: 2 } as never);
    prismaMock.medicalDisclosure.updateMany.mockResolvedValue({ count: 1 } as never);

    await cancelPendingRequestsForStudent("s-1");

    expect(prismaMock.excuseRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "s-1", status: "PENDING" },
        data: expect.objectContaining({
          status: "WITHDRAWN",
          reviewNote: expect.stringMatching(/auto-cancelled/i),
        }),
      }),
    );
    expect(prismaMock.medicalDisclosure.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "s-1", status: "PENDING" },
        data: expect.objectContaining({
          status: "WITHDRAWN",
          reviewNote: expect.stringMatching(/auto-cancelled/i),
        }),
      }),
    );
  });

  it("does not throw when counts are zero", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.excuseRequest.updateMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.medicalDisclosure.updateMany.mockResolvedValue({ count: 0 } as never);

    await expect(cancelPendingRequestsForStudent("s-1")).resolves.toBeUndefined();
  });
});
