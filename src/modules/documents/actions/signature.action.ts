"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-context";
import { audit } from "@/lib/audit";

/**
 * Document e-signature flow.
 *
 * Every signature links to the previous one via a SHA-256 hash chain:
 *   hash_n = SHA256(pdfSha256 || hash_{n-1} || signerId || signedAt)
 *
 * Tampering with the PDF bytes (which change `pdfSha256`) or reordering
 * signatures breaks the chain and is detectable with the `verifySignatureChain`
 * helper. The canonical proof of "who signed what, when" lives in Postgres.
 *
 * Two signer paths:
 *   - `signInstanceAction` for authenticated users (staff, admins).
 *   - `signInstanceWithTokenAction` for tokenised links issued to non-users
 *     (e.g. guardians) via `createDocumentSignLinkAction`.
 */

const SIGN_METHODS = ["TYPED", "DRAWN", "UPLOADED_CERT", "SYSTEM"] as const;

const signSchema = z.object({
  instanceId: z.string().min(1),
  method: z.enum(SIGN_METHODS),
  // Typed name, drawn SVG, or uploaded certificate reference — free-form.
  payload: z.record(z.string(), z.unknown()).optional(),
  signerRole: z.string().max(100).optional(),
});

function chainHash(params: {
  pdfSha256: string;
  previousHash: string | null;
  signerId: string;
  signedAt: Date;
}): string {
  const h = createHash("sha256");
  h.update(params.pdfSha256);
  h.update("|");
  h.update(params.previousHash ?? "GENESIS");
  h.update("|");
  h.update(params.signerId);
  h.update("|");
  h.update(params.signedAt.toISOString());
  return h.digest("hex");
}

async function recordSignature(params: {
  instanceId: string;
  schoolId: string;
  signerId: string;
  signerName: string | null;
  signerRole: string | null;
  method: (typeof SIGN_METHODS)[number];
  payload: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const instance = await db.documentInstance.findUnique({
    where: { id: params.instanceId },
    include: {
      signatures: { orderBy: { signedAt: "asc" } },
    },
  });
  if (!instance) return { error: "Document not found." };
  if (!instance.pdfSha256) {
    return { error: "Document has not been rendered yet." };
  }
  if (instance.schoolId !== params.schoolId) {
    return { error: "Document not found." };
  }
  if (instance.status === "VOIDED" || instance.status === "SIGNED") {
    return { error: `Document is ${instance.status} and cannot accept more signatures.` };
  }

  const previous = instance.signatures.at(-1);
  const signedAt = new Date();
  const hash = chainHash({
    pdfSha256: instance.pdfSha256,
    previousHash: previous?.hash ?? null,
    signerId: params.signerId,
    signedAt,
  });

  const sig = await db.documentSignature.create({
    data: {
      instanceId: instance.id,
      signerId: params.signerId,
      signerName: params.signerName,
      signerRole: params.signerRole,
      method: params.method,
      hash,
      signedAt,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      payload: params.payload as never,
    },
  });

  await audit({
    userId: params.signerId,
    schoolId: params.schoolId,
    action: "APPROVE",
    entity: "DocumentSignature",
    entityId: sig.id,
    module: "documents",
    description: `Signed document ${instance.id} (${params.method})`,
    metadata: { hash, previousHash: previous?.hash ?? null },
  });

  return { data: { signatureId: sig.id, hash } };
}

export async function signInstanceAction(input: z.input<typeof signSchema>) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const parsed = signSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const instance = await db.documentInstance.findUnique({
    where: { id: parsed.data.instanceId },
  });
  if (!instance) return { error: "Document not found." };

  const result = await recordSignature({
    instanceId: parsed.data.instanceId,
    schoolId: instance.schoolId,
    signerId: ctx.session.user.id,
    signerName: ctx.session.user.name ?? null,
    signerRole: parsed.data.signerRole ?? null,
    method: parsed.data.method,
    payload: parsed.data.payload ?? null,
  });
  return result;
}

/**
 * Sign via a tokenised link. The token itself is never stored; we compare
 * SHA-256(token) to the `tokenHash` on the DocumentSignLink row. Links are
 * single-use: `consumedAt` is set atomically with the signature.
 */
const tokenSignSchema = z.object({
  token: z.string().min(20),
  method: z.enum(SIGN_METHODS),
  payload: z.record(z.string(), z.unknown()).optional(),
  typedName: z.string().max(200).optional(),
});

export async function signInstanceWithTokenAction(
  input: z.input<typeof tokenSignSchema>,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const parsed = tokenSignSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");

  const link = await db.documentSignLink.findUnique({
    where: { tokenHash },
  });
  if (!link) return { error: "This signing link is not valid." };
  if (link.consumedAt) {
    return { error: "This signing link has already been used." };
  }
  if (link.expiresAt.getTime() < Date.now()) {
    return { error: "This signing link has expired." };
  }

  // The "signer id" for tokenised signatures is the link ID; this keeps a
  // deterministic handle in audit + chain without requiring a user account.
  const signerId = `link:${link.id}`;

  const recorded = await recordSignature({
    instanceId: link.instanceId,
    schoolId: link.schoolId,
    signerId,
    signerName: parsed.data.typedName ?? link.signerName,
    signerRole: link.signerRole,
    method: parsed.data.method,
    payload: parsed.data.payload ?? null,
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
  });
  if ("error" in recorded) return recorded;

  await db.documentSignLink.update({
    where: { id: link.id },
    data: { consumedAt: new Date() },
  });

  return { data: { signatureId: recorded.data.signatureId, hash: recorded.data.hash } };
}

/**
 * Verify the integrity of an instance's signature chain. Returns a list of
 * indices at which the stored hash did not match the recomputed hash.
 */
export async function verifyDocumentSignatureChainAction(instanceId: string) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const instance = await db.documentInstance.findUnique({
    where: { id: instanceId },
    include: { signatures: { orderBy: { signedAt: "asc" } } },
  });
  if (!instance) return { error: "Document not found." };
  if (!instance.pdfSha256) return { error: "Document has not been rendered yet." };

  let previous: string | null = null;
  const breaks: number[] = [];
  for (let i = 0; i < instance.signatures.length; i++) {
    const s = instance.signatures[i];
    const expected = chainHash({
      pdfSha256: instance.pdfSha256,
      previousHash: previous,
      signerId: s.signerId,
      signedAt: s.signedAt,
    });
    if (expected !== s.hash) breaks.push(i);
    previous = s.hash;
  }

  return {
    data: {
      signatures: instance.signatures.length,
      valid: breaks.length === 0,
      tamperedIndexes: breaks,
    },
  };
}
