import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { getApplicationAction } from "@/modules/admissions/actions/admission.action";
import { ApplicationDetail } from "./application-detail";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getApplicationAction(id);
  if ("error" in result || !("data" in result)) {
    notFound();
  }

  const appData = result.data;

  const school = await db.school.findFirst();

  // Fetch class arms for enrollment dropdown
  const classArms = school
    ? await db.classArm.findMany({
        where: {
          status: "ACTIVE",
          class: {
            schoolId: school.id,
          },
        },
        include: {
          class: {
            select: { name: true },
          },
        },
        orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
      })
    : [];

  const classArmOptions = classArms.map((ca) => ({
    id: ca.id,
    label: `${ca.class.name} - ${ca.name}`,
  }));

  // Fetch programmes for display
  const programmes = school
    ? await db.programme.findMany({
        where: { schoolId: school.id, status: "ACTIVE" },
        select: { id: true, name: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Application: ${appData.applicationNumber}`}
        description={`${appData.firstName} ${appData.lastName}`}
        actions={
          <Link
            href="/admissions/applications"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to Applications
          </Link>
        }
      />
      <ApplicationDetail
        application={appData}
        classArmOptions={classArmOptions}
        programmes={programmes}
      />
    </div>
  );
}
