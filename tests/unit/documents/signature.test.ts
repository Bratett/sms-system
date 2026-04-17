import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";

vi.mock("@/lib/storage/r2", () => ({
  uploadFile: vi.fn(async (key: string) => ({ key, url: `https://r2.example/${key}` })),
  generateFileKey: vi.fn((mod: string, id: string, fn: string) => `${mod}/${id}/${fn}`),
  getSignedDownloadUrl: vi.fn(async (key: string) => `https://r2.example/signed/${key}`),
}));

import {
  signInstanceAction,
  signInstanceWithTokenAction,
  verifyDocumentSignatureChainAction,
} from "@/modules/documents/actions/signature.action";
import { createHash } from "node:crypto";

function chainHash(pdfSha: string, previous: string | null, signerId: string, at: Date) {
  const h = createHash("sha256");
  h.update(pdfSha);
  h.update("|");
  h.update(previous ?? "GENESIS");
  h.update("|");
  h.update(signerId);
  h.update("|");
  h.update(at.toISOString());
  return h.digest("hex");
}

describe("signInstanceAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("refuses when the instance has not yet been rendered", async () => {
    prismaMock.documentInstance.findUnique
      .mockResolvedValueOnce({
        id: "i1",
        schoolId: "default-school",
      } as never) // first lookup in action
      .mockResolvedValueOnce({
        id: "i1",
        schoolId: "default-school",
        pdfSha256: null,
        status: "PENDING_RENDER",
        signatures: [],
      } as never); // recordSignature

    const r = await signInstanceAction({ instanceId: "i1", method: "TYPED" });
    expect(r.error).toMatch(/not been rendered/);
  });

  it("refuses to add a signature to a VOIDED instance", async () => {
    prismaMock.documentInstance.findUnique
      .mockResolvedValueOnce({ id: "i1", schoolId: "default-school" } as never)
      .mockResolvedValueOnce({
        id: "i1",
        schoolId: "default-school",
        pdfSha256: "pdfhash",
        status: "VOIDED",
        signatures: [],
      } as never);

    const r = await signInstanceAction({ instanceId: "i1", method: "TYPED" });
    expect(r.error).toMatch(/VOIDED/);
  });

  it("persists a genesis signature with a deterministic hash", async () => {
    prismaMock.documentInstance.findUnique
      .mockResolvedValueOnce({ id: "i1", schoolId: "default-school" } as never)
      .mockResolvedValueOnce({
        id: "i1",
        schoolId: "default-school",
        pdfSha256: "pdfhash",
        status: "AWAITING_SIGNATURES",
        signatures: [],
      } as never);
    prismaMock.documentSignature.create.mockResolvedValue({ id: "sig1" } as never);

    const r = await signInstanceAction({
      instanceId: "i1",
      method: "TYPED",
      payload: { typedName: "Ama" },
    });
    expect("data" in r).toBe(true);
    if ("data" in r) {
      expect(r.data.hash).toHaveLength(64);
    }
  });
});

describe("signInstanceWithTokenAction", () => {
  it("rejects unknown token", async () => {
    prismaMock.documentSignLink.findUnique.mockResolvedValue(null as never);
    const r = await signInstanceWithTokenAction({
      token: "x".repeat(32),
      method: "TYPED",
      typedName: "Ama",
    });
    expect(r).toEqual({ error: "This signing link is not valid." });
  });

  it("rejects consumed tokens", async () => {
    prismaMock.documentSignLink.findUnique.mockResolvedValue({
      id: "l1",
      instanceId: "i1",
      schoolId: "default-school",
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      signerName: null,
      signerRole: null,
    } as never);
    const r = await signInstanceWithTokenAction({
      token: "x".repeat(32),
      method: "TYPED",
      typedName: "Ama",
    });
    expect(r.error).toMatch(/already been used/);
  });

  it("rejects expired tokens", async () => {
    prismaMock.documentSignLink.findUnique.mockResolvedValue({
      id: "l1",
      instanceId: "i1",
      schoolId: "default-school",
      consumedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      signerName: null,
      signerRole: null,
    } as never);
    const r = await signInstanceWithTokenAction({
      token: "x".repeat(32),
      method: "TYPED",
      typedName: "Ama",
    });
    expect(r.error).toMatch(/expired/);
  });

  it("signs and marks the link consumed on happy path", async () => {
    prismaMock.documentSignLink.findUnique.mockResolvedValue({
      id: "l1",
      instanceId: "i1",
      schoolId: "default-school",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      signerName: "Guardian",
      signerRole: "Parent",
    } as never);
    prismaMock.documentInstance.findUnique.mockResolvedValue({
      id: "i1",
      schoolId: "default-school",
      pdfSha256: "pdfhash",
      status: "AWAITING_SIGNATURES",
      signatures: [],
    } as never);
    prismaMock.documentSignature.create.mockResolvedValue({ id: "sig1" } as never);

    const r = await signInstanceWithTokenAction({
      token: "x".repeat(32),
      method: "TYPED",
      typedName: "Ama Owusu",
    });
    expect("data" in r).toBe(true);
    expect(prismaMock.documentSignLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "l1" },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
  });
});

describe("verifyDocumentSignatureChainAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("reports an intact chain as valid", async () => {
    const signedAt1 = new Date("2026-04-16T10:00:00Z");
    const signedAt2 = new Date("2026-04-16T10:05:00Z");
    const h1 = chainHash("pdfhash", null, "u1", signedAt1);
    const h2 = chainHash("pdfhash", h1, "u2", signedAt2);

    prismaMock.documentInstance.findUnique.mockResolvedValue({
      id: "i1",
      schoolId: "default-school",
      pdfSha256: "pdfhash",
      signatures: [
        { signerId: "u1", signedAt: signedAt1, hash: h1 },
        { signerId: "u2", signedAt: signedAt2, hash: h2 },
      ],
    } as never);

    const r = await verifyDocumentSignatureChainAction("i1");
    expect("data" in r).toBe(true);
    if ("data" in r) {
      expect(r.data.valid).toBe(true);
      expect(r.data.tamperedIndexes).toEqual([]);
    }
  });

  it("flags a tampered chain", async () => {
    const signedAt1 = new Date("2026-04-16T10:00:00Z");
    prismaMock.documentInstance.findUnique.mockResolvedValue({
      id: "i1",
      schoolId: "default-school",
      pdfSha256: "pdfhash",
      signatures: [
        { signerId: "u1", signedAt: signedAt1, hash: "bad-hash" },
      ],
    } as never);

    const r = await verifyDocumentSignatureChainAction("i1");
    if ("data" in r) {
      expect(r.data.valid).toBe(false);
      expect(r.data.tamperedIndexes).toEqual([0]);
    }
  });
});
