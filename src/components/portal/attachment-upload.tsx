"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

export type PortalAttachmentMeta = {
  attachmentKey: string;
  attachmentName: string;
  attachmentSize: number;
  attachmentMime: string;
};

type Props = {
  requestUploadUrl: (input: {
    filename: string;
    mimeType: string;
    size: number;
  }) => Promise<{ data: { uploadUrl: string; attachmentKey: string } } | { error: string }>;
  value: PortalAttachmentMeta | null;
  onChange: (meta: PortalAttachmentMeta | null) => void;
  disabled?: boolean;
};

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export function PortalAttachmentUpload({
  requestUploadUrl,
  value,
  onChange,
  disabled,
}: Props) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      toast.error("File type not allowed. Use PDF, JPG, PNG, HEIC, or WebP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("File too large. Maximum 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const res = await requestUploadUrl({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const put = await fetch(res.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        toast.error("Upload failed.");
        return;
      }
      onChange({
        attachmentKey: res.data.attachmentKey,
        attachmentName: file.name,
        attachmentSize: file.size,
        attachmentMime: file.type,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      {value ? (
        <div className="flex items-center gap-2 text-sm">
          <span>📎 {value.attachmentName} ({Math.round(value.attachmentSize / 1024)} KB)</span>
          <button
            type="button"
            className="text-xs text-red-600 hover:underline"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            remove
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED.join(",")}
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePick(file);
            }}
          />
          <button
            type="button"
            className="text-sm text-teal-600 hover:underline disabled:opacity-50"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Uploading…" : "Attach file (PDF/JPG/PNG, \u2264 5 MB)"}
          </button>
        </>
      )}
    </div>
  );
}
