import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getCoursesAction } from "@/modules/lms/actions/course.action";
import { LmsClient } from "./lms-client";

export default async function LmsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getCoursesAction({});
  const courses = "data" in result ? result.data : [];
  const total = "total" in result ? result.total : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Management"
        description="Manage courses, lessons, and assignments."
      />
      <LmsClient initialCourses={courses} total={total} />
    </div>
  );
}
