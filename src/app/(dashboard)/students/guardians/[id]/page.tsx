import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getGuardianAction } from "@/modules/student/actions/guardian.action";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GuardianDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) return null;

  const { id } = await params;
  const result = await getGuardianAction(id);

  if ("error" in result || !("data" in result) || !result.data) {
    notFound();
  }

  const guardian = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${guardian.firstName} ${guardian.lastName}`}
        description={guardian.relationship ?? "Guardian"}
      />

      {/* Contact */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Contact</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{guardian.phone}</dd>
            {guardian.altPhone && (
              <>
                <dt className="text-muted-foreground">Alt Phone</dt>
                <dd>{guardian.altPhone}</dd>
              </>
            )}
            {guardian.email && (
              <>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{guardian.email}</dd>
              </>
            )}
            {guardian.address && (
              <>
                <dt className="text-muted-foreground">Address</dt>
                <dd>{guardian.address}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Details</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Relationship</dt>
            <dd>{guardian.relationship ?? "—"}</dd>
            {guardian.occupation && (
              <>
                <dt className="text-muted-foreground">Occupation</dt>
                <dd>{guardian.occupation}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Children */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Children ({guardian.students.length})</h3>
        {guardian.students.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No students linked to this guardian.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Student ID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Relationship</th>
                </tr>
              </thead>
              <tbody>
                {guardian.students.map((s) => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{s.studentId}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/students/${s.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {s.firstName} {s.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.isPrimary ? "Primary guardian" : "Guardian"}
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
