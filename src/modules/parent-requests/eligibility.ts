import {
  eligibleStaffRole,
  type StaffAssignment,
  type StudentContext,
} from "@/modules/messaging/eligibility";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 14;

/**
 * Returns true if `fromDate` falls within the trailing retroactive window.
 * Default window is 14 days. Future dates are never valid.
 */
export function isWithinRetroactiveWindow(
  fromDate: Date,
  now: Date = new Date(),
  windowDays: number = DEFAULT_WINDOW_DAYS,
): boolean {
  const nowMs = now.getTime();
  const fromMs = fromDate.getTime();
  if (fromMs > nowMs) return false;
  return nowMs - fromMs <= windowDays * ONE_DAY_MS;
}

/**
 * Returns true if `fromDate <= toDate` and neither is in the future.
 * Same-day ranges are valid.
 */
export function isValidDateRange(
  fromDate: Date,
  toDate: Date,
  now: Date = new Date(),
): boolean {
  if (fromDate.getTime() > toDate.getTime()) return false;
  if (toDate.getTime() > now.getTime()) return false;
  return true;
}

/**
 * Returns true if this staff member is eligible to review excuse requests
 * for this student. Reuses the messaging eligibility rule:
 * class_teacher of the student's arm, OR housemaster of the student's house
 * (boarders only). Student must be ACTIVE or SUSPENDED.
 */
export function canReviewExcuse(
  reviewer: StaffAssignment,
  student: StudentContext,
): boolean {
  return eligibleStaffRole(reviewer, student) !== null;
}
