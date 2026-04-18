import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { getApplicationAction } from "@/modules/admissions/actions/admission.action";
import { ApplicationDetail } from "./application-detail";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getApplicationAction(id);
  if ("error" in result || !("data" in result)) {
    notFound();
  }

  const appData = result.data;

  const school = await db.school.findFirst();

  // Fetch class arms for enrollment dropdown
  const classArms = school
    ? await db.classArm.findMany({
        where: {
          status: "ACTIVE",
          class: {
            schoolId: school.id,
          },
        },
        include: {
          class: {
            select: { name: true },
          },
        },
        orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
      })
    : [];

  const classArmOptions = classArms.map((ca) => ({
    id: ca.id,
    label: `${ca.class.name} - ${ca.name}`,
  }));

  // Fetch programmes for display
  const programmes = school
    ? await db.programme.findMany({
        where: { schoolId: school.id, status: "ACTIVE" },
        select: { id: true, name: true },
      })
    : [];

  // Phase 4: fetch interview, decision, offer, and workflow history for the
  // extended right-column panels.
  const [interviews, decisions, offers, workflowInstance] = await Promise.all([
    db.admissionInterview.findMany({
      where: { applicationId: id },
      orderBy: { scheduledAt: "desc" },
    }),
    db.admissionDecision.findMany({
      where: { applicationId: id },
      include: { conditions: true },
      orderBy: { decidedAt: "desc" },
    }),
    db.admissionOffer.findMany({
      where: { applicationId: id },
      orderBy: { issuedAt: "desc" },
    }),
    db.workflowInstance.findUnique({
      where: {
        entityType_entityId: { entityType: "AdmissionApplication", entityId: id },
      },
    }),
  ]);

  const transitions = workflowInstance
    ? await db.workflowTransition.findMany({
        where: { instanceId: workflowInstance.id },
        orderBy: { occurredAt: "desc" },
        take: 50,
      })
    : [];

  const interviewRows = interviews.map((i) => ({
    id: i.id,
    scheduledAt: i.scheduledAt,
    location: i.location,
    academicScore: i.academicScore ? Number(i.academicScore) : null,
    behavioralScore: i.behavioralScore ? Number(i.behavioralScore) : null,
    parentScore: i.parentScore ? Number(i.parentScore) : null,
    totalScore: i.totalScore ? Number(i.totalScore) : null,
    outcome: i.outcome,
    notes: i.notes,
    recordedAt: i.recordedAt,
  }));

  const decisionRows = decisions.map((d) => ({
    id: d.id,
    decision: d.decision,
    decidedAt: d.decidedAt,
    reason: d.reason,
    autoDecision: d.autoDecision,
    decidedBy: d.decidedBy,
    conditions: d.conditions.map((c) => ({
      id: c.id,
      type: c.type,
      description: c.description,
      deadline: c.deadline,
      met: c.met,
      metAt: c.metAt,
    })),
  }));

  const offerRows = offers.map((o) => ({
    id: o.id,
    issuedAt: o.issuedAt,
    expiryDate: o.expiryDate,
    acceptedAt: o.acceptedAt,
    declinedAt: o.declinedAt,
    declineReason: o.declineReason,
  }));

  const transitionRows = transitions.map((t) => ({
    id: t.id,
    fromState: t.fromState,
    toState: t.toState,
    event: t.event,
    actorId: t.actorId,
    reason: t.reason,
    occurredAt: t.occurredAt,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Application: ${appData.applicationNumber}`}
        description={`${appData.firstName} ${appData.lastName}`}
        actions={
          <Link
            href="/admissions/applications"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to Applications
          </Link>
        }
      />
      <ApplicationDetail
        application={appData}
        classArmOptions={classArmOptions}
        programmes={programmes}
        interviews={interviewRows}
        decisions={decisionRows}
        offers={offerRows}
        transitions={transitionRows}
      />
    </div>
  );
}
