"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";

// ─── CRUD for Attendance Policies ────────────────────────────────────

export async function createAttendancePolicyAction(data: {
  name: string;
  scope: "SCHOOL" | "CLASS" | "CLASS_ARM";
  scopeId?: string;
  metric: "ABSENCE_COUNT" | "ABSENCE_RATE" | "CONSECUTIVE_ABSENCES" | "LATE_COUNT";
  threshold: number;
  period: "WEEKLY" | "MONTHLY" | "TERM";
  severity: "INFO" | "WARNING" | "CRITICAL";
  actions?: string[];
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const policy = await db.attendancePolicy.create({
    data: {
      schoolId: school.id,
      name: data.name,
      scope: data.scope,
      scopeId: data.scopeId || null,
      metric: data.metric,
      threshold: data.threshold,
      period: data.period,
      severity: data.severity,
      actions: data.actions ?? undefined,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "AttendancePolicy",
    entityId: policy.id,
    module: "attendance",
    description: `Created attendance policy: ${data.name}`,
  });

  return { data: { id: policy.id } };
}

export async function getAttendancePoliciesAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const policies = await db.attendancePolicy.findMany({
    where: { schoolId: school.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { alerts: true } },
    },
  });

  const data = policies.map((p) => ({
    id: p.id,
    name: p.name,
    scope: p.scope,
    scopeId: p.scopeId,
    metric: p.metric,
    threshold: p.threshold,
    period: p.period,
    severity: p.severity,
    actions: p.actions as string[] | null,
    isActive: p.isActive,
    alertCount: p._count.alerts,
    createdAt: p.createdAt,
  }));

  return { data };
}

export async function updateAttendancePolicyAction(
  id: string,
  data: Partial<{
    name: string;
    threshold: number;
    severity: "INFO" | "WARNING" | "CRITICAL";
    isActive: boolean;
    actions: string[];
  }>,
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const policy = await db.attendancePolicy.findUnique({ where: { id } });
  if (!policy) return { error: "Policy not found." };

  await db.attendancePolicy.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.threshold !== undefined && { threshold: data.threshold }),
      ...(data.severity !== undefined && { severity: data.severity }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.actions !== undefined && { actions: data.actions }),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "AttendancePolicy",
    entityId: id,
    module: "attendance",
    description: `Updated attendance policy: ${policy.name}`,
  });

  return { success: true };
}

export async function deleteAttendancePolicyAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const policy = await db.attendancePolicy.findUnique({ where: { id } });
  if (!policy) return { error: "Policy not found." };

  await db.attendancePolicy.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "AttendancePolicy",
    entityId: id,
    module: "attendance",
    description: `Deleted attendance policy: ${policy.name}`,
  });

  return { success: true };
}

// ─── Alerts ──────────────────────────────────────────────────────────

export async function getAttendanceAlertsAction(filters?: {
  status?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  severity?: "INFO" | "WARNING" | "CRITICAL";
  studentId?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.status) where.status = filters.status;
  if (filters?.severity) where.severity = filters.severity;
  if (filters?.studentId) where.studentId = filters.studentId;

  const [alerts, total] = await Promise.all([
    db.attendanceAlert.findMany({
      where,
      include: {
        policy: { select: { name: true, metric: true, period: true } },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
    db.attendanceAlert.count({ where }),
  ]);

  // Get student names
  const studentIds = [...new Set(alerts.map((a) => a.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, studentId: true },
  });
  const studentMap = new Map(
    students.map((s) => [s.id, { name: `${s.firstName} ${s.lastName}`, studentId: s.studentId }]),
  );

  const data = alerts.map((a) => ({
    id: a.id,
    studentName: studentMap.get(a.studentId)?.name ?? "Unknown",
    studentNumber: studentMap.get(a.studentId)?.studentId ?? "",
    policyName: a.policy.name,
    metric: a.metric,
    currentValue: a.currentValue,
    threshold: a.threshold,
    severity: a.severity,
    status: a.status,
    notes: a.notes,
    createdAt: a.createdAt,
  }));

  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function acknowledgeAlertAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  await db.attendanceAlert.update({
    where: { id },
    data: { status: "ACKNOWLEDGED" },
  });

  return { success: true };
}

export async function resolveAlertAction(id: string, notes?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  await db.attendanceAlert.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedBy: session.user.id,
      resolvedAt: new Date(),
      notes: notes || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "AttendanceAlert",
    entityId: id,
    module: "attendance",
    description: "Resolved attendance alert",
  });

  return { success: true };
}

// ─── Evaluate Policies (called by worker or manually) ────────────────

export async function evaluateAttendancePoliciesAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const currentTerm = await db.term.findFirst({
    where: { isCurrent: true },
    select: { id: true, startDate: true, endDate: true },
  });

  if (!currentTerm) return { error: "No active term." };

  const policies = await db.attendancePolicy.findMany({
    where: { schoolId: school.id, isActive: true },
  });

  if (policies.length === 0) return { data: { evaluated: 0, alertsCreated: 0 } };

  // Get all active enrollments
  const enrollments = await db.enrollment.findMany({
    where: { status: "ACTIVE" },
    select: {
      studentId: true,
      classArmId: true,
      classArm: { select: { classId: true } },
    },
  });

  // Get all attendance records for the current term
  const registers = await db.attendanceRegister.findMany({
    where: {
      schoolId: school.id,
      date: { gte: currentTerm.startDate, lte: currentTerm.endDate },
    },
    include: { records: true },
  });

  // Build per-student counts
  const allRecords = registers.flatMap((r) =>
    r.records.map((rec) => ({ ...rec, classArmId: r.classArmId })),
  );

  const studentStats = new Map<
    string,
    { absent: number; late: number; total: number; classArmId: string; classId: string }
  >();

  for (const enrollment of enrollments) {
    const studentRecords = allRecords.filter(
      (r) => r.studentId === enrollment.studentId && r.classArmId === enrollment.classArmId,
    );

    studentStats.set(enrollment.studentId, {
      absent: studentRecords.filter((r) => r.status === "ABSENT").length,
      late: studentRecords.filter((r) => r.status === "LATE").length,
      total: studentRecords.length,
      classArmId: enrollment.classArmId,
      classId: enrollment.classArm.classId,
    });
  }

  let alertsCreated = 0;

  for (const policy of policies) {
    for (const [studentId, stats] of studentStats) {
      // Check scope
      if (policy.scope === "CLASS" && policy.scopeId && stats.classId !== policy.scopeId) continue;
      if (policy.scope === "CLASS_ARM" && policy.scopeId && stats.classArmId !== policy.scopeId) continue;

      // Calculate metric value
      let metricValue = 0;
      switch (policy.metric) {
        case "ABSENCE_COUNT":
          metricValue = stats.absent;
          break;
        case "ABSENCE_RATE":
          metricValue = stats.total > 0 ? (stats.absent / stats.total) * 100 : 0;
          break;
        case "LATE_COUNT":
          metricValue = stats.late;
          break;
        case "CONSECUTIVE_ABSENCES":
          // Simplified: use total absences as proxy
          metricValue = stats.absent;
          break;
      }

      if (metricValue >= policy.threshold) {
        // Check if alert already exists for this student/policy/term
        const existingAlert = await db.attendanceAlert.findFirst({
          where: {
            policyId: policy.id,
            studentId,
            termId: currentTerm.id,
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
          },
        });

        if (!existingAlert) {
          await db.attendanceAlert.create({
            data: {
              schoolId: school.id,
              policyId: policy.id,
              studentId,
              classArmId: stats.classArmId,
              termId: currentTerm.id,
              metric: policy.metric,
              currentValue: metricValue,
              threshold: policy.threshold,
              severity: policy.severity,
            },
          });
          alertsCreated++;

          // Dispatch notification to parents if severity is WARNING or CRITICAL
          if (policy.severity !== "INFO") {
            const student = await db.student.findUnique({
              where: { id: studentId },
              select: {
                firstName: true,
                lastName: true,
                guardians: {
                  include: {
                    guardian: { select: { userId: true, phone: true, email: true, firstName: true, lastName: true } },
                  },
                },
              },
            });

            if (student) {
              const event =
                policy.severity === "CRITICAL"
                  ? NOTIFICATION_EVENTS.CHRONIC_ABSENCE_CRITICAL
                  : NOTIFICATION_EVENTS.CHRONIC_ABSENCE_WARNING;

              const recipients = student.guardians.map((sg) => ({
                userId: sg.guardian.userId ?? undefined,
                phone: sg.guardian.phone ?? undefined,
                email: sg.guardian.email ?? undefined,
                name: `${sg.guardian.firstName} ${sg.guardian.lastName}`,
              }));

              if (recipients.length > 0) {
                dispatch({
                  event,
                  title: `Attendance ${policy.severity === "CRITICAL" ? "Critical" : "Warning"}`,
                  message: `${student.firstName} ${student.lastName} has triggered the "${policy.name}" attendance policy. Current ${policy.metric.toLowerCase().replace(/_/g, " ")}: ${Math.round(metricValue)}.`,
                  recipients,
                  schoolId: school.id,
                }).catch(() => {});
              }
            }
          }
        }
      }
    }
  }

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "AttendancePolicy",
    entityId: "evaluation",
    module: "attendance",
    description: `Evaluated ${policies.length} policies, created ${alertsCreated} alerts`,
  });

  return { data: { evaluated: policies.length, alertsCreated } };
}
