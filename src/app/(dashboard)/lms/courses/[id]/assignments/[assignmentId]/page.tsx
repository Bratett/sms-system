import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getAssignmentAction,
  getSubmissionsAction,
} from "@/modules/lms/actions/assignment.action";
import { AssignmentDetailClient } from "./assignment-detail-client";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string; assignmentId: string }>;
}

export default async function AssignmentDetailPage({ params }: PageProps) {
  const { id, assignmentId } = await params;
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [assignmentResult, submissionsResult] = await Promise.all([
    getAssignmentAction(assignmentId),
    getSubmissionsAction(assignmentId),
  ]);

  if (assignmentResult.error || !assignmentResult.data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={assignmentResult.data.title}
        description="Assignment details, questions, and submissions."
        actions={
          <Link
            href={`/lms/courses/${id}/assignments`}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to Assignments
          </Link>
        }
      />
      <AssignmentDetailClient
        assignment={assignmentResult.data as never}
        submissions={(submissionsResult.data ?? []) as never}
      />
    </div>
  );
}
