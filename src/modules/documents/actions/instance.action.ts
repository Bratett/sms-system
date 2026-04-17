"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { uploadFile, generateFileKey, getSignedDownloadUrl } from "@/lib/storage/r2";
import { renderDocumentToPdf } from "@/lib/documents/renderer";

/**
 * Document instance lifecycle:
 *   1. issueDocumentInstance — render the PDF from (template, payload),
 *      upload to R2, hash it, create the DocumentInstance row.
 *   2. createDocumentSignLink — issue a tokenised URL for a non-user
 *      signer (e.g. a guardian). The token itself is returned only in the
 *      response; we store only its SHA-256 hash.
 *   3. getInstanceDownloadUrl — signed URL for a user-authenticated
 *      download.
 *
 * Signing flows are in `signature.action.ts`.
 */

const issueSchema = z.object({
  templateId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  entityType: z.string().max(50).optional().nullable(),
  entityId: z.string().max(100).optional().nullable(),
});

const signLinkSchema = z.object({
  instanceId: z.string().min(1),
  signerEmail: z.string().email().optional().nullable(),
  signerPhone: z.string().max(30).optional().nullable(),
  signerName: z.string().max(200).optional().nullable(),
  signerRole: z.string().max(100).optional().nullable(),
  ttlHours: z.number().int().min(1).max(24 * 30).default(168),
});

export async function issueDocumentInstanceAction(
  input: z.input<typeof issueSchema>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.DOCUMENT_INSTANCE_ISSUE,
  );
  if (denied) return denied;

  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const template = await db.documentTemplate.findUnique({
    where: { id: parsed.data.templateId },
    include: { activeVersion: true },
  });
  if (!template) return { error: "Template not found." };
  if (template.schoolId !== null && template.schoolId !== ctx.schoolId) {
    return { error: "Template not found." };
  }
  if (template.status !== "PUBLISHED") {
    return { error: "Only PUBLISHED templates can issue documents." };
  }
  const version = template.activeVersion;
  if (!version) return { error: "Template has no active version." };

  // Create the instance record up front so we have an ID for the R2 key.
  const instance = await db.documentInstance.create({
    data: {
      schoolId: ctx.schoolId,
      templateId: template.id,
      versionId: version.id,
      rendererPayload: parsed.data.payload as never,
      status: "PENDING_RENDER",
      generatedBy: ctx.session.user.id,
      entityType: parsed.data.entityType ?? null,
      entityId: parsed.data.entityId ?? null,
    },
  });

  try {
    const rendered = await renderDocumentToPdf({
      engine: template.engine,
      bodyHtml: version.bodyHtml,
      componentKey: version.componentKey,
      payload: parsed.data.payload,
    });

    const key = generateFileKey(
      "documents/instances",
      instance.id,
      `${template.key}-v${version.version}.pdf`,
    );
    await uploadFile(key, rendered.pdf, "application/pdf", {
      templateKey: template.key,
      instanceId: instance.id,
    });

    await db.documentInstance.update({
      where: { id: instance.id },
      data: {
        pdfKey: key,
        pdfSha256: rendered.sha256,
        status: "AWAITING_SIGNATURES",
      },
    });

    await audit({
      userId: ctx.session.user.id,
      schoolId: ctx.schoolId,
      action: "CREATE",
      entity: "DocumentInstance",
      entityId: instance.id,
      module: "documents",
      description: `Issued document '${template.key}' v${version.version}`,
      metadata: { templateId: template.id, versionId: version.id, sha256: rendered.sha256 },
    });

    revalidatePath("/documents/instances");
    return {
      data: {
        instanceId: instance.id,
        pdfKey: key,
        sha256: rendered.sha256,
      },
    };
  } catch (err) {
    await db.documentInstance.update({
      where: { id: instance.id },
      data: { status: "VOIDED" },
    });
    return {
      error: err instanceof Error ? err.message : "Failed to render document.",
    };
  }
}

export async function getInstanceDownloadUrlAction(instanceId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.DOCUMENT_INSTANCE_ISSUE,
  );
  if (denied) return denied;

  const instance = await db.documentInstance.findUnique({
    where: { id: instanceId },
  });
  if (!instance || instance.schoolId !== ctx.schoolId || !instance.pdfKey) {
    return { error: "Document not found." };
  }

  const url = await getSignedDownloadUrl(instance.pdfKey, 300);
  return { data: { url } };
}

export async function createDocumentSignLinkAction(
  input: z.input<typeof signLinkSchema>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.DOCUMENT_INSTANCE_ISSUE,
  );
  if (denied) return denied;

  const parsed = signLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const instance = await db.documentInstance.findUnique({
    where: { id: parsed.data.instanceId },
  });
  if (!instance || instance.schoolId !== ctx.schoolId) {
    return { error: "Document not found." };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const link = await db.documentSignLink.create({
    data: {
      instanceId: instance.id,
      schoolId: ctx.schoolId,
      tokenHash,
      signerEmail: parsed.data.signerEmail ?? null,
      signerPhone: parsed.data.signerPhone ?? null,
      signerName: parsed.data.signerName ?? null,
      signerRole: parsed.data.signerRole ?? null,
      expiresAt: new Date(Date.now() + parsed.data.ttlHours * 60 * 60 * 1000),
      createdBy: ctx.session.user.id,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "DocumentSignLink",
    entityId: link.id,
    module: "documents",
    description: `Issued sign link for instance ${instance.id}`,
    metadata: {
      instanceId: instance.id,
      ttlHours: parsed.data.ttlHours,
      signerEmail: parsed.data.signerEmail ?? null,
    },
  });

  return {
    data: {
      linkId: link.id,
      // The raw token is returned exactly once; the caller must surface it
      // to the admin so it can be emailed/SMS'd. The DB only stores the hash.
      token,
      expiresAt: link.expiresAt,
    },
  };
}
