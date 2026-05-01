import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentMissingDocsAction } from "@/modules/reports/actions/student-missing-docs.action";
import { MissingDocumentsClient } from "./missing-documents-client";

export default async function MissingDocumentsPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string; classArmId?: string; documentTypeId?: string; includeExpired?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const sp = await searchParams;
  const includeExpired = sp.includeExpired !== "0";

  const [filtersR, docTypes, reportR] = await Promise.all([
    getReportFiltersAction(),
    db.documentType.findMany({
      where: { schoolId: session.user.schoolId!, isRequired: true, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getStudentMissingDocsAction({
      academicYearId: sp.academicYearId, classArmId: sp.classArmId,
      documentTypeId: sp.documentTypeId, includeExpired,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Missing Documents" description="Active students missing or expired on required documents." />
      <MissingDocumentsClient
        academicYears={"data" in filtersR ? filtersR.data.academicYears : []}
        classArms={"data" in filtersR ? filtersR.data.classArms : []}
        documentTypes={docTypes}
        report={"data" in reportR ? reportR.data : null}
        error={"error" in reportR ? reportR.error : null}
        appliedFilters={{ academicYearId: sp.academicYearId, classArmId: sp.classArmId, documentTypeId: sp.documentTypeId, includeExpired: sp.includeExpired }}
      />
    </div>
  );
}
