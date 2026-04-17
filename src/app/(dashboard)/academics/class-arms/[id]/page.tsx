import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getClassArmDetailAction } from "@/modules/academics/actions/class.action";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClassArmDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) return null;

  const { id } = await params;
  const result = await getClassArmDetailAction(id);

  if ("error" in result || !("data" in result) || !result.data) {
    notFound();
  }

  const arm = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${arm.class.name} ${arm.name}`}
        description={`${arm.class.programmeName} · ${arm.class.academicYearName}`}
      />

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Students Enrolled</p>
          <p className="mt-1 text-2xl font-semibold">{arm.enrollments.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Capacity</p>
          <p className="mt-1 text-2xl font-semibold">{arm.capacity ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Year Group</p>
          <p className="mt-1 text-2xl font-semibold">{arm.class.yearGroup ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Subjects Assigned</p>
          <p className="mt-1 text-2xl font-semibold">{arm.subjectAssignments.length}</p>
        </div>
      </div>

      {/* Student roster */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Student Roster</h3>
        {arm.enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No students enrolled in this arm.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Student ID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Gender</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {arm.enrollments.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{e.student.studentId}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/students/${e.student.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {e.student.firstName} {e.student.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.student.gender}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.student.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subject assignments */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Subjects & Teachers</h3>
        {arm.subjectAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No subjects assigned yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Teacher</th>
                </tr>
              </thead>
              <tbody>
                {arm.subjectAssignments.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">{a.subjectName}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {a.subjectCode ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.staffId ? (
                        <Link
                          href={`/hr/staff/${a.staffId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {a.staffName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
