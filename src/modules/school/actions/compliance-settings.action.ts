"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

/**
 * Read + update the four statutory identifiers on the School row:
 *   - `tin`                  — Tax Identification Number (GRA)
 *   - `ssnitEmployerNumber`  — SSNIT employer registration
 *   - `getFundCode`          — GETFund beneficiary / disbursement code
 *   - `graVatTin`            — separate VAT TIN when the school is VAT-registered
 *
 * Each is nullable and independently editable so a school can register with
 * one authority without blocking on the others.
 */

const updateSchema = z.object({
  tin: z.string().max(50).nullable().optional(),
  ssnitEmployerNumber: z.string().max(50).nullable().optional(),
  getFundCode: z.string().max(50).nullable().optional(),
  graVatTin: z.string().max(50).nullable().optional(),
  ghanaEducationServiceCode: z.string().max(50).nullable().optional(),
});

export async function getComplianceSettingsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COMPLIANCE_READ);
  if (denied) return denied;

  const school = await db.school.findUnique({
    where: { id: ctx.schoolId },
    select: {
      id: true,
      name: true,
      tin: true,
      ssnitEmployerNumber: true,
      getFundCode: true,
      graVatTin: true,
      ghanaEducationServiceCode: true,
    },
  });
  if (!school) return { error: "School not found." };
  return { data: school };
}

export async function updateComplianceSettingsAction(
  input: z.input<typeof updateSchema>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_UPDATE);
  if (denied) return denied;

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.school.findUnique({
    where: { id: ctx.schoolId },
    select: {
      tin: true,
      ssnitEmployerNumber: true,
      getFundCode: true,
      graVatTin: true,
      ghanaEducationServiceCode: true,
    },
  });

  const updated = await db.school.update({
    where: { id: ctx.schoolId },
    data: {
      tin: parsed.data.tin ?? null,
      ssnitEmployerNumber: parsed.data.ssnitEmployerNumber ?? null,
      getFundCode: parsed.data.getFundCode ?? null,
      graVatTin: parsed.data.graVatTin ?? null,
      ghanaEducationServiceCode: parsed.data.ghanaEducationServiceCode ?? null,
    },
    select: {
      id: true,
      tin: true,
      ssnitEmployerNumber: true,
      getFundCode: true,
      graVatTin: true,
      ghanaEducationServiceCode: true,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "School",
    entityId: ctx.schoolId,
    module: "school",
    description: "Updated Ghana statutory identifiers",
    previousData: existing,
    newData: updated,
  });

  revalidatePath("/admin/school/compliance");
  return { data: updated };
}
