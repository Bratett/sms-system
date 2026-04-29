import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/**
 * Seeds the alumni surface for a freshly confirmed graduate.
 *
 * Side effects (all on the supplied transaction client):
 * - Upserts an `AlumniProfile` row keyed on `studentId @unique`. The `update`
 *   branch is empty so re-confirmation preserves alumnus edits.
 * - If `student.userId` is set, deletes any existing `UserRole` rows linking
 *   that user to the `student` role and creates a fresh `UserRole` linking
 *   them to the `alumni` role. The session-side roles array updates on the
 *   alumnus's next login.
 *
 * Caller is responsible for providing the transaction client and committing.
 */
export async function seedAlumniOnGraduation(
  tx: TxClient,
  input: {
    studentId: string;
    schoolId: string;
    graduationRecord: {
      batch: { ceremonyDate: Date | null };
    };
  },
): Promise<{ profileId: string; userRoleFlipped: boolean }> {
  const student = await tx.student.findUnique({
    where: { id: input.studentId },
    select: { userId: true },
  });
  if (!student) {
    throw new Error(`Student ${input.studentId} not found`);
  }

  let userEmail: string | null = null;
  if (student.userId) {
    const user = await tx.user.findUnique({
      where: { id: student.userId },
      select: { email: true },
    });
    userEmail = user?.email ?? null;
  }

  const ceremonyDate = input.graduationRecord.batch.ceremonyDate;
  let graduationYear: number;
  if (ceremonyDate) {
    graduationYear = ceremonyDate.getFullYear();
  } else {
    graduationYear = new Date().getFullYear();
    console.warn("seedAlumniOnGraduation: ceremonyDate is null, using current year", {
      studentId: input.studentId,
      year: graduationYear,
    });
  }

  const profile = await tx.alumniProfile.upsert({
    where: { studentId: input.studentId },
    create: {
      studentId: input.studentId,
      schoolId: input.schoolId,
      graduationYear,
      email: userEmail,
      isPublic: false,
    },
    update: {}, // No-op for existing profiles; preserves alumnus edits.
    select: { id: true },
  });

  let userRoleFlipped = false;
  if (student.userId) {
    const alumniRole = await tx.role.findUnique({
      where: { name: "alumni" },
      select: { id: true },
    });
    if (!alumniRole) {
      throw new Error(
        "Alumni role not seeded in DB. Run `npm run db:seed` to populate.",
      );
    }

    // Remove the old student role (if linked) so the user no longer has
    // student-portal access.
    await tx.userRole.deleteMany({
      where: { userId: student.userId, role: { name: "student" } },
    });

    // Add the alumni role. Use create (not upsert) — the deleteMany above
    // ensures no existing alumni role row exists; if one does (rare repeat
    // call), let it surface as a unique-constraint error rather than silently
    // double-adding.
    await tx.userRole.create({
      data: { userId: student.userId, roleId: alumniRole.id },
    });
    userRoleFlipped = true;
  }

  return { profileId: profile.id, userRoleFlipped };
}
