import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SignPageClient } from "./sign-client";

/**
 * Public tokenised signing page. Anyone with the URL can see the document
 * metadata and submit a signature, subject to `DocumentSignLink.expiresAt`
 * and single-use enforcement.
 *
 * The PDF itself is NOT embedded on this page by default — only its SHA-256
 * so the signer can cross-check with an email-attached copy. To surface a
 * live preview, wire a signed-URL fetch gated on the token hash.
 */

export const dynamic = "force-dynamic";

export default async function PublicSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 20) return notFound();

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const link = await db.documentSignLink.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      instanceId: true,
      signerName: true,
      signerRole: true,
      signerEmail: true,
      expiresAt: true,
      consumedAt: true,
    },
  });

  if (!link) {
    return (
      <SignStateCard
        title="Link not valid"
        body="This signing link does not exist or has been revoked. Please contact the school office."
      />
    );
  }
  if (link.consumedAt) {
    return (
      <SignStateCard
        title="Already signed"
        body="This signing link has already been used. Each link can only be signed once."
      />
    );
  }
  // Server-component async function runs once per request, so wall-clock
  // access is deterministic within a single render pass. The react-hooks
  // purity rule doesn't distinguish server from client components; this
  // disable is scoped to the single call.
  // eslint-disable-next-line react-hooks/purity
  if (link.expiresAt.getTime() < Date.now()) {
    return (
      <SignStateCard
        title="Link expired"
        body="This signing link has expired. Please request a new one from the school."
      />
    );
  }

  const instance = await db.documentInstance.findUnique({
    where: { id: link.instanceId },
    select: {
      id: true,
      pdfSha256: true,
      status: true,
      template: { select: { name: true, key: true } },
    },
  });
  if (!instance) return notFound();

  return (
    <SignPageClient
      token={token}
      instance={{
        id: instance.id,
        templateName: instance.template.name,
        templateKey: instance.template.key,
        pdfSha256: instance.pdfSha256 ?? "",
      }}
      signer={{
        name: link.signerName,
        role: link.signerRole,
        email: link.signerEmail,
        expiresAt: link.expiresAt.toISOString(),
      }}
    />
  );
}

function SignStateCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="rounded border border-gray-200 bg-white p-6 shadow">
        <h1 className="mb-2 text-xl font-semibold">{title}</h1>
        <p className="text-sm text-gray-600">{body}</p>
      </div>
    </div>
  );
}
