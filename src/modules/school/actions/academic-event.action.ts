"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Create Academic Event ───────────────────────────────────────────

export async function createAcademicEventAction(data: {
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  type: string;
  academicYearId?: string;
  termId?: string;
  isAllDay?: boolean;
  color?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const event = await db.academicEvent.create({
    data: {
      schoolId: school.id,
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      type: data.type as any,
      academicYearId: data.academicYearId,
      termId: data.termId,
      isAllDay: data.isAllDay ?? true,
      color: data.color,
      createdBy: session.user.id!,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "AcademicEvent",
    entityId: event.id,
    module: "school",
    description: `Created academic event: ${data.title}`,
  });

  return { data: event };
}

// ─── Update Academic Event ───────────────────────────────────────────

export async function updateAcademicEventAction(
  id: string,
  data: {
    title?: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
    type?: string;
    academicYearId?: string;
    termId?: string;
    isAllDay?: boolean;
    color?: string;
  },
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const existing = await db.academicEvent.findUnique({ where: { id } });
  if (!existing) return { error: "Event not found." };

  const updated = await db.academicEvent.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
      ...(data.type !== undefined && { type: data.type as any }),
      ...(data.academicYearId !== undefined && { academicYearId: data.academicYearId }),
      ...(data.termId !== undefined && { termId: data.termId }),
      ...(data.isAllDay !== undefined && { isAllDay: data.isAllDay }),
      ...(data.color !== undefined && { color: data.color }),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "AcademicEvent",
    entityId: id,
    module: "school",
    description: `Updated academic event: ${updated.title}`,
  });

  return { data: updated };
}

// ─── Delete Academic Event ───────────────────────────────────────────

export async function deleteAcademicEventAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const existing = await db.academicEvent.findUnique({ where: { id } });
  if (!existing) return { error: "Event not found." };

  await db.academicEvent.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "AcademicEvent",
    entityId: id,
    module: "school",
    description: `Deleted academic event: ${existing.title}`,
  });

  return { data: { deleted: true } };
}

// ─── Get Academic Events ─────────────────────────────────────────────

export async function getAcademicEventsAction(filters?: {
  academicYearId?: string;
  termId?: string;
  startDate?: Date;
  endDate?: Date;
  type?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters?.termId) where.termId = filters.termId;
  if (filters?.type) where.type = filters.type;
  if (filters?.startDate || filters?.endDate) {
    where.startDate = {};
    if (filters?.startDate) (where.startDate as any).gte = filters.startDate;
    if (filters?.endDate) (where.startDate as any).lte = filters.endDate;
  }

  const events = await db.academicEvent.findMany({
    where,
    orderBy: { startDate: "asc" },
  });

  return { data: events };
}
