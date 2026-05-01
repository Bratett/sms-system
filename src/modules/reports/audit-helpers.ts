import { audit } from "@/lib/audit";

export type ReportDownloadFormat = "xlsx" | "pdf";

export interface AuditReportDownloadParams {
  userId: string;
  schoolId: string;
  reportSlug: string; // e.g., "STUDENT_ROSTER"
  reportName: string; // e.g., "Class Roster"
  format: ReportDownloadFormat;
  filters: Record<string, unknown>;
  rowCount: number;
}

export async function auditReportDownload(params: AuditReportDownloadParams): Promise<void> {
  await audit({
    userId: params.userId,
    schoolId: params.schoolId,
    action: "EXPORT",
    entity: params.reportSlug,
    module: "reports",
    description: `Downloaded ${params.reportName} as ${params.format.toUpperCase()}`,
    metadata: {
      format: params.format,
      filters: params.filters,
      rowCount: params.rowCount,
    },
  });
}
