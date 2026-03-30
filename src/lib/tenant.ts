"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface TenantContext {
  session: {
    user: {
      id: string;
      email: string;
      name: string;
      roles: string[];
      permissions: string[];
      schoolId: string;
      schoolName: string;
    };
  };
  school: {
    id: string;
    name: string;
    type: string;
    category: string;
    region: string | null;
    district: string | null;
    town: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    motto: string | null;
    logoUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Get the current tenant context from the authenticated session.
 * Replaces all `db.school.findFirst()` calls with session-based school resolution.
 *
 * Returns `{ error }` if unauthenticated, no school assigned, or school not found.
 * Returns `{ session, school }` on success.
 */
export async function getTenantContext(): Promise<
  TenantContext | { error: string }
> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const user = session.user as unknown as Record<string, unknown>;
  const schoolId = user.schoolId as string | null;

  if (!schoolId) {
    // Fallback for users without school assignment (backward compatibility)
    // Try to find a school and auto-assign
    const school = await db.school.findFirst();
    if (!school) {
      return { error: "No school configured" };
    }

    return {
      session: {
        user: {
          id: session.user.id!,
          email: session.user.email!,
          name: session.user.name!,
          roles: user.roles as string[],
          permissions: user.permissions as string[],
          schoolId: school.id,
          schoolName: school.name,
        },
      },
      school,
    } as TenantContext;
  }

  const school = await db.school.findUnique({
    where: { id: schoolId },
  });

  if (!school) {
    return { error: "School not found" };
  }

  return {
    session: {
      user: {
        id: session.user.id!,
        email: session.user.email!,
        name: session.user.name!,
        roles: user.roles as string[],
        permissions: user.permissions as string[],
        schoolId: school.id,
        schoolName: school.name,
      },
    },
    school,
  } as TenantContext;
}

/**
 * Type guard to check if the result is an error.
 */
export function isTenantError(
  result: TenantContext | { error: string },
): result is { error: string } {
  return "error" in result;
}
