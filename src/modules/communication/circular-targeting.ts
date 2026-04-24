import { db } from "@/lib/db";

type TargetType = "all" | "class" | "programme" | "house" | "specific";

/**
 * Given an Announcement's targetType + targetIds, return the unique set of
 * household ids (across the school) whose students match the targeting.
 *
 * - "all" → every household with at least one ACTIVE/SUSPENDED student in the school
 * - "class" → households whose students have an active Enrollment in any classId in targetIds
 * - "programme" → households via enrollment.classArm.class.programmeId
 * - "house" → households via StudentHouse assignment
 * - "specific" → households via student.id ∈ targetIds
 */
export async function resolveTargetedHouseholdIds(input: {
  schoolId: string;
  targetType: TargetType;
  targetIds: string[] | null;
}): Promise<string[]> {
  const { schoolId, targetType, targetIds } = input;

  if (targetType !== "all" && (!targetIds || targetIds.length === 0)) {
    return [];
  }

  const baseWhere: Record<string, unknown> = {
    schoolId,
    status: { in: ["ACTIVE", "SUSPENDED"] },
  };

  switch (targetType) {
    case "all":
      break;
    case "class":
      baseWhere.enrollments = {
        some: { status: "ACTIVE", classArm: { classId: { in: targetIds! } } },
      };
      break;
    case "programme":
      baseWhere.enrollments = {
        some: { status: "ACTIVE", classArm: { class: { programmeId: { in: targetIds! } } } },
      };
      break;
    case "house":
      baseWhere.houseAssignment = { houseId: { in: targetIds! } };
      break;
    case "specific":
      baseWhere.id = { in: targetIds! };
      break;
    default:
      return [];
  }

  const students = await db.student.findMany({
    where: baseWhere as never,
    select: {
      id: true,
      guardians: { select: { guardian: { select: { householdId: true } } } },
    },
  });

  const householdIds = new Set<string>();
  for (const s of students) {
    for (const g of s.guardians) {
      const hid = g.guardian.householdId;
      if (hid) householdIds.add(hid);
    }
  }
  return [...householdIds];
}

export function doesAnnouncementTargetGuardian(
  announcement: { targetType: string | null; targetIds: unknown },
  guardianStudentIds: string[],
  guardianStudentContexts: Array<{
    id: string;
    classArmId: string | null;
    classId: string | null;
    programmeId: string | null;
    houseId: string | null;
  }>,
): boolean {
  const tIds = Array.isArray(announcement.targetIds)
    ? announcement.targetIds.filter((x): x is string => typeof x === "string")
    : null;

  switch (announcement.targetType) {
    case "all":
      return guardianStudentIds.length > 0;
    case "class":
      if (!tIds) return false;
      return guardianStudentContexts.some((s) => s.classId != null && tIds.includes(s.classId));
    case "programme":
      if (!tIds) return false;
      return guardianStudentContexts.some((s) => s.programmeId != null && tIds.includes(s.programmeId));
    case "house":
      if (!tIds) return false;
      return guardianStudentContexts.some((s) => s.houseId != null && tIds.includes(s.houseId));
    case "specific":
      if (!tIds) return false;
      return guardianStudentIds.some((id) => tIds.includes(id));
    default:
      return false;
  }
}
