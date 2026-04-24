import { describe, it, expect } from "vitest";
import {
  validateAttachment,
  buildAttachmentKey,
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "@/modules/messaging/attachments";

describe("validateAttachment", () => {
  it("accepts allowed MIME + size within limit", () => {
    const result = validateAttachment({
      mimeType: "application/pdf",
      size: 100_000,
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects unsupported MIME", () => {
    const result = validateAttachment({
      mimeType: "application/x-executable",
      size: 100,
    });
    expect(result).toEqual({ ok: false, error: expect.stringContaining("File type") });
  });

  it("rejects oversized file", () => {
    const result = validateAttachment({
      mimeType: "application/pdf",
      size: MAX_ATTACHMENT_SIZE_BYTES + 1,
    });
    expect(result).toEqual({ ok: false, error: expect.stringContaining("5 MB") });
  });

  it("accepts all whitelisted MIME types", () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      expect(validateAttachment({ mimeType: mime, size: 1024 })).toEqual({ ok: true });
    }
  });
});

describe("buildAttachmentKey", () => {
  it("uses schoolId + threadId + uuid + sanitized filename", () => {
    const key = buildAttachmentKey({
      schoolId: "school-1",
      threadId: "t-1",
      filename: "Homework Sheet #5.pdf",
    });
    expect(key).toMatch(/^messages\/school-1\/t-1\/[0-9a-f-]+-homework_sheet__5\.pdf$/);
  });

  it("prevents path traversal in filename", () => {
    const key = buildAttachmentKey({
      schoolId: "school-1",
      threadId: "t-1",
      filename: "../../etc/passwd",
    });
    expect(key).not.toContain("..");
    expect(key.startsWith("messages/school-1/t-1/")).toBe(true);
  });

  it('falls back to "file" when the filename is empty', () => {
    const key = buildAttachmentKey({
      schoolId: "school-1",
      threadId: "t-1",
      filename: "",
    });
    expect(key).toMatch(/^messages\/school-1\/t-1\/[0-9a-f-]+-file$/);
  });

  it('falls back to "file" when the filename is only a path separator', () => {
    const keyForward = buildAttachmentKey({
      schoolId: "school-1",
      threadId: "t-1",
      filename: "/",
    });
    const keyBack = buildAttachmentKey({
      schoolId: "school-1",
      threadId: "t-1",
      filename: "\\",
    });
    expect(keyForward).toMatch(/^messages\/school-1\/t-1\/[0-9a-f-]+-file$/);
    expect(keyBack).toMatch(/^messages\/school-1\/t-1\/[0-9a-f-]+-file$/);
  });
});
