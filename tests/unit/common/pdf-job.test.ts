import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import {
  listPdfJobsAction,
  getPdfJobAction,
  cancelPdfJobAction,
} from "@/modules/common/pdf-job.action";

describe("listPdfJobsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns jobs scoped to current school", async () => {
    prismaMock.pdfJob.findMany.mockResolvedValue([
      { id: "job-1", status: "RUNNING", kind: "ID_CARD_BATCH" },
    ] as never);

    const result = await listPdfJobsAction();
    expect(result).toMatchObject({ data: expect.arrayContaining([expect.objectContaining({ id: "job-1" })]) });
    expect(prismaMock.pdfJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ schoolId: "default-school" }),
    }));
  });

  it("applies status + kind filters when provided", async () => {
    prismaMock.pdfJob.findMany.mockResolvedValue([] as never);
    await listPdfJobsAction({ status: "RUNNING", kind: "REPORT_CARD_BATCH" });
    expect(prismaMock.pdfJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        schoolId: "default-school",
        status: "RUNNING",
        kind: "REPORT_CARD_BATCH",
      }),
    }));
  });

  it("rejects callers without any PDF generator permission", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await listPdfJobsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });
});

describe("getPdfJobAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns job when in current school", async () => {
    prismaMock.pdfJob.findFirst.mockResolvedValue({
      id: "job-1", status: "RUNNING", completedItems: 5, totalItems: 10,
    } as never);

    const result = await getPdfJobAction("job-1");
    expect(result).toMatchObject({ data: { id: "job-1" } });
  });

  it("returns error for cross-school access", async () => {
    prismaMock.pdfJob.findFirst.mockResolvedValue(null);
    const result = await getPdfJobAction("job-x");
    expect(result).toEqual({ error: "Job not found" });
  });

  it("rejects callers without any PDF generator permission", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getPdfJobAction("job-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });
});

describe("cancelPdfJobAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("cancels a QUEUED job", async () => {
    prismaMock.pdfJob.findFirst.mockResolvedValue({
      id: "job-1", status: "QUEUED", schoolId: "default-school",
    } as never);
    prismaMock.pdfJob.update.mockResolvedValue({ id: "job-1", status: "CANCELLED" } as never);

    const result = await cancelPdfJobAction("job-1");
    expect(result).toMatchObject({ data: { status: "CANCELLED" } });
  });

  it("refuses to cancel a RUNNING job", async () => {
    prismaMock.pdfJob.findFirst.mockResolvedValue({
      id: "job-1", status: "RUNNING", schoolId: "default-school",
    } as never);

    const result = await cancelPdfJobAction("job-1");
    expect(result).toEqual({ error: "Cannot cancel a running job" });
  });

  it("rejects callers without any PDF generator permission", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await cancelPdfJobAction("job-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });
});
