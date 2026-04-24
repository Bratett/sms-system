import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import {
  createAnnouncementAction,
  publishAnnouncementAction,
} from "@/modules/communication/actions/announcement.action";
import { notifyCircularPublished } from "@/modules/communication/circular-notifications";

vi.mock("@/modules/communication/circular-notifications", () => ({
  notifyCircularPublished: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/communication/circular-targeting", () => ({
  resolveTargetedHouseholdIds: vi.fn().mockResolvedValue(["hh-1", "hh-2"]),
}));

describe("createAnnouncementAction + requiresAcknowledgement", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:announcements:create"] });
  });

  it("persists requiresAcknowledgement=true when passed", async () => {
    prismaMock.announcement.create.mockResolvedValue({
      id: "a-1",
      requiresAcknowledgement: true,
    } as never);

    await createAnnouncementAction({
      title: "Exam fees due",
      content: "Please pay by Friday",
      targetType: "all",
      targetIds: null,
      priority: "high",
      requiresAcknowledgement: true,
    } as never);

    expect(prismaMock.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requiresAcknowledgement: true }),
      }),
    );
  });

  it("defaults requiresAcknowledgement=false when not passed", async () => {
    prismaMock.announcement.create.mockResolvedValue({
      id: "a-1",
      requiresAcknowledgement: false,
    } as never);

    await createAnnouncementAction({
      title: "Library closed",
      content: "on Friday",
      targetType: "all",
      targetIds: null,
      priority: "normal",
    } as never);

    expect(prismaMock.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requiresAcknowledgement: false }),
      }),
    );
  });
});

describe("publishAnnouncementAction fan-out", () => {
  beforeEach(() => {
    mockAuthenticatedUser({ permissions: ["communication:announcements:create"] });
    vi.mocked(notifyCircularPublished).mockClear();
  });

  it("fires notifyCircularPublished with requiresAcknowledgement=false for routine", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      title: "Library closed",
      status: "DRAFT",
      targetType: "all",
      targetIds: null,
      priority: "normal",
      requiresAcknowledgement: false,
    } as never);
    prismaMock.announcement.update.mockResolvedValue({} as never);
    prismaMock.guardian.findMany.mockResolvedValue([
      { userId: "u-1" },
      { userId: "u-2" },
    ] as never);

    await publishAnnouncementAction("a-1");

    expect(vi.mocked(notifyCircularPublished)).toHaveBeenCalledWith(
      expect.objectContaining({
        requiresAcknowledgement: false,
        recipientUserIds: expect.arrayContaining(["u-1", "u-2"]),
      }),
    );
  });

  it("fires notifyCircularPublished with requiresAcknowledgement=true when required", async () => {
    prismaMock.announcement.findFirst.mockResolvedValue({
      id: "a-1",
      schoolId: "default-school",
      title: "Exam fees due",
      status: "DRAFT",
      targetType: "all",
      targetIds: null,
      priority: "high",
      requiresAcknowledgement: true,
    } as never);
    prismaMock.announcement.update.mockResolvedValue({} as never);
    prismaMock.guardian.findMany.mockResolvedValue([{ userId: "u-1" }] as never);

    await publishAnnouncementAction("a-1");

    expect(vi.mocked(notifyCircularPublished)).toHaveBeenCalledWith(
      expect.objectContaining({
        requiresAcknowledgement: true,
      }),
    );
  });
});
