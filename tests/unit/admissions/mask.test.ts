import { describe, it, expect } from "vitest";
import {
  maskEnrollmentCode,
  maskBECEIndex,
  maskUnless,
} from "@/modules/admissions/utils/mask";

describe("maskEnrollmentCode", () => {
  it("keeps first 3 and last 2 chars for long codes", () => {
    expect(maskEnrollmentCode("ENCODE123")).toBe("ENC****23");
    expect(maskEnrollmentCode("ABCDEF12345")).toBe("ABC****45");
  });

  it("returns short codes unchanged to avoid over-masking", () => {
    expect(maskEnrollmentCode("ABC123")).toBe("ABC123"); // exactly 6
    expect(maskEnrollmentCode("XY12")).toBe("XY12");
  });

  it("handles null / undefined / empty", () => {
    expect(maskEnrollmentCode(null)).toBe("—");
    expect(maskEnrollmentCode(undefined)).toBe("—");
    expect(maskEnrollmentCode("")).toBe("—");
  });

  it("trims whitespace before masking", () => {
    expect(maskEnrollmentCode("  ENCODE123  ")).toBe("ENC****23");
  });
});

describe("maskBECEIndex", () => {
  it("masks 10-digit index with 2-char prefix/suffix", () => {
    expect(maskBECEIndex("0120045067")).toBe("01******67");
  });

  it("masks 12-digit index with 4-char prefix + 2-char suffix", () => {
    expect(maskBECEIndex("250120045067")).toBe("2501******67");
  });

  it("returns unchanged if shorter than 6 chars", () => {
    expect(maskBECEIndex("12345")).toBe("12345");
  });

  it("handles null / undefined", () => {
    expect(maskBECEIndex(null)).toBe("—");
    expect(maskBECEIndex(undefined)).toBe("—");
  });
});

describe("maskUnless", () => {
  it("returns raw value when canSeeFull is true", () => {
    expect(maskUnless(true, "ENCODE123", maskEnrollmentCode)).toBe("ENCODE123");
    expect(maskUnless(true, "0120045067", maskBECEIndex)).toBe("0120045067");
  });

  it("masks value when canSeeFull is false", () => {
    expect(maskUnless(false, "ENCODE123", maskEnrollmentCode)).toBe("ENC****23");
    expect(maskUnless(false, "0120045067", maskBECEIndex)).toBe("01******67");
  });

  it("renders null as em-dash regardless of flag", () => {
    expect(maskUnless(true, null, maskEnrollmentCode)).toBe("—");
    expect(maskUnless(false, null, maskEnrollmentCode)).toBe("—");
  });
});
