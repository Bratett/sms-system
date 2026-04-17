import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  listNotificationTemplatesAction,
  upsertNotificationTemplateAction,
  deleteNotificationTemplateAction,
  previewNotificationTemplateAction,
} from "@/modules/communication/actions/notification-template.action";

describe("listNotificationTemplatesAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const r = await listNotificationTemplatesAction();
    expect(r).toEqual({ error: "Unauthorized" });
  });

  it("returns both school and global rows, tagged by scope", async () => {
    prismaMock.notificationTemplate.findMany.mockResolvedValue([
      {
        id: "g1",
        schoolId: null,
        key: "fee_reminder",
        channel: "EMAIL",
        locale: "en",
        subject: "Global",
        body: "g",
        variables: null,
        active: true,
        updatedAt: new Date(),
      },
      {
        id: "s1",
        schoolId: "default-school",
        key: "fee_reminder",
        channel: "EMAIL",
        locale: "en",
        subject: "Tenant",
        body: "t",
        variables: ["studentName"],
        active: true,
        updatedAt: new Date(),
      },
    ] as never);

    const r = await listNotificationTemplatesAction();
    expect("data" in r).toBe(true);
    if ("data" in r) {
      expect(r.data).toHaveLength(2);
      expect(r.data.find((t) => t.id === "g1")?.scope).toBe("global");
      expect(r.data.find((t) => t.id === "s1")?.scope).toBe("school");
      expect(r.data.find((t) => t.id === "s1")?.variables).toEqual(["studentName"]);
    }
  });
});

describe("upsertNotificationTemplateAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects invalid input", async () => {
    const r = await upsertNotificationTemplateAction({
      key: "",
      channel: "EMAIL",
      body: "",
    } as never);
    expect("error" in r).toBe(true);
  });

  it("upserts a school override", async () => {
    prismaMock.notificationTemplate.findUnique.mockResolvedValue(null as never);
    prismaMock.notificationTemplate.upsert.mockResolvedValue({
      id: "new-id",
      schoolId: "default-school",
      key: "fee_reminder",
      channel: "EMAIL",
      locale: "en",
      subject: "Hi",
      body: "Body {{x}}",
      variables: null,
      active: true,
      updatedAt: new Date(),
    } as never);

    const r = await upsertNotificationTemplateAction({
      key: "fee_reminder",
      channel: "EMAIL",
      locale: "en",
      subject: "Hi",
      body: "Body {{x}}",
      active: true,
    });
    expect("data" in r).toBe(true);
    expect(prismaMock.notificationTemplate.upsert).toHaveBeenCalled();
  });
});

describe("deleteNotificationTemplateAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns error when template not found", async () => {
    prismaMock.notificationTemplate.findUnique.mockResolvedValue(null as never);
    const r = await deleteNotificationTemplateAction("missing");
    expect(r).toEqual({ error: "Template not found." });
  });

  it("refuses to delete a global default", async () => {
    prismaMock.notificationTemplate.findUnique.mockResolvedValue({
      id: "g1",
      schoolId: null,
      key: "fee_reminder",
      channel: "EMAIL",
      locale: "en",
    } as never);
    const r = await deleteNotificationTemplateAction("g1");
    expect(r.error).toMatch(/Global templates are read-only/);
  });

  it("deletes a school-scoped override", async () => {
    prismaMock.notificationTemplate.findUnique.mockResolvedValue({
      id: "s1",
      schoolId: "default-school",
      key: "fee_reminder",
      channel: "EMAIL",
      locale: "en",
    } as never);
    const r = await deleteNotificationTemplateAction("s1");
    expect(r).toEqual({ success: true });
    expect(prismaMock.notificationTemplate.delete).toHaveBeenCalledWith({
      where: { id: "s1" },
    });
  });
});

describe("previewNotificationTemplateAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("renders subject and body with sample data", async () => {
    const r = await previewNotificationTemplateAction({
      subject: "Fees for {{studentName}}",
      body: "Balance: GHS {{amount}}",
      data: { studentName: "Ama", amount: "250" },
    });
    expect(r).toEqual({
      data: { subject: "Fees for Ama", body: "Balance: GHS 250" },
    });
  });
});
