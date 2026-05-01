import { describe, it, expect, vi } from "vitest";
import { mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { NextRequest, NextResponse } from "next/server";
import {
  authorizeReportRequest,
  isNextResponse,
  reportFileResponse,
  fireReportAudit,
  wrapReportRoute,
} from "@/modules/reports/route-helpers";

describe("authorizeReportRequest", () => {
  it("returns 401 NextResponse when unauthenticated", async () => {
    mockUnauthenticated();
    const result = await authorizeReportRequest();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 403 NextResponse when caller lacks permission", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await authorizeReportRequest();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns 400 NextResponse when no school context", async () => {
    mockAuthenticatedUser({ schoolId: null });
    const result = await authorizeReportRequest();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns session info when authorized", async () => {
    mockAuthenticatedUser();
    const result = await authorizeReportRequest();
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!isNextResponse(result)) {
      expect(result.userId).toBe("test-user-id");
      expect(result.schoolId).toBe("default-school");
      expect(result.permissions).toContain("*");
    }
  });
});

describe("reportFileResponse", () => {
  it("emits xlsx content-type and attachment disposition with ISO date", () => {
    const res = reportFileResponse({
      buffer: Buffer.from("xx"),
      format: "xlsx",
      filename: "roster",
    });
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="roster-\d{4}-\d{2}-\d{2}\.xlsx"/,
    );
  });

  it("emits pdf content-type for pdf format", () => {
    const res = reportFileResponse({
      buffer: Buffer.from("xx"),
      format: "pdf",
      filename: "roster",
    });
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toMatch(/\.pdf"$/);
  });
});

describe("fireReportAudit", () => {
  it("does not throw when audit insert rejects", async () => {
    const { audit } = await import("@/lib/audit");
    vi.mocked(audit).mockRejectedValueOnce(new Error("DB down"));
    // Must not throw
    expect(() =>
      fireReportAudit({
        userId: "u1",
        schoolId: "s1",
        reportSlug: "TEST",
        reportName: "Test",
        format: "xlsx",
        filters: {},
        rowCount: 0,
      }),
    ).not.toThrow();
    // Allow microtasks to flush
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe("wrapReportRoute", () => {
  it("returns the inner handler's response when it succeeds", async () => {
    const handler = wrapReportRoute(async () => NextResponse.json({ ok: true }));
    const res = await handler(new NextRequest("http://localhost/test"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 500 with error envelope when inner handler throws", async () => {
    const handler = wrapReportRoute(async () => {
      throw new Error("boom");
    });
    const res = await handler(new NextRequest("http://localhost/test"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Report generation failed" });
  });
});
