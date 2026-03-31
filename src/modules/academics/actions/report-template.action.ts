"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Get Report Templates ────────────────────────────────────────────

export async function getReportTemplatesAction(frameworkId?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const where: Record<string, unknown> = {};
  if (frameworkId) where.frameworkId = frameworkId;

  const templates = await db.reportTemplate.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return { data: templates };
}

// ─── Create Report Template ──────────────────────────────────────────

export async function createReportTemplateAction(data: {
  name: string;
  type: string;
  frameworkId: string;
  layout?: any;
  sections?: any;
  headerConfig?: any;
  isDefault?: boolean;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const template = await db.reportTemplate.create({
    data: {
      name: data.name,
      type: data.type as any,
      frameworkId: data.frameworkId,
      layout: data.layout ?? {},
      sections: data.sections ?? {},
      headerConfig: data.headerConfig ?? {},
      isDefault: data.isDefault ?? false,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "ReportTemplate",
    entityId: template.id,
    module: "academics",
    description: `Created report template: ${data.name}`,
  });

  return { data: template };
}

// ─── Update Report Template ──────────────────────────────────────────

export async function updateReportTemplateAction(
  id: string,
  data: {
    name?: string;
    type?: string;
    layout?: any;
    sections?: any;
    headerConfig?: any;
    isDefault?: boolean;
  },
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const existing = await db.reportTemplate.findUnique({ where: { id } });
  if (!existing) return { error: "Template not found." };

  const updated = await db.reportTemplate.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type as any }),
      ...(data.layout !== undefined && { layout: data.layout }),
      ...(data.sections !== undefined && { sections: data.sections }),
      ...(data.headerConfig !== undefined && { headerConfig: data.headerConfig }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "ReportTemplate",
    entityId: id,
    module: "academics",
    description: `Updated report template: ${updated.name}`,
  });

  return { data: updated };
}

// ─── Delete Report Template ──────────────────────────────────────────

export async function deleteReportTemplateAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const existing = await db.reportTemplate.findUnique({ where: { id } });
  if (!existing) return { error: "Template not found." };
  if (existing.isDefault) return { error: "Cannot delete the default template." };

  await db.reportTemplate.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "ReportTemplate",
    entityId: id,
    module: "academics",
    description: `Deleted report template: ${existing.name}`,
  });

  return { data: { deleted: true } };
}

// ─── Set Default Template ────────────────────────────────────────────

export async function setDefaultTemplateAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const template = await db.reportTemplate.findUnique({ where: { id } });
  if (!template) return { error: "Template not found." };

  // Unset all defaults for this type/framework
  await db.reportTemplate.updateMany({
    where: { frameworkId: template.frameworkId, type: template.type, isDefault: true },
    data: { isDefault: false },
  });

  // Set this one as default
  await db.reportTemplate.update({
    where: { id },
    data: { isDefault: true },
  });

  return { data: { success: true } };
}
