"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getNotificationsAction(limit = 10) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unreadCount = await db.notification.count({
    where: { userId: session.user.id, isRead: false },
  });

  return { notifications, unreadCount };
}

export async function markNotificationReadAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  await db.notification.update({
    where: { id, userId: session.user.id },
    data: { isRead: true },
  });

  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  await db.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
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
