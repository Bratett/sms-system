import { describe, it, expect } from "vitest";
import { generateQrDataUrl } from "@/lib/pdf/qr";

describe("generateQrDataUrl", () => {
  it("returns a PNG data URL prefix", async () => {
    const result = await generateQrDataUrl("SCH/2025/0001");
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("produces different output for different input", async () => {
    const a = await generateQrDataUrl("A");
    const b = await generateQrDataUrl("B");
    expect(a).not.toEqual(b);
  });
});
