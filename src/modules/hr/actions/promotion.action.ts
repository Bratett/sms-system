"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { PERMISSIONS, denyPermission } from "@/lib/permissions";
import { z } from "zod";

// ─── Schemas ────────────────────────────────────────────────

const promoteStaffSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required"),
  effectiveDate: z.string().min(1, "Effective date is required"),
  newRank: z.string().min(1, "New rank is required"),
  newGrade: z.string().optional(),
  newSalary: z.number().optional(),
  reason: z.string().optional(),
  letterDocumentId: z.string().optional(),
});

type PromoteStaffInput = z.infer<typeof promoteStaffSchema>;

// ─── Actions ────────────────────────────────────────────────

export async function promoteStaffAction(data: PromoteStaffInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.PROMOTION_CREATE)) return { error: "Insufficient permissions" };

  const parsed = promoteStaffSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const staff = await db.staff.findUnique({
    where: { id: parsed.data.staffId },
    include: {
      employments: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { startDate: "desc" },
      },
    },
  });

  if (!staff) return { error: "Staff member not found." };

  const currentEmployment = staff.employments[0];
  const previousRank = currentEmployment?.rank || null;
  const previousGrade = currentEmployment?.salaryGrade || null;

  // Create promotion record
  const promotion = await db.staffPromotion.create({
    data: {
      schoolId: ctx.schoolId,
      staffId: parsed.data.staffId,
      effectiveDate: new Date(parsed.data.effectiveDate),
      previousRank,
      newRank: parsed.data.newRank,
      previousGrade,
      newGrade: parsed.data.newGrade || null,
      previousSalary: null, // Could be derived from salary grade lookup
      newSalary: parsed.data.newSalary ?? null,
      reason: parsed.data.reason || null,
      approvedBy: ctx.session.user.id,
      letterDocumentId: parsed.data.letterDocumentId || null,
    },
  });

  // Update active employment with new rank and grade
  if (currentEmployment) {
    await db.employment.update({
      where: { id: currentEmployment.id },
      data: {
        rank: parsed.data.newRank,
        salaryGrade: parsed.data.newGrade || currentEmployment.salaryGrade,
      },
    });
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "StaffPromotion",
    entityId: promotion.id,
    module: "hr",
    description: `Promoted "${staff.firstName} ${staff.lastName}" from ${previousRank || "N/A"} to ${parsed.data.newRank}`,
    newData: promotion,
  });

  return { data: promotion };
}

export async function getPromotionHistoryAction(staffId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.PROMOTION_READ)) return { error: "Insufficient permissions" };

  const promotions = await db.staffPromotion.findMany({
    where: { staffId },
    orderBy: { effectiveDate: "desc" },
  });

  return { data: promotions };
}

export async function getAllPromotionsAction(filters?: {
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.PROMOTION_READ)) return { error: "Insufficient permissions" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [promotions, total] = await Promise.all([
    db.staffPromotion.findMany({
      where: { schoolId: ctx.schoolId },
      include: {
        staff: { select: { firstName: true, lastName: true, staffId: true } },
      },
      orderBy: { effectiveDate: "desc" },
      skip,
      take: pageSize,
    }),
    db.staffPromotion.count({ where: { schoolId: ctx.schoolId } }),
  ]);

  return { data: promotions, total, page, pageSize };
}
