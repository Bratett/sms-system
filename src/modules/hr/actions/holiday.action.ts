"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { PERMISSIONS, denyPermission } from "@/lib/permissions";
import { z } from "zod";

// ─── Schemas ────────────────────────────────────────────────

const createHolidaySchema = z.object({
  name: z.string().min(1, "Name is required"),
  date: z.string().min(1, "Date is required"),
  recurring: z.boolean().optional(),
});

type CreateHolidayInput = z.infer<typeof createHolidaySchema>;

// ─── CRUD ───────────────────────────────────────────────────

export async function getHolidaysAction(filters?: {
  year?: number;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.HOLIDAY_READ)) return { error: "Insufficient permissions" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { schoolId: ctx.schoolId };
  if (filters?.year) {
    where.date = {
      gte: new Date(`${filters.year}-01-01`),
      lte: new Date(`${filters.year}-12-31`),
    };
  }

  const [holidays, total] = await Promise.all([
    db.publicHoliday.findMany({
      where,
      orderBy: { date: "asc" },
      skip,
      take: pageSize,
    }),
    db.publicHoliday.count({ where }),
  ]);

  return { data: holidays, total, page, pageSize };
}

export async function createHolidayAction(data: CreateHolidayInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.HOLIDAY_CREATE)) return { error: "Insufficient permissions" };

  const parsed = createHolidaySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const date = new Date(parsed.data.date);

  // Check for duplicate date
  const existing = await db.publicHoliday.findUnique({
    where: { schoolId_date: { schoolId: ctx.schoolId, date } },
  });
  if (existing) return { error: "A holiday already exists on this date." };

  const holiday = await db.publicHoliday.create({
    data: {
      schoolId: ctx.schoolId,
      name: parsed.data.name,
      date,
      recurring: parsed.data.recurring ?? false,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "PublicHoliday",
    entityId: holiday.id,
    module: "hr",
    description: `Created public holiday "${holiday.name}" on ${parsed.data.date}`,
    newData: holiday,
  });

  return { data: holiday };
}

export async function deleteHolidayAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.HOLIDAY_DELETE)) return { error: "Insufficient permissions" };

  const existing = await db.publicHoliday.findUnique({ where: { id } });
  if (!existing) return { error: "Holiday not found." };

  await db.publicHoliday.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "PublicHoliday",
    entityId: id,
    module: "hr",
    description: `Deleted public holiday "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}

// ─── Import Ghana Public Holidays ───────────────────────────

const GHANA_HOLIDAYS = [
  { name: "New Year's Day", month: 1, day: 1 },
  { name: "Constitution Day", month: 1, day: 7 },
  { name: "Independence Day", month: 3, day: 6 },
  { name: "May Day", month: 5, day: 1 },
  { name: "African Union Day", month: 5, day: 25 },
  { name: "Republic Day", month: 7, day: 1 },
  { name: "Founders' Day", month: 8, day: 4 },
  { name: "Kwame Nkrumah Memorial Day", month: 9, day: 21 },
  { name: "Christmas Day", month: 12, day: 25 },
  { name: "Boxing Day", month: 12, day: 26 },
];

export async function importGhanaHolidaysAction(year: number) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.HOLIDAY_CREATE)) return { error: "Insufficient permissions" };

  let imported = 0;
  for (const h of GHANA_HOLIDAYS) {
    const date = new Date(year, h.month - 1, h.day);
    const exists = await db.publicHoliday.findUnique({
      where: { schoolId_date: { schoolId: ctx.schoolId, date } },
    });
    if (!exists) {
      await db.publicHoliday.create({
        data: {
          schoolId: ctx.schoolId,
          name: h.name,
          date,
          recurring: true,
        },
      });
      imported++;
    }
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "PublicHoliday",
    module: "hr",
    description: `Imported ${imported} Ghana public holidays for ${year}`,
    metadata: { year, imported },
  });

  return { data: { imported } };
}
