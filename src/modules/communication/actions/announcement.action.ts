"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Get Announcements (paginated) ──────────────────────────────────

export async function getAnnouncementsAction(filters?: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: school.id };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { content: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [announcements, total] = await Promise.all([
    db.announcement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.announcement.count({ where }),
  ]);

  // Fetch creator names
  const creatorIds = [...new Set(announcements.map((a) => a.createdBy))];
  let creatorMap = new Map<string, string>();
  if (creatorIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    creatorMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const data = announcements.map((a) => ({
    ...a,
    createdByName: creatorMap.get(a.createdBy) ?? "Unknown",
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ─── Create Announcement ────────────────────────────────────────────

export async function createAnnouncementAction(data: {
  title: string;
  content: string;
  targetType: string;
  targetIds?: string[];
  priority: string;
  expiresAt?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const announcement = await db.announcement.create({
    data: {
      schoolId: school.id,
      title: data.title,
      content: data.content,
      targetType: data.targetType,
      targetIds: data.targetIds ?? undefined,
      priority: data.priority,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      createdBy: session.user.id!,
      status: "DRAFT",
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Announcement",
    entityId: announcement.id,
    module: "communication",
    description: `Created announcement "${announcement.title}"`,
    newData: announcement,
  });

  return { data: announcement };
}

// ─── Publish Announcement ───────────────────────────────────────────

export async function publishAnnouncementAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Announcement not found." };
  }

  const updated = await db.announcement.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Announcement",
    entityId: id,
    module: "communication",
    description: `Published announcement "${updated.title}"`,
    previousData: existing,
    newData: updated,
  });

  return { data: updated };
}

// ─── Archive Announcement ───────────────────────────────────────────

export async function archiveAnnouncementAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Announcement not found." };
  }

  const updated = await db.announcement.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Announcement",
    entityId: id,
    module: "communication",
    description: `Archived announcement "${updated.title}"`,
    previousData: existing,
    newData: updated,
  });

  return { data: updated };
}

// ─── Delete Announcement (DRAFT only) ───────────────────────────────

export async function deleteAnnouncementAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Announcement not found." };
  }

  if (existing.status !== "DRAFT") {
    return { error: "Only draft announcements can be deleted." };
  }

  await db.announcement.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Announcement",
    entityId: id,
    module: "communication",
    description: `Deleted announcement "${existing.title}"`,
    previousData: existing,
  });

  return { success: true };
}
