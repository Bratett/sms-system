import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getCourseAction } from "@/modules/lms/actions/course.action";
import { CourseDetailClient } from "./course-detail-client";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getCourseAction(id);
  if ("error" in result || !("data" in result) || !result.data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={result.data.title}
        description="Course details, lessons, and assignments."
        actions={
          <Link
            href="/lms"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to Courses
          </Link>
        }
      />
      <CourseDetailClient course={result.data} />
    </div>
  );
}
