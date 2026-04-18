import Link from "next/link";
import { auth } from "@/lib/auth";
import { ModuleOverview } from "@/components/layout/module-overview";
import { getClassesAction } from "@/modules/academics/actions/class.action";
import { getSubjectsAction } from "@/modules/academics/actions/subject.action";
import { getSubmittedMarksAction } from "@/modules/academics/actions/mark.action";
import { getStudentStatsAction } from "@/modules/student/actions/student.action";

function dataOr<T>(result: unknown, fallback: T): T {
  return result && typeof result === "object" && "data" in result
    ? (result as { data: T }).data
    : fallback;
}

export default async function AcademicsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [classesRes, subjectsRes, submittedRes, statsRes] = await Promise.all([
    getClassesAction(),
    getSubjectsAction(),
    getSubmittedMarksAction({ status: "SUBMITTED" }),
    getStudentStatsAction(),
  ]);

  const classes = dataOr<Array<{ status: string }>>(classesRes, []);
  const subjects = dataOr<Array<{ status: string }>>(subjectsRes, []);
  const submitted = dataOr<
    Array<{
      subjectId: string;
      subjectName: string;
      subjectCode: string | null;
      classArmId: string;
      assessmentTypeName: string;
      marksCount: number;
      submittedAt: Date | null;
    }>
  >(submittedRes, []);
  const stats = dataOr<{ byStatus: { active: number } } | null>(statsRes, null);

  const activeClasses = classes.filter((c) => c.status === "ACTIVE").length || classes.length;
  const activeSubjects = subjects.filter((s) => s.status === "ACTIVE").length || subjects.length;
  const pendingApprovals = submitted.length;
  const activeStudents = stats?.byStatus.active ?? 0;

  const recent = submitted.slice(0, 5);

  return (
    <ModuleOverview
      title="Academics"
      description="Subjects, classes, assessments, results, and reports."
      kpis={[
        { label: "Active Classes", value: activeClasses },
        { label: "Active Subjects", value: activeSubjects },
        { label: "Pending Approvals", value: pendingApprovals, hint: "Marks awaiting approval" },
        { label: "Active Students", value: activeStudents.toLocaleString() },
      ]}
      quickActions={[
        { href: "/academics/assessments/mark-entry", label: "Enter Marks", icon: "FileText" },
        { href: "/academics/assessments/approval", label: "Approve Marks", icon: "Shield" },
        { href: "/academics/reports/terminal", label: "Report Cards", icon: "FileText" },
        { href: "/academics/results", label: "View Results", icon: "Award" },
      ]}
    >
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pending mark approvals
          </p>
          {recent.length > 0 && (
            <Link
              href="/academics/assessments/approval"
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No mark batches awaiting approval.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((m) => (
                <li key={`${m.subjectId}-${m.classArmId}-${m.assessmentTypeName}`}>
                  <Link
                    href="/academics/assessments/approval"
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {m.subjectName}
                        {m.subjectCode ? ` (${m.subjectCode})` : ""} — {m.assessmentTypeName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.marksCount} mark{m.marksCount === 1 ? "" : "s"}
                        {m.submittedAt
                          ? ` • submitted ${new Date(m.submittedAt).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModuleOverview>
  );
}
