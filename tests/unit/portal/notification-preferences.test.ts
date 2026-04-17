import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getMyNotificationPreferencesAction,
  setNotificationPreferenceAction,
  clearNotificationPreferenceAction,
} from "@/modules/portal/actions/notification-preferences.action";

describe("getMyNotificationPreferencesAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const r = await getMyNotificationPreferencesAction();
    expect(r).toEqual({ error: "Unauthorized" });
  });

  it("returns the full event catalogue with default vs override state", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValue([
      { userId: "test-user-id", eventKey: "fee_reminder", channels: ["EMAIL"] },
    ] as never);

    const r = await getMyNotificationPreferencesAction();
    expect("data" in r).toBe(true);
    if ("data" in r) {
      const feeEntry = r.data.find((e) => e.eventKey === "fee_reminder");
      expect(feeEntry).toBeDefined();
      expect(feeEntry?.hasOverride).toBe(true);
      expect(feeEntry?.effectiveChannels).toEqual(["EMAIL"]);

      // Events with no override row still appear in the catalogue with defaults.
      const otherEntry = r.data.find((e) => e.eventKey !== "fee_reminder");
      expect(otherEntry).toBeDefined();
      expect(otherEntry?.hasOverride).toBe(false);
    }
  });
});

describe("setNotificationPreferenceAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects invalid input", async () => {
    const r = await setNotificationPreferenceAction({
      eventKey: "",
      channels: [],
    });
    expect("error" in r).toBe(true);
  });

  it("upserts and returns success", async () => {
    prismaMock.notificationPreference.findUnique.mockResolvedValue(null as never);
    prismaMock.notificationPreference.upsert.mockResolvedValue({
      id: "pref-1",
      userId: "test-user-id",
      eventKey: "fee_reminder",
      channels: ["EMAIL", "SMS"],
    } as never);

    const r = await setNotificationPreferenceAction({
      eventKey: "fee_reminder",
      channels: ["EMAIL", "SMS"],
    });
    expect(r).toEqual({ success: true });
    expect(prismaMock.notificationPreference.upsert).toHaveBeenCalled();
  });

  it("empty channel list is valid (user opted out of everything)", async () => {
    prismaMock.notificationPreference.findUnique.mockResolvedValue(null as never);
    prismaMock.notificationPreference.upsert.mockResolvedValue({ id: "p" } as never);

    const r = await setNotificationPreferenceAction({
      eventKey: "fee_reminder",
      channels: [],
    });
    expect(r).toEqual({ success: true });
  });
});

describe("clearNotificationPreferenceAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("deletes the override and returns success", async () => {
    prismaMock.notificationPreference.delete.mockResolvedValue({ id: "p" } as never);
    const r = await clearNotificationPreferenceAction("fee_reminder");
    expect(r).toEqual({ success: true });
  });

  it("swallows not-found errors (no-op when already default)", async () => {
    prismaMock.notificationPreference.delete.mockRejectedValue(new Error("P2025"));
    const r = await clearNotificationPreferenceAction("fee_reminder");
    expect(r).toEqual({ success: true });
  });
});
