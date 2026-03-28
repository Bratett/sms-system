"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  updateSchoolSchema,
  type UpdateSchoolInput,
} from "@/modules/school/schemas/school.schema";

export async function getSchoolAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  return { data: school };
}

export async function updateSchoolAction(data: UpdateSchoolInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = updateSchoolSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findFirst();
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
    userId: session.user.id!,
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
