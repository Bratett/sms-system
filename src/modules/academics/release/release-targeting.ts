import { db } from "@/lib/db";

export type TargetedStudent = {
  id: string;
  firstName: string;
  lastName: string;
};

/**
 * Returns students with active enrollment in the given (termId, classArmId)
 * for the given school. Filters out WITHDRAWN/GRADUATED/TRANSFERRED.
 *
 * Pure-ish: single Prisma read, no side effects. Used by:
 *  - releaseReportCardsAction (initial fan-out targeting)
 *  - reReleaseReportCardsAction (re-fan-out + ack-reset scope)
 *  - chaseReleaseAction (resolves pending households)
 *  - getReleaseStatsAction (denominator for "X of Y acknowledged")
 *  - getReleaseDetailsAction (per-student rows for the admin tracker)
 */
export async function resolveTargetedStudentsForRelease(input: {
  schoolId: string;
  termId: string;
  classArmId: string;
}): Promise<TargetedStudent[]> {
  const students = await db.student.findMany({
    where: {
      schoolId: input.schoolId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      enrollments: {
        some: { status: "ACTIVE", classArmId: input.classArmId },
      },
    },
    select: { id: true, firstName: true, lastName: true },
  });
  return students;
}

type StudentWithGuardians = {
  id: string;
  firstName: string;
  lastName: string;
  guardians: Array<{
    guardian: { householdId: string | null; userId: string | null };
  }>;
};

export type FanOutGroups = {
  recipientUserIds: string[];
  householdIds: string[];
  studentNamesByUserId: Map<string, string[]>;
};

/**
 * Given students-with-guardian-relations, builds the fan-out shape.
 * Pure — no DB.
 */
export function groupRecipientsForFanOut(
  students: StudentWithGuardians[],
): FanOutGroups {
  const recipientUserIds = new Set<string>();
  const householdIds = new Set<string>();
  const studentNamesByUserId = new Map<string, string[]>();

  for (const s of students) {
    const fullName = `${s.firstName} ${s.lastName}`;
    for (const g of s.guardians) {
      const { userId, householdId } = g.guardian;
      if (!userId || !householdId) continue;
      recipientUserIds.add(userId);
      householdIds.add(householdId);
      const list = studentNamesByUserId.get(userId);
      if (list) {
        if (!list.includes(fullName)) list.push(fullName);
      } else {
        studentNamesByUserId.set(userId, [fullName]);
      }
    }
  }

  return {
    recipientUserIds: [...recipientUserIds],
    householdIds: [...householdIds],
    studentNamesByUserId,
  };
}
