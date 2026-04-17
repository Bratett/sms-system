import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";

vi.mock("@/lib/notifications/dispatcher", () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

// Allow all OTP requests through rate-limiter in unit tests.
vi.mock("@/lib/rate-limit", async (orig) => {
  const actual = (await orig()) as typeof import("@/lib/rate-limit");
  return {
    ...actual,
    rateLimit: () => ({
      check: async () => ({ limit: 1000, remaining: 999, reset: Date.now() + 1000 }),
    }),
  };
});

import {
  requestGuardianOtpAction,
  verifyGuardianOtpAction,
} from "@/modules/boarding/actions/exeat-otp.action";

describe("requestGuardianOtpAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const r = await requestGuardianOtpAction({ exeatId: "e1" });
    expect(r).toEqual({ error: "Unauthorized" });
  });

  it("returns error when exeat not found", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue(null as never);
    const r = await requestGuardianOtpAction({ exeatId: "nonexistent" });
    expect(r).toEqual({ error: "Exeat not found." });
  });

  it("rejects when exeat is not yet HEADMASTER_APPROVED", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "e1",
      schoolId: "default-school",
      status: "HOUSEMASTER_APPROVED",
      guardianPhone: "0241111111",
    } as never);
    const r = await requestGuardianOtpAction({ exeatId: "e1" });
    expect(r).toEqual({
      error: "Exeat must be approved by headmaster before requesting an OTP.",
    });
  });

  it("rejects when exeat has no guardian phone", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "e1",
      schoolId: "default-school",
      status: "HEADMASTER_APPROVED",
      guardianPhone: null,
    } as never);
    const r = await requestGuardianOtpAction({ exeatId: "e1" });
    expect(r).toEqual({ error: "No guardian phone on record for this exeat." });
  });

  it("creates an OTP row and returns a masked phone", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "e1",
      schoolId: "default-school",
      status: "HEADMASTER_APPROVED",
      guardianPhone: "0241234567",
      guardianName: "Ama Owusu",
      exeatNumber: "EXT/2026/0001",
    } as never);
    prismaMock.exeatOtp.create.mockResolvedValue({
      id: "otp-1",
      channel: "SMS",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    } as never);

    const r = await requestGuardianOtpAction({ exeatId: "e1" });
    expect("data" in r).toBe(true);
    if ("data" in r) {
      expect(r.data.sentTo).toBe("024******67");
      expect(r.data.otpId).toBe("otp-1");
    }
    expect(prismaMock.exeatOtp.create).toHaveBeenCalled();
  });
});

describe("verifyGuardianOtpAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects non-6-digit codes", async () => {
    const r = await verifyGuardianOtpAction({ exeatId: "e1", code: "12" });
    expect(r).toEqual({ error: "Code must be 6 digits." });
  });

  it("returns error when no active OTP exists", async () => {
    prismaMock.exeatOtp.findFirst.mockResolvedValue(null as never);
    const r = await verifyGuardianOtpAction({ exeatId: "e1", code: "123456" });
    expect(r).toEqual({ error: "No active OTP for this exeat. Request a new one." });
  });

  it("expires OTPs past their expiresAt", async () => {
    prismaMock.exeatOtp.findFirst.mockResolvedValue({
      id: "otp-1",
      expiresAt: new Date(Date.now() - 60_000),
      attempts: 0,
      maxAttempts: 5,
      codeHash: "salt:hash",
    } as never);
    const r = await verifyGuardianOtpAction({ exeatId: "e1", code: "123456" });
    expect(r).toEqual({ error: "OTP has expired. Request a new one." });
    expect(prismaMock.exeatOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "EXPIRED" }) }),
    );
  });

  it("rejects when attempts are already exhausted", async () => {
    prismaMock.exeatOtp.findFirst.mockResolvedValue({
      id: "otp-1",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 5,
      maxAttempts: 5,
      codeHash: "salt:hash",
    } as never);
    const r = await verifyGuardianOtpAction({ exeatId: "e1", code: "123456" });
    expect(r).toEqual({ error: "Too many failed attempts on this OTP. Request a new one." });
  });

  it("increments attempts and decrements remaining on wrong code", async () => {
    prismaMock.exeatOtp.findFirst.mockResolvedValue({
      id: "otp-1",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 1,
      maxAttempts: 5,
      codeHash: "someSalt:somehash",
    } as never);
    const r = await verifyGuardianOtpAction({ exeatId: "e1", code: "654321" });
    expect(r).toMatchObject({ error: "Incorrect code.", attemptsRemaining: 3 });
  });
});
