import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { ApplicationForm } from "./application-form";
import Link from "next/link";

export default async function NewApplicationPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const school = await db.school.findFirst();
  const programmes = school
    ? await db.programme.findMany({
        where: { schoolId: school.id, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Admission Application"
        description="Create a new student admission application."
        actions={
          <Link
            href="/admissions/applications"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to Applications
          </Link>
        }
      />
      <ApplicationForm programmes={programmes} />
    </div>
  );
}
