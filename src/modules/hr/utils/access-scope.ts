import { db } from "@/lib/db";

/**
 * Determines the department scope for a user's HR data access.
 * Users with STAFF_READ_ALL can see all staff; others are limited to their department.
 */
export async function getStaffAccessScope(
  userId: string,
  permissions: string[],
): Promise<{ departmentIds?: string[] }> {
  // Users with wildcard or explicit read-all permission can see everything
  if (permissions.includes("*") || permissions.includes("hr:staff:read-all")) {
    return {};
  }

  // Find the staff record linked to this user to determine their department
  const staff = await db.staff.findFirst({
    where: { userId, deletedAt: null },
    include: {
      employments: {
        where: { status: "ACTIVE" },
        select: { departmentId: true },
      },
    },
  });

  if (!staff || staff.employments.length === 0) {
    // No staff record or no active employment — show nothing unless they have broader permissions
    return { departmentIds: [] };
  }

  const departmentIds = staff.employments
    .map((e) => e.departmentId)
    .filter((id): id is string => id !== null);

  return { departmentIds: departmentIds.length > 0 ? departmentIds : [] };
}
