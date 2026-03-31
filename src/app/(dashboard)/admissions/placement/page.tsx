import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { getApplicationsAction } from "@/modules/admissions/actions/admission.action";
import { PlacementClient } from "./placement-client";

export default async function PlacementPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;
  // Get current academic year for filtering class arms
  const currentAcademicYear = await db.academicYear.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });

  const [result, classArms] = await Promise.all([
    getApplicationsAction({
      status: "ACCEPTED",
      page: params.page ? parseInt(params.page) : 1,
      pageSize: 25,
    }),
    currentAcademicYear
      ? db.classArm.findMany({
          where: {
            status: "ACTIVE",
            class: { academicYearId: currentAcademicYear.id },
          },
          select: {
            id: true,
            name: true,
            class: { select: { name: true } },
          },
          orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const apps = result.data;
  const classArmOptions = classArms.map((ca) => ({
    id: ca.id,
    label: `${ca.class.name} - ${ca.name}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Placement"
        description="Assign accepted students to class arms for enrollment."
      />
      <PlacementClient
        applications={apps?.applications ?? []}
        total={apps?.total ?? 0}
        page={apps?.page ?? 1}
        pageSize={apps?.pageSize ?? 25}
        classArmOptions={classArmOptions}
      />
    </div>
  );
}
