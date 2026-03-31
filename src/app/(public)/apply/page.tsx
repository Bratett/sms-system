import { db } from "@/lib/db";
import { ApplicationPortalForm } from "./application-portal-form";

export default async function ApplyPage() {
  const school = await db.school.findFirst({ select: { id: true, name: true } });
  if (!school) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Unavailable</h2>
        <p className="text-muted-foreground">
          The admissions portal is not currently available. Please contact the school directly.
        </p>
      </div>
    );
  }

  const academicYear = await db.academicYear.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true },
  });

  if (!academicYear) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Admissions Closed</h2>
        <p className="text-muted-foreground">
          Admissions are currently closed. Please check back later or contact the school for more information.
        </p>
        <a
          href="/apply/status"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          Check an existing application status
        </a>
      </div>
    );
  }

  const programmes = await db.programme.findMany({
    where: { schoolId: school.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Apply for Admission</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Academic Year: {academicYear.name} &middot;{" "}
          <a href="/apply/status" className="text-primary hover:underline">
            Check existing application status
          </a>
        </p>
      </div>
      <ApplicationPortalForm
        programmes={programmes}
        schoolName={school.name}
      />
    </div>
  );
}
