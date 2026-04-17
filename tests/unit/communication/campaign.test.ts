import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createCampaignAction,
  cancelCampaignAction,
  listCampaignsAction,
} from "@/modules/communication/actions/campaign.action";

describe("createCampaignAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const r = await createCampaignAction({
      name: "X",
      channel: "SMS",
      body: "hi",
      audience: { kind: "ALL_GUARDIANS" },
      scheduledAt: new Date(Date.now() + 3600_000),
    });
    expect(r).toEqual({ error: "Unauthorized" });
  });

  it("rejects past scheduledAt", async () => {
    const r = await createCampaignAction({
      name: "Past",
      channel: "SMS",
      body: "hi",
      audience: { kind: "ALL_GUARDIANS" },
      scheduledAt: new Date(Date.now() - 3600_000),
    });
    expect(r).toEqual({ error: "Scheduled time must be in the future." });
  });

  it("rejects invalid audience shape", async () => {
    const r = await createCampaignAction({
      name: "Bad audience",
      channel: "SMS",
      body: "hi",
      // @ts-expect-error purposely malformed
      audience: { kind: "CLASS_ARM" }, // missing classArmId
      scheduledAt: new Date(Date.now() + 3600_000),
    });
    expect("error" in r).toBe(true);
  });

  it("creates a SCHEDULED campaign with valid input", async () => {
    prismaMock.communicationCampaign.create.mockResolvedValue({
      id: "c1",
      schoolId: "default-school",
      name: "Term 1 Reminder",
      channel: "SMS",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 3600_000),
    } as never);

    const r = await createCampaignAction({
      name: "Term 1 Reminder",
      channel: "SMS",
      body: "Fees due soon",
      audience: { kind: "ALL_GUARDIANS" },
      scheduledAt: new Date(Date.now() + 3600_000),
    });
    expect("data" in r).toBe(true);
    expect(prismaMock.communicationCampaign.create).toHaveBeenCalled();
  });
});

describe("cancelCampaignAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns error when not found", async () => {
    prismaMock.communicationCampaign.findUnique.mockResolvedValue(null as never);
    const r = await cancelCampaignAction("missing");
    expect(r).toEqual({ error: "Campaign not found." });
  });

  it("refuses to cancel a dispatching campaign", async () => {
    prismaMock.communicationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      schoolId: "default-school",
      status: "DISPATCHING",
      name: "x",
    } as never);
    const r = await cancelCampaignAction("c1");
    expect(r.error).toMatch(/already started/);
  });

  it("cancels a scheduled campaign", async () => {
    prismaMock.communicationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      schoolId: "default-school",
      status: "SCHEDULED",
      name: "x",
    } as never);
    const r = await cancelCampaignAction("c1");
    expect(r).toEqual({ success: true });
    expect(prismaMock.communicationCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
  });
});

describe("listCampaignsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns campaigns scoped to the current tenant", async () => {
    prismaMock.communicationCampaign.findMany.mockResolvedValue([
      { id: "c1", schoolId: "default-school", status: "COMPLETED" },
      { id: "c2", schoolId: "default-school", status: "SCHEDULED" },
    ] as never);
    const r = await listCampaignsAction();
    expect("data" in r).toBe(true);
    if ("data" in r) expect(r.data).toHaveLength(2);
  });
});
