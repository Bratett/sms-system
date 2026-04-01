"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { z } from "zod";

// ─── Schemas ────────────────────────────────────────────────

const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
  "HALF_DAY",
  "ON_LEAVE",
  "HOLIDAY",
] as const;

const recordAttendanceSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(ATTENDANCE_STATUSES),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  remarks: z.string().optional(),
});

type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;

const bulkRecordSchema = z.object({
  date: z.string().min(1),
  records: z.array(
    z.object({
      staffId: z.string().min(1),
      status: z.enum(ATTENDANCE_STATUSES),
      clockIn: z.string().optional(),
      clockOut: z.string().optional(),
      remarks: z.string().optional(),
    }),
  ),
});

type BulkRecordInput = z.infer<typeof bulkRecordSchema>;

// ─── Record Single Attendance ───────────────────────────────

export async function recordStaffAttendanceAction(data: RecordAttendanceInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = recordAttendanceSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const date = new Date(parsed.data.date);

  const record = await db.staffAttendance.upsert({
    where: {
      staffId_date: {
        staffId: parsed.data.staffId,
        date,
      },
    },
    update: {
      status: parsed.data.status,
      clockIn: parsed.data.clockIn ? new Date(parsed.data.clockIn) : null,
      clockOut: parsed.data.clockOut ? new Date(parsed.data.clockOut) : null,
      remarks: parsed.data.remarks || null,
      recordedBy: session.user.id!,
    },
    create: {
      schoolId: school.id,
      staffId: parsed.data.staffId,
      date,
      status: parsed.data.status,
      clockIn: parsed.data.clockIn ? new Date(parsed.data.clockIn) : null,
      clockOut: parsed.data.clockOut ? new Date(parsed.data.clockOut) : null,
      remarks: parsed.data.remarks || null,
      recordedBy: session.user.id!,
      source: "MANUAL",
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "StaffAttendance",
    entityId: record.id,
    module: "hr",
    description: `Recorded attendance: ${parsed.data.status} for staff ${parsed.data.staffId}`,
    newData: record,
  });

  return { data: record };
}

// ─── Bulk Record Attendance (Daily Register) ────────────────

export async function bulkRecordStaffAttendanceAction(data: BulkRecordInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = bulkRecordSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const date = new Date(parsed.data.date);
  let saved = 0;
  const errors: { staffId: string; message: string }[] = [];

  for (const rec of parsed.data.records) {
    try {
      await db.staffAttendance.upsert({
        where: { staffId_date: { staffId: rec.staffId, date } },
        update: {
          status: rec.status,
          clockIn: rec.clockIn ? new Date(rec.clockIn) : null,
          clockOut: rec.clockOut ? new Date(rec.clockOut) : null,
          remarks: rec.remarks || null,
          recordedBy: session.user.id!,
        },
        create: {
          schoolId: school.id,
          staffId: rec.staffId,
          date,
          status: rec.status,
          clockIn: rec.clockIn ? new Date(rec.clockIn) : null,
          clockOut: rec.clockOut ? new Date(rec.clockOut) : null,
          remarks: rec.remarks || null,
          recordedBy: session.user.id!,
          source: "MANUAL",
        },
      });
      saved++;
    } catch (error) {
      errors.push({
        staffId: rec.staffId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "StaffAttendance",
    module: "hr",
    description: `Bulk recorded attendance for ${saved} staff members on ${parsed.data.date}`,
    metadata: { date: parsed.data.date, saved, errorCount: errors.length },
  });

  return { saved, errors };
}

// ─── Get Attendance Records ─────────────────────────────────

export async function getStaffAttendanceAction(filters?: {
  staffId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { schoolId: school.id };
  if (filters?.staffId) where.staffId = filters.staffId;
  if (filters?.status) where.status = filters.status;
  if (filters?.dateFrom || filters?.dateTo) {
    where.date = {};
    if (filters?.dateFrom) where.date.gte = new Date(filters.dateFrom);
    if (filters?.dateTo) where.date.lte = new Date(filters.dateTo);
  }

  const [records, total] = await Promise.all([
    db.staffAttendance.findMany({
      where,
      include: {
        staff: { select: { firstName: true, lastName: true, staffId: true } },
      },
      orderBy: [{ date: "desc" }, { staff: { firstName: "asc" } }],
      skip,
      take: pageSize,
    }),
    db.staffAttendance.count({ where }),
  ]);

  return { data: records, total, page, pageSize };
}

// ─── Attendance Summary ─────────────────────────────────────

export async function getStaffAttendanceSummaryAction(staffId: string, month: number, year: number) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month

  const records = await db.staffAttendance.findMany({
    where: {
      schoolId: school.id,
      staffId,
      date: { gte: startDate, lte: endDate },
    },
    select: { status: true },
  });

  const summary: Record<string, number> = {
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    EXCUSED: 0,
    HALF_DAY: 0,
    ON_LEAVE: 0,
    HOLIDAY: 0,
  };

  for (const r of records) {
    summary[r.status] = (summary[r.status] || 0) + 1;
  }

  return {
    data: {
      staffId,
      month,
      year,
      totalRecords: records.length,
      ...summary,
    },
  };
}

// ─── Daily Overview ─────────────────────────────────────────

export async function getDailyAttendanceOverviewAction(date: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const targetDate = new Date(date);

  const [totalActive, records] = await Promise.all([
    db.staff.count({ where: { schoolId: school.id, status: "ACTIVE", deletedAt: null } }),
    db.staffAttendance.findMany({
      where: { schoolId: school.id, date: targetDate },
      select: { status: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const r of records) {
    counts[r.status] = (counts[r.status] || 0) + 1;
  }

  return {
    data: {
      date,
      totalActive,
      recorded: records.length,
      notRecorded: totalActive - records.length,
      present: counts.PRESENT || 0,
      absent: counts.ABSENT || 0,
      late: counts.LATE || 0,
      excused: counts.EXCUSED || 0,
      halfDay: counts.HALF_DAY || 0,
      onLeave: counts.ON_LEAVE || 0,
      holiday: counts.HOLIDAY || 0,
    },
  };
}
