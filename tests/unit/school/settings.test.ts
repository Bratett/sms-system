import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getSystemSettingsAction,
  updateSystemSettingAction,
  deleteSystemSettingAction,
} from "@/modules/school/actions/settings.action";

// ─── getSystemSettingsAction ──────────────────────────────────────

describe("getSystemSettingsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getSystemSettingsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return all settings when no module filter", async () => {
    prismaMock.systemSetting.findMany.mockResolvedValue([
      { id: "set-1", key: "school.name", value: "Ghana SHS", module: "school", type: "string" },
      { id: "set-2", key: "finance.currency", value: "GHS", module: "finance", type: "string" },
    ] as never);

    const result = await getSystemSettingsAction();
    expect(result).toHaveProperty("settings");
    const settings = (result as { settings: Array<Record<string, unknown>> }).settings;
    expect(settings).toHaveLength(2);
  });

  it("should filter settings by module", async () => {
    prismaMock.systemSetting.findMany.mockResolvedValue([
      { id: "set-1", key: "school.name", value: "Ghana SHS", module: "school", type: "string" },
    ] as never);

    const result = await getSystemSettingsAction("school");
    expect(result).toHaveProperty("settings");
    expect(prismaMock.systemSetting.findMany).toHaveBeenCalled();
  });
});

// ─── updateSystemSettingAction ────────────────────────────────────

describe("updateSystemSettingAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateSystemSettingAction("school.name", "New Name");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should upsert a new setting when it does not exist", async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue(null as never);
    prismaMock.systemSetting.upsert.mockResolvedValue({
      id: "set-new",
      key: "new.setting",
      value: "new-value",
      type: "string",
    } as never);

    const result = await updateSystemSettingAction("new.setting", "new-value");
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("setting");
    expect(prismaMock.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "new.setting" },
      })
    );
  });

  it("should update existing setting", async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({
      id: "set-1",
      key: "school.name",
      value: "Old Name",
      type: "string",
    } as never);
    prismaMock.systemSetting.upsert.mockResolvedValue({
      id: "set-1",
      key: "school.name",
      value: "New Name",
      type: "string",
    } as never);

    const result = await updateSystemSettingAction("school.name", "New Name");
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("setting");
  });
});

// ─── deleteSystemSettingAction ────────────────────────────────────

describe("deleteSystemSettingAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteSystemSettingAction("school.name");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if setting not found", async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue(null as never);
    const result = await deleteSystemSettingAction("nonexistent");
    expect(result).toEqual({ error: "Setting not found" });
  });

  it("should delete setting successfully", async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({
      id: "set-1",
      key: "old.setting",
      value: "old-value",
    } as never);
    prismaMock.systemSetting.delete.mockResolvedValue({} as never);

    const result = await deleteSystemSettingAction("old.setting");
    expect(result).toEqual({ success: true });
    expect(prismaMock.systemSetting.delete).toHaveBeenCalledWith({
      where: { key: "old.setting" },
    });
  });
});
