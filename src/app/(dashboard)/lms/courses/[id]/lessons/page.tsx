import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getCourseAction } from "@/modules/lms/actions/course.action";
import { LessonBuilderClient } from "./lesson-builder-client";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LessonsPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getCourseAction(id);
  if (result.error || !result.data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Lessons - ${result.data.title}`}
        description="Build and reorder lessons for this course."
        actions={
          <Link
            href={`/lms/courses/${id}`}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to Course
          </Link>
        }
      />
      <LessonBuilderClient
        courseId={id}
        initialLessons={result.data.lessons ?? []}
      />
    </div>
  );
}
