import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getExamSchedulesAction } from "@/modules/timetable/actions/exam-schedule.action";
import { ExamScheduleClient } from "./exam-schedule-client";

export default async function ExamSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ termId?: string; classId?: string; subjectId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;

  const result = await getExamSchedulesAction({
    termId: params.termId,
    classId: params.classId,
    subjectId: params.subjectId,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Schedule"
        description="Manage examination timetables and room assignments."
      />
      <ExamScheduleClient
        exams={result.data ?? []}
        filters={params}
      />
    </div>
  );
}
