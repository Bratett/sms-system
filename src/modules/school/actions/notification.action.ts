"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-context";

export async function getNotificationsAction(limit = 10) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const notifications = await db.notification.findMany({
    where: { userId: ctx.session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unreadCount = await db.notification.count({
    where: { userId: ctx.session.user.id, isRead: false },
  });

  return { notifications, unreadCount };
}

/** @no-audit User-owned UI state; auditing every notification read is high-volume, low-value. */
export async function markNotificationReadAction(id: string) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  await db.notification.update({
    where: { id, userId: ctx.session.user.id },
    data: { isRead: true },
  });

  return { success: true };
}

/** @no-audit User-owned UI state; auditing every notification read is high-volume, low-value. */
export async function markAllNotificationsReadAction() {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  await db.notification.updateMany({
    where: { userId: ctx.session.user.id, isRead: false },
    data: { isRead: true },
  });

  return { success: true };
}

export async function createNotificationAction(data: {
  userId: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  link?: string;
}) {
  await db.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type || "INFO",
      link: data.link,
    },
  });

  return { success: true };
}
