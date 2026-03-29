import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../setup";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS, EVENT_CHANNELS } from "@/lib/notifications/events";
import { getQueue } from "@/lib/queue";

describe("Notification Dispatcher", () => {
  const baseOpts = {
    event: NOTIFICATION_EVENTS.PAYMENT_RECEIVED as const,
    title: "Payment Received",
    message: "Your payment of GHS 500 has been received.",
    schoolId: "default-school",
    recipients: [
      { userId: "user-1", phone: "+233200000001", email: "parent1@test.com", name: "Parent One" },
      { userId: "user-2", phone: "+233200000002", email: "parent2@test.com", name: "Parent Two" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should dispatch to in-app channel (creates Notification records)", async () => {
    prismaMock.notification.createMany.mockResolvedValue({ count: 2 } as never);

    await dispatch({
      ...baseOpts,
      channels: ["in_app"],
    });

    expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: "user-1",
          schoolId: "default-school",
          title: "Payment Received",
          message: "Your payment of GHS 500 has been received.",
          type: "INFO",
        }),
        expect.objectContaining({
          userId: "user-2",
          schoolId: "default-school",
        }),
      ]),
    });
  });

  it("should dispatch to SMS channel (creates SmsLog + queues job)", async () => {
    prismaMock.smsLog.create.mockResolvedValue({
      id: "sms-log-1",
      schoolId: "default-school",
      recipientPhone: "+233200000001",
      recipientName: "Parent One",
      message: baseOpts.message,
      status: "QUEUED",
    } as never);

    const mockQueue = getQueue("sms-delivery");

    await dispatch({
      ...baseOpts,
      channels: ["sms"],
    });

    // Should create SmsLog for each recipient with a phone
    expect(prismaMock.smsLog.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.smsLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: "default-school",
        recipientPhone: "+233200000001",
        recipientName: "Parent One",
        message: baseOpts.message,
        status: "QUEUED",
      }),
    });

    // Should enqueue SMS jobs
    expect(mockQueue.add).toHaveBeenCalledTimes(2);
    expect(mockQueue.add).toHaveBeenCalledWith(
      "sms-send",
      expect.objectContaining({
        phone: "+233200000001",
        message: baseOpts.message,
      }),
    );
  });

  it("should dispatch to email channel (queues email job)", async () => {
    const mockQueue = getQueue("email-delivery");

    await dispatch({
      ...baseOpts,
      channels: ["email"],
    });

    // Should enqueue email jobs for each recipient with email
    expect(mockQueue.add).toHaveBeenCalledTimes(2);
    expect(mockQueue.add).toHaveBeenCalledWith(
      "email-send",
      expect.objectContaining({
        to: "parent1@test.com",
        subject: "Payment Received",
        template: NOTIFICATION_EVENTS.PAYMENT_RECEIVED,
        data: expect.objectContaining({
          recipientName: "Parent One",
        }),
      }),
    );
  });

  it("should respect event channel routing from events.ts", async () => {
    // PAYMENT_RECEIVED routes to ["in_app", "sms"] per EVENT_CHANNELS
    const expectedChannels = EVENT_CHANNELS[NOTIFICATION_EVENTS.PAYMENT_RECEIVED];
    expect(expectedChannels).toContain("in_app");
    expect(expectedChannels).toContain("sms");
    expect(expectedChannels).not.toContain("email");

    prismaMock.notification.createMany.mockResolvedValue({ count: 2 } as never);
    prismaMock.smsLog.create.mockResolvedValue({ id: "sms-log-1" } as never);

    const mockQueue = getQueue("sms-delivery");

    // No explicit channels — should use EVENT_CHANNELS mapping
    await dispatch(baseOpts);

    // In-app should be dispatched
    expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
    // SMS should be dispatched
    expect(prismaMock.smsLog.create).toHaveBeenCalled();
    expect(mockQueue.add).toHaveBeenCalled();
  });

  it("should handle recipients without phone/email gracefully", async () => {
    const recipientsNoContact = [
      { userId: "user-1", name: "User One" },
      { userId: "user-2", name: "User Two" },
    ];

    prismaMock.notification.createMany.mockResolvedValue({ count: 2 } as never);

    await dispatch({
      ...baseOpts,
      recipients: recipientsNoContact,
      channels: ["in_app", "sms", "email"],
    });

    // In-app should still work (has userId)
    expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);

    // SMS should not be sent (no phone numbers)
    expect(prismaMock.smsLog.create).not.toHaveBeenCalled();

    // Email queue should not be called (no email addresses)
    const mockQueue = getQueue("email-delivery");
    expect(mockQueue.add).not.toHaveBeenCalled();
  });
});
