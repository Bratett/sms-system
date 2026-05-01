import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { auditReportDownload, type ReportDownloadFormat } from "@/modules/reports/audit-helpers";
import { getExportContentType } from "@/lib/export";
import { logger } from "@/lib/logger";
import { slugify } from "@/lib/utils";

const log = logger.child({ module: "report-route-helpers" });

export interface AuthorizedReportSession {
  userId: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  userName: string;
  permissions: string[];
}

/**
 * Verifies the request has an authenticated user with REPORTS_ENROLLMENT_READ
 * (or wildcard `*`) permission and a school context.
 *
 * Returns either the session info or a NextResponse error to return directly.
 */
export async function authorizeReportRequest(): Promise<AuthorizedReportSession | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const perms: string[] = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.user.schoolId) {
    return NextResponse.json({ error: "No school context" }, { status: 400 });
  }
  return {
    userId: session.user.id,
    schoolId: session.user.schoolId,
    schoolName: session.user.schoolName ?? "School",
    schoolSlug: slugify(session.user.schoolName ?? "school"),
    userName: session.user.name ?? "Unknown",
    permissions: perms,
  };
}

/**
 * Type guard to narrow `authorizeReportRequest` results in route handlers.
 */
export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export interface ReportFileResponseInput {
  buffer: Buffer;
  format: ReportDownloadFormat;
  /** Filename stem without extension; ISO date and extension are appended. */
  filename: string;
  /** Optional school slug to prefix to the filename (multi-tenant safety). */
  schoolSlug?: string;
}

/**
 * Builds a NextResponse for a binary report download with consistent
 * Content-Type and Content-Disposition headers.
 */
export function reportFileResponse({ buffer, format, filename, schoolSlug }: ReportFileResponseInput): NextResponse {
  const date = new Date().toISOString().slice(0, 10);
  const contentType = format === "pdf" ? "application/pdf" : getExportContentType("xlsx");
  const fullName = schoolSlug ? `${schoolSlug}-${filename}-${date}` : `${filename}-${date}`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fullName}.${format}"`,
    },
  });
}

export interface FireAuditInput {
  userId: string;
  schoolId: string;
  reportSlug: string;
  reportName: string;
  format: ReportDownloadFormat;
  filters: Record<string, unknown>;
  rowCount: number;
}

/**
 * Fire-and-forget audit. Logs errors but never throws — audit failures
 * should not break a successful download.
 */
export function fireReportAudit(input: FireAuditInput): void {
  auditReportDownload(input).catch((err: unknown) => {
    log.error("Failed to write report-download audit row", {
      err: err instanceof Error ? err.message : err,
      reportSlug: input.reportSlug,
    });
  });
}

/**
 * Wraps a route handler so any uncaught error is logged and returns a 500.
 * Use as: `export const GET = wrapReportRoute(async (request) => { ... });`
 */
export function wrapReportRoute(
  handler: (request: NextRequest) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    try {
      return await handler(request);
    } catch (err) {
      log.error("Report route handler threw", {
        err: err instanceof Error ? err.message : err,
        url: request.url,
      });
      return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
    }
  };
}
