import { describe, it, expect, vi, beforeEach } from "vitest";
import { audit } from "@/lib/audit";
import { auditReportDownload } from "@/modules/reports/audit-helpers";

vi.mock("@/lib/audit", () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

describe("auditReportDownload", () => {
  beforeEach(() => {
    vi.mocked(audit).mockClear();
  });

  it("writes one AuditLog row with EXPORT action and report slug", async () => {
    await auditReportDownload({
      userId: "u1",
      schoolId: "s1",
      reportSlug: "STUDENT_ROSTER",
      reportName: "Class Roster",
      format: "xlsx",
      filters: { academicYearId: "ay1" },
      rowCount: 42,
    });

    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        schoolId: "s1",
        action: "EXPORT",
        entity: "STUDENT_ROSTER",
        module: "reports",
        description: expect.stringContaining("Class Roster"),
        metadata: expect.objectContaining({
          format: "xlsx",
          filters: { academicYearId: "ay1" },
          rowCount: 42,
        }),
      }),
    );
  });
});
