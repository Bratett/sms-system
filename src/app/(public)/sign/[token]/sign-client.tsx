"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { signInstanceWithTokenAction } from "@/modules/documents/actions/signature.action";

interface InstanceInfo {
  id: string;
  templateName: string;
  templateKey: string;
  pdfSha256: string;
}

interface SignerInfo {
  name: string | null;
  role: string | null;
  email: string | null;
  expiresAt: string;
}

export function SignPageClient({
  token,
  instance,
  signer,
}: {
  token: string;
  instance: InstanceInfo;
  signer: SignerInfo;
}) {
  const [pending, startTransition] = useTransition();
  const [typedName, setTypedName] = useState(signer.name ?? "");
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<"idle" | "signed">("idle");
  const [hash, setHash] = useState<string | null>(null);

  function handleSign() {
    if (!typedName.trim() || !agreed) return;
    startTransition(async () => {
      const result = await signInstanceWithTokenAction({
        token,
        method: "TYPED",
        typedName: typedName.trim(),
        payload: { typedName: typedName.trim() },
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setStatus("signed");
        setHash(result.data.hash);
        toast.success("Document signed.");
      }
    });
  }

  if (status === "signed") {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded border border-green-200 bg-green-50 p-6">
          <h1 className="mb-2 text-xl font-semibold text-green-900">Thank you — signed</h1>
          <p className="mb-3 text-sm text-green-800">
            Your signature has been recorded on document{" "}
            <strong>{instance.templateName}</strong>.
          </p>
          <p className="text-xs text-green-700">
            Reference hash:{" "}
            <span className="font-mono">{hash?.slice(0, 16)}…</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <div className="rounded border border-gray-200 bg-white p-6 shadow">
        <h1 className="mb-2 text-xl font-semibold">Sign document</h1>
        <div className="mb-3 text-sm text-gray-600">
          <div>
            <strong>Document:</strong> {instance.templateName}
          </div>
          {signer.role && (
            <div>
              <strong>Signing as:</strong> {signer.role}
              {signer.name ? ` (${signer.name})` : ""}
            </div>
          )}
          <div>
            <strong>Link expires:</strong>{" "}
            {new Date(signer.expiresAt).toLocaleString("en-GB")}
          </div>
          <div className="mt-2 break-all font-mono text-xs text-gray-500">
            PDF SHA-256: {instance.pdfSha256}
          </div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium">
            Type your full name as your signature
          </span>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded border border-gray-300 p-3 text-lg"
          />
        </label>

        <label className="mb-4 flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>
            I confirm that I have read the document identified by the SHA-256
            hash above and that typing my name constitutes my signature on it.
            This is a school-trust signature — it is not a PKI certificate.
          </span>
        </label>

        <button
          onClick={handleSign}
          disabled={pending || !typedName.trim() || !agreed}
          className="w-full rounded bg-blue-600 p-3 text-white disabled:opacity-50"
        >
          {pending ? "Signing…" : "Sign document"}
        </button>
      </div>
    </div>
  );
}
