"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  updateSchoolSchema,
  type UpdateSchoolInput,
} from "@/modules/school/schemas/school.schema";

export async function getSchoolAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_READ);
  if (denied) return denied;

  const school = await db.school.findUnique({ where: { id: ctx.schoolId } });
  return { data: school };
}

export async function updateSchoolAction(data: UpdateSchoolInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_UPDATE);
  if (denied) return denied;

  const parsed = updateSchoolSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findUnique({ where: { id: ctx.schoolId } });
  if (!school) {
    return { error: "School record not found" };
  }

  const previousData = { ...school };

  const updated = await db.school.update({
    where: { id: school.id },
    data: {
      name: parsed.data.name,
      motto: parsed.data.motto || null,
      address: parsed.data.address || null,
      region: parsed.data.region || null,
      district: parsed.data.district || null,
      town: parsed.data.town || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
      type: parsed.data.type,
      category: parsed.data.category,
      ghanaEducationServiceCode: parsed.data.ghanaEducationServiceCode || null,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "School",
    entityId: school.id,
    module: "school",
    description: `Updated school settings for "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}
