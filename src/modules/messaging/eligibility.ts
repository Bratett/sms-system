export type StudentContext = {
  id: string;
  schoolId: string;
  status: "ACTIVE" | "SUSPENDED" | "TRANSFERRED" | "WITHDRAWN" | "GRADUATED";
  boardingStatus: "DAY" | "BOARDING";
  classArmId: string | null;
  houseId: string | null;
};

export type StaffAssignment = {
  userId: string;
  role: "class_teacher" | "housemaster" | "subject_teacher";
  classArmId?: string;
  houseId?: string;
};

export type GuardianLink = {
  userId: string;
  studentId: string;
  householdId: string | null;
};

const MESSAGEABLE_STATUSES = new Set(["ACTIVE", "SUSPENDED"]);

/**
 * Returns the staff role that grants eligibility to message about the student,
 * or null if no eligibility. Pure — no DB or network.
 *
 * Rules:
 *  - Student must be ACTIVE or SUSPENDED (not TRANSFERRED/WITHDRAWN/GRADUATED)
 *  - class_teacher with matching classArmId → "class_teacher"
 *  - housemaster with matching houseId AND student.boardingStatus === "BOARDING" → "housemaster"
 *  - Otherwise null
 */
export function eligibleStaffRole(
  staff: StaffAssignment,
  student: StudentContext,
): "class_teacher" | "housemaster" | null {
  if (!MESSAGEABLE_STATUSES.has(student.status)) return null;

  if (
    staff.role === "class_teacher" &&
    staff.classArmId != null &&
    staff.classArmId === student.classArmId
  ) {
    return "class_teacher";
  }

  if (
    staff.role === "housemaster" &&
    staff.houseId != null &&
    staff.houseId === student.houseId &&
    student.boardingStatus === "BOARDING"
  ) {
    return "housemaster";
  }

  return null;
}

/**
 * Returns true if the user is a household guardian of the student.
 * Pure.
 */
export function parentCanMessageAbout(
  guardianLinks: GuardianLink[],
  userId: string,
  studentId: string,
): boolean {
  return guardianLinks.some(
    (g) => g.userId === userId && g.studentId === studentId,
  );
}

/**
 * Filters assignments to those eligible for this student.
 * Pure.
 */
export function eligibleTeachersForStudent(
  student: StudentContext,
  assignments: StaffAssignment[],
): StaffAssignment[] {
  return assignments.filter((a) => eligibleStaffRole(a, student) !== null);
}

/**
 * Spam rate-limit calculator. Returns true if another message would exceed
 * `limit` within the trailing `windowMs`.
 *
 * Pure — caller provides recent timestamps and "now".
 */
export function isRateLimited(
  recentMessageTimestamps: Date[],
  now: Date = new Date(),
  windowMs: number = 60 * 60 * 1000,
  limit: number = 10,
): boolean {
  const threshold = now.getTime() - windowMs;
  const recentCount = recentMessageTimestamps.filter(
    (t) => t.getTime() >= threshold,
  ).length;
  return recentCount >= limit;
}
