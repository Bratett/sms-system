"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  resolveTargetedStudentsForRelease,
  groupRecipientsForFanOut,
} from "../release-targeting";
import {
  notifyReportCardReleased,
  notifyReportCardReminder,
} from "../release-notifications";

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ─── Initial Release ────────────────────────────────────────────────

export async function releaseReportCardsAction(input: {
  termId: string;
  classArmId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_PUBLISH);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const arm = await db.classArm.findFirst({
    where: { id: input.classArmId, schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  if (!arm) return { error: "Class arm not found" };

  const term = await db.term.findFirst({
    where: { id: input.termId, schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  if (!term) return { error: "Term not found" };

  const existing = await db.reportCardRelease.findUnique({
    where: { termId_classArmId: { termId: input.termId, classArmId: input.classArmId } },
  });
  if (existing) {
    return { error: "Already released. Use re-release if you need to refresh." };
  }

  const created = await db.reportCardRelease.create({
    data: {
      schoolId: ctx.schoolId,
      termId: input.termId,
      classArmId: input.classArmId,
      releasedByUserId: userId,
    },
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "ReportCardRelease",
    entityId: created.id,
    module: "academics",
    description: `Released report cards for ${arm.name} (${term.name})`,
    newData: { termId: input.termId, classArmId: input.classArmId },
  });

  // Fan-out (best-effort)
  try {
    const students = await db.student.findMany({
      where: {
        schoolId: ctx.schoolId,
        status: { in: ["ACTIVE", "SUSPENDED"] },
        enrollments: { some: { status: "ACTIVE", classArmId: input.classArmId } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        guardians: {
          select: { guardian: { select: { householdId: true, userId: true } } },
        },
      },
    });
    const groups = groupRecipientsForFanOut(students);
    if (groups.recipientUserIds.length > 0) {
      await notifyReportCardReleased({
        releaseId: created.id,
        termName: term.name,
        classArmName: arm.name,
        recipientUserIds: groups.recipientUserIds,
        studentNamesByUserId: groups.studentNamesByUserId,
        isReRelease: false,
      });
    }
  } catch (err) {
    console.error("notifyReportCardReleased failed", { releaseId: created.id, err });
  }

  return { data: { releaseId: created.id } };
}

// ─── Re-release ─────────────────────────────────────────────────────

export async function reReleaseReportCardsAction(input: {
  releaseId: string;
  resetAcknowledgements: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_PUBLISH);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const release = await db.reportCardRelease.findFirst({
    where: { id: input.releaseId, schoolId: ctx.schoolId },
    include: {
      term: { select: { name: true } },
      classArm: { select: { name: true } },
    },
  });
  if (!release) return { error: "Release not found" };

  await db.$transaction(async (tx) => {
    if (input.resetAcknowledgements) {
      await tx.reportCardAcknowledgement.deleteMany({
        where: { releaseId: input.releaseId },
      });
    }
    await tx.reportCardRelease.update({
      where: { id: input.releaseId },
      data: {
        releasedAt: new Date(),
        releasedByUserId: userId,
        lastReminderSentAt: null,
      },
    });
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "ReportCardRelease",
    entityId: input.releaseId,
    module: "academics",
    description: `Re-released report cards${input.resetAcknowledgements ? " (acknowledgements reset)" : ""}`,
    newData: { resetAcknowledgements: input.resetAcknowledgements },
  });

  // Fan-out
  try {
    const students = await db.student.findMany({
      where: {
        schoolId: ctx.schoolId,
        status: { in: ["ACTIVE", "SUSPENDED"] },
        enrollments: { some: { status: "ACTIVE", classArmId: release.classArmId } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        guardians: {
          select: { guardian: { select: { householdId: true, userId: true } } },
        },
      },
    });
    const groups = groupRecipientsForFanOut(students);
    if (groups.recipientUserIds.length > 0) {
      await notifyReportCardReleased({
        releaseId: release.id,
        termName: release.term.name,
        classArmName: release.classArm.name,
        recipientUserIds: groups.recipientUserIds,
        studentNamesByUserId: groups.studentNamesByUserId,
        isReRelease: true,
      });
    }
  } catch (err) {
    console.error("notifyReportCardReleased (re-release) failed", { releaseId: release.id, err });
  }

  return { success: true };
}

// ─── Stats ──────────────────────────────────────────────────────────

/** @no-audit Read-only admin stats. */
export async function getReleaseStatsAction(releaseId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_RELEASE_TRACK);
  if (denied) return denied;

  const release = await db.reportCardRelease.findFirst({
    where: { id: releaseId, schoolId: ctx.schoolId },
    select: {
      id: true,
      classArmId: true,
      termId: true,
      releasedAt: true,
      releasedByUserId: true,
      lastReminderSentAt: true,
    },
  });
  if (!release) return { error: "Release not found" };

  const targeted = await resolveTargetedStudentsForRelease({
    schoolId: ctx.schoolId,
    termId: release.termId,
    classArmId: release.classArmId,
  });
  const targetedIds = targeted.map((s) => s.id);

  const acknowledgedCount = await db.reportCardAcknowledgement.count({
    where: { releaseId, studentId: { in: targetedIds } },
  });

  const now = Date.now();
  const lastMs = release.lastReminderSentAt?.getTime() ?? 0;
  const canSendReminder = now - lastMs >= REMINDER_COOLDOWN_MS;

  return {
    data: {
      targetedStudents: targeted.length,
      acknowledgedStudents: acknowledgedCount,
      pendingStudents: targeted.length - acknowledgedCount,
      lastReminderSentAt: release.lastReminderSentAt,
      canSendReminder,
      releasedAt: release.releasedAt,
      releasedByUserId: release.releasedByUserId,
    },
  };
}

// ─── Per-student details ────────────────────────────────────────────

/** @no-audit Read-only admin detail. */
export async function getReleaseDetailsAction(releaseId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_RELEASE_TRACK);
  if (denied) return denied;

  const release = await db.reportCardRelease.findFirst({
    where: { id: releaseId, schoolId: ctx.schoolId },
    select: { classArmId: true, termId: true },
  });
  if (!release) return { error: "Release not found" };

  const students = await db.student.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      enrollments: { some: { status: "ACTIVE", classArmId: release.classArmId } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      guardians: {
        select: {
          guardian: {
            select: {
              householdId: true,
              household: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const acks = await db.reportCardAcknowledgement.findMany({
    where: { releaseId },
    select: {
      studentId: true,
      householdId: true,
      acknowledgedAt: true,
      acknowledgedBy: { select: { firstName: true, lastName: true } },
    },
  });
  const ackByPair = new Map(acks.map((a) => [`${a.studentId}|${a.householdId}`, a]));

  type Row = {
    studentId: string;
    studentName: string;
    householdId: string;
    householdName: string;
    acknowledged: boolean;
    acknowledgedAt: Date | null;
    acknowledgedBy: string | null;
  };

  const rows: Row[] = [];
  for (const s of students) {
    const studentName = `${s.firstName} ${s.lastName}`;
    for (const g of s.guardians) {
      const hid = g.guardian.householdId;
      if (!hid) continue;
      const ack = ackByPair.get(`${s.id}|${hid}`);
      rows.push({
        studentId: s.id,
        studentName,
        householdId: hid,
        householdName: g.guardian.household?.name ?? "(no household name)",
        acknowledged: !!ack,
        acknowledgedAt: ack?.acknowledgedAt ?? null,
        acknowledgedBy: ack?.acknowledgedBy
          ? [ack.acknowledgedBy.firstName, ack.acknowledgedBy.lastName]
              .filter(Boolean)
              .join(" ") || "(deleted user)"
          : null,
      });
    }
  }

  // Dedupe rows by (studentId, householdId)
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = `${r.studentId}|${r.householdId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Pending-first sort, then alphabetic
  unique.sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    return a.studentName.localeCompare(b.studentName);
  });

  return { data: unique };
}

// ─── Chase ──────────────────────────────────────────────────────────

export async function chaseReleaseAction(releaseId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_RELEASE_TRACK);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const release = await db.reportCardRelease.findFirst({
    where: { id: releaseId, schoolId: ctx.schoolId },
    include: {
      term: { select: { name: true } },
      classArm: { select: { name: true } },
    },
  });
  if (!release) return { error: "Release not found" };

  const now = Date.now();
  const lastMs = release.lastReminderSentAt?.getTime() ?? 0;
  const remainingMs = REMINDER_COOLDOWN_MS - (now - lastMs);
  if (remainingMs > 0) {
    const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return { error: `Reminder cooldown: ${hours} hour${hours === 1 ? "" : "s"} remaining.` };
  }

  const students = await db.student.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      enrollments: { some: { status: "ACTIVE", classArmId: release.classArmId } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      guardians: {
        select: { guardian: { select: { householdId: true, userId: true } } },
      },
    },
  });

  const acks = await db.reportCardAcknowledgement.findMany({
    where: { releaseId },
    select: { studentId: true, householdId: true },
  });
  const ackedPairs = new Set(acks.map((a) => `${a.studentId}|${a.householdId}`));

  const pendingStudents = students.filter((s) =>
    s.guardians.some((g) => {
      const hid = g.guardian.householdId;
      if (!hid) return false;
      return !ackedPairs.has(`${s.id}|${hid}`);
    }),
  );

  if (pendingStudents.length === 0) {
    return { error: "All households have acknowledged. No one to remind." };
  }

  const recipientGroupSource = pendingStudents.map((s) => ({
    ...s,
    guardians: s.guardians.filter((g) => {
      const hid = g.guardian.householdId;
      if (!hid) return false;
      return !ackedPairs.has(`${s.id}|${hid}`);
    }),
  }));
  const groups = groupRecipientsForFanOut(recipientGroupSource);

  await db.reportCardRelease.update({
    where: { id: releaseId },
    data: { lastReminderSentAt: new Date() },
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "ReportCardRelease",
    entityId: releaseId,
    module: "academics",
    description: `Sent acknowledgement reminder to ${groups.householdIds.length} household(s)`,
    newData: { recipientUserCount: groups.recipientUserIds.length },
  });

  try {
    if (groups.recipientUserIds.length > 0) {
      await notifyReportCardReminder({
        releaseId,
        termName: release.term.name,
        classArmName: release.classArm.name,
        recipientUserIds: groups.recipientUserIds,
        studentNamesByUserId: groups.studentNamesByUserId,
      });
    }
  } catch (err) {
    console.error("notifyReportCardReminder failed", { releaseId, err });
  }

  return { success: true, notifiedCount: groups.recipientUserIds.length };
}

// ─── Queue (admin page table) ───────────────────────────────────────

/** @no-audit Read-only admin queue. */
export async function getReleaseQueueAction(input?: { termId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_RELEASE_TRACK);
  if (denied) return denied;

  let termId = input?.termId;
  if (!termId) {
    const current = await db.term.findFirst({
      where: { schoolId: ctx.schoolId, isCurrent: true },
      select: { id: true },
    });
    termId = current?.id;
  }
  if (!termId) return { data: [] };

  const arms = await db.classArm.findMany({
    where: { schoolId: ctx.schoolId },
    select: {
      id: true,
      name: true,
      class: { select: { programme: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const releases = await db.reportCardRelease.findMany({
    where: { schoolId: ctx.schoolId, termId },
    select: {
      id: true,
      classArmId: true,
      releasedAt: true,
      releasedByUserId: true,
      lastReminderSentAt: true,
    },
  });
  const releaseByArm = new Map(releases.map((r) => [r.classArmId, r]));

  const rows = await Promise.all(
    arms.map(async (arm) => {
      const studentsEnrolled = await db.enrollment.count({
        where: {
          classArmId: arm.id,
          status: "ACTIVE",
          student: { status: { in: ["ACTIVE", "SUSPENDED"] } },
        },
      });
      const studentsWithResults = await db.terminalResult.count({
        where: { schoolId: ctx.schoolId, termId, classArmId: arm.id },
      });
      const release = releaseByArm.get(arm.id) ?? null;
      let acknowledgedStudents = 0;
      let pendingStudents = 0;
      if (release) {
        acknowledgedStudents = await db.reportCardAcknowledgement.count({
          where: { releaseId: release.id },
        });
        pendingStudents = Math.max(0, studentsEnrolled - acknowledgedStudents);
      }
      return {
        classArmId: arm.id,
        classArmName: arm.name,
        programmeName: arm.class?.programme?.name ?? "",
        studentsEnrolled,
        studentsWithResults,
        release,
        acknowledgedStudents,
        pendingStudents,
      };
    }),
  );

  return { data: { termId, rows } };
}
