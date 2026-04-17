"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

/**
 * DocumentTemplate CRUD.
 *
 * Every create/update materialises a `DocumentTemplateVersion` row so older
 * rendered `DocumentInstance`s are always reproducible — the instance keeps
 * a pointer to the specific version it used.
 *
 * `publishTemplateAction` atomically flips a template to PUBLISHED and points
 * its `activeVersionId` at the specified version. Only PUBLISHED templates
 * can be used to generate new instances.
 */

const ENGINES = ["HANDLEBARS_PDF", "REACT_PDF"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const createSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/i, "Use letters, digits and underscores only.").min(2).max(60),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  engine: z.enum(ENGINES).default("HANDLEBARS_PDF"),
  bodyHtml: z.string().max(200_000).optional().nullable(),
  componentKey: z.string().max(100).optional().nullable(),
  variables: z.array(z.string()).optional(),
});

const reviseSchema = z.object({
  bodyHtml: z.string().max(200_000).optional().nullable(),
  componentKey: z.string().max(100).optional().nullable(),
  variables: z.array(z.string()).optional(),
});

export async function listDocumentTemplatesAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENT_TEMPLATE_READ);
  if (denied) return denied;

  const rows = await db.documentTemplate.findMany({
    where: { OR: [{ schoolId: ctx.schoolId }, { schoolId: null }] },
    orderBy: [{ name: "asc" }],
    include: {
      activeVersion: { select: { id: true, version: true } },
    },
  });

  return {
    data: rows.map((t) => ({
      id: t.id,
      scope: t.schoolId === ctx.schoolId ? "school" : "global",
      key: t.key,
      name: t.name,
      description: t.description,
      engine: t.engine,
      status: t.status,
      activeVersion: t.activeVersion?.version ?? null,
      updatedAt: t.updatedAt,
    })),
  };
}

export async function getDocumentTemplateAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DOCUMENT_TEMPLATE_READ);
  if (denied) return denied;

  const tpl = await db.documentTemplate.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: "desc" } },
      activeVersion: true,
    },
  });
  if (!tpl) return { error: "Template not found." };
  if (tpl.schoolId !== null && tpl.schoolId !== ctx.schoolId) {
    return { error: "Template not found." };
  }
  return { data: tpl };
}

export async function createDocumentTemplateAction(
  input: z.input<typeof createSchema>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.DOCUMENT_TEMPLATE_MANAGE,
  );
  if (denied) return denied;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  if (data.engine === "HANDLEBARS_PDF" && !data.bodyHtml) {
    return { error: "HANDLEBARS_PDF templates require a bodyHtml." };
  }
  if (data.engine === "REACT_PDF" && !data.componentKey) {
    return { error: "REACT_PDF templates require a componentKey." };
  }

  const tpl = await db.$transaction(async (tx) => {
    const created = await tx.documentTemplate.create({
      data: {
        schoolId: ctx.schoolId,
        key: data.key.toLowerCase(),
        name: data.name,
        description: data.description ?? null,
        engine: data.engine,
        bodyHtml: data.bodyHtml ?? null,
        componentKey: data.componentKey ?? null,
        variables: data.variables as never,
        status: "DRAFT",
        createdBy: ctx.session.user.id,
      },
    });
    const version = await tx.documentTemplateVersion.create({
      data: {
        templateId: created.id,
        version: 1,
        bodyHtml: data.bodyHtml ?? null,
        componentKey: data.componentKey ?? null,
        variables: data.variables as never,
        createdBy: ctx.session.user.id,
      },
    });
    await tx.documentTemplate.update({
      where: { id: created.id },
      data: { activeVersionId: version.id },
    });
    return created;
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "DocumentTemplate",
    entityId: tpl.id,
    module: "documents",
    description: `Created document template '${data.key}' (${data.engine})`,
    newData: data as never,
  });

  revalidatePath("/documents/templates");
  return { data: tpl };
}

export async function reviseDocumentTemplateAction(
  id: string,
  input: z.input<typeof reviseSchema>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.DOCUMENT_TEMPLATE_MANAGE,
  );
  if (denied) return denied;

  const parsed = reviseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const tpl = await db.documentTemplate.findUnique({ where: { id } });
  if (!tpl || (tpl.schoolId !== null && tpl.schoolId !== ctx.schoolId)) {
    return { error: "Template not found." };
  }

  const nextVersionNumber = await db.documentTemplateVersion
    .count({ where: { templateId: id } })
    .then((n) => n + 1);

  const version = await db.$transaction(async (tx) => {
    const v = await tx.documentTemplateVersion.create({
      data: {
        templateId: id,
        version: nextVersionNumber,
        bodyHtml: parsed.data.bodyHtml ?? tpl.bodyHtml,
        componentKey: parsed.data.componentKey ?? tpl.componentKey,
        variables: (parsed.data.variables as never) ?? tpl.variables,
        createdBy: ctx.session.user.id,
      },
    });
    await tx.documentTemplate.update({
      where: { id },
      data: {
        bodyHtml: parsed.data.bodyHtml ?? tpl.bodyHtml,
        componentKey: parsed.data.componentKey ?? tpl.componentKey,
        variables: (parsed.data.variables as never) ?? tpl.variables,
        activeVersionId: v.id,
      },
    });
    return v;
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "DocumentTemplateVersion",
    entityId: version.id,
    module: "documents",
    description: `Created v${nextVersionNumber} of template '${tpl.key}'`,
  });

  revalidatePath("/documents/templates");
  return { data: { templateId: id, versionId: version.id, version: nextVersionNumber } };
}

export async function publishDocumentTemplateAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.DOCUMENT_TEMPLATE_MANAGE,
  );
  if (denied) return denied;

  const tpl = await db.documentTemplate.findUnique({
    where: { id },
    select: { id: true, schoolId: true, activeVersionId: true, status: true, key: true },
  });
  if (!tpl || tpl.schoolId !== ctx.schoolId) {
    return { error: "Template not found or not editable by this tenant." };
  }
  if (!tpl.activeVersionId) {
    return { error: "Template has no version to publish." };
  }

  await db.documentTemplate.update({
    where: { id },
    data: { status: "PUBLISHED" },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "PUBLISH",
    entity: "DocumentTemplate",
    entityId: id,
    module: "documents",
    description: `Published template '${tpl.key}'`,
    previousData: { status: tpl.status },
    newData: { status: "PUBLISHED" },
  });

  return { success: true };
}

const enumStatusSchema = z.enum(STATUSES);

export async function setDocumentTemplateStatusAction(
  id: string,
  status: z.infer<typeof enumStatusSchema>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.DOCUMENT_TEMPLATE_MANAGE,
  );
  if (denied) return denied;

  const tpl = await db.documentTemplate.findUnique({ where: { id } });
  if (!tpl || tpl.schoolId !== ctx.schoolId) {
    return { error: "Template not found or not editable by this tenant." };
  }

  await db.documentTemplate.update({ where: { id }, data: { status } });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "DocumentTemplate",
    entityId: id,
    module: "documents",
    description: `Set template '${tpl.key}' status → ${status}`,
    previousData: { status: tpl.status },
    newData: { status },
  });

  return { success: true };
}
